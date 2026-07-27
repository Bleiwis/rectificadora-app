import net from "node:net";
import dgram from "node:dgram";
import { orderCodeRepo, ordersRepo } from "./db.js";

let tcpServer = null;
let tcpServerConfig = null;
let discoveryServer = null;
const connectedClients = new Map();

const DEFAULT_DISCOVERY_PORT = 4511;
const DISCOVERY_REQUEST_TYPE = "rectificadora:discover";
const DISCOVERY_RESPONSE_TYPE = "rectificadora:server";

function normalizeToken(value) {
  return String(value || "").trim();
}

function ensureAuthorized(requestToken, expectedToken) {
  const expected = normalizeToken(expectedToken);
  if (!expected) {
    return true;
  }
  return normalizeToken(requestToken) === expected;
}

function writeResponse(socket, id, payload) {
  socket.write(`${JSON.stringify({ id, ...payload })}\n`);
}

function normalizeRemoteAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }
  if (raw === "::1") {
    return "127.0.0.1";
  }
  return raw;
}

function buildClientKey(address, port) {
  return `${address}:${String(port || "")}`;
}

function updateClientSnapshot(socket, update = {}) {
  const address = normalizeRemoteAddress(socket?.remoteAddress);
  const port = Number(socket?.remotePort || 0);
  if (!address || !port) return;

  const key = buildClientKey(address, port);
  const previous = connectedClients.get(key) || {
    address,
    port,
    firstSeenAt: new Date().toISOString(),
    requests: 0,
  };

  connectedClients.set(key, {
    ...previous,
    ...update,
    address,
    port,
    connected: true,
    lastSeenAt: new Date().toISOString(),
  });
}

function incrementClientRequestCount(socket, requestType) {
  const address = normalizeRemoteAddress(socket?.remoteAddress);
  const port = Number(socket?.remotePort || 0);
  if (!address || !port) return;

  const key = buildClientKey(address, port);
  const previous = connectedClients.get(key);
  const currentRequests = Number(previous?.requests || 0);
  updateClientSnapshot(socket, {
    requests: currentRequests + 1,
    lastRequestType: String(requestType || ""),
  });
}

function markClientDisconnected(socket) {
  const address = normalizeRemoteAddress(socket?.remoteAddress);
  const port = Number(socket?.remotePort || 0);
  if (!address || !port) return;

  const key = buildClientKey(address, port);
  const previous = connectedClients.get(key);
  if (!previous) return;

  connectedClients.set(key, {
    ...previous,
    connected: false,
    disconnectedAt: new Date().toISOString(),
  });
}

function getConnectedClientList() {
  return Array.from(connectedClients.values())
    .sort((a, b) => {
      const aTime = Date.parse(a.lastSeenAt || a.firstSeenAt || "") || 0;
      const bTime = Date.parse(b.lastSeenAt || b.firstSeenAt || "") || 0;
      return bTime - aTime;
    })
    .slice(0, 30);
}

async function handleServerRequest(request, expectedToken) {
  const type = String(request?.type || "");
  const id = request?.id || null;

  if (!ensureAuthorized(request?.token, expectedToken)) {
    return { id, ok: false, error: "No autorizado para usar el servidor LAN." };
  }

  if (type === "health") {
    return { id, ok: true, data: { status: "ok" } };
  }

  if (type === "order:get-next-code") {
    const code = orderCodeRepo.getNextCode();
    return { id, ok: true, data: { code } };
  }

  if (type === "order:create") {
    const order = request?.payload?.order;
    if (!order || !order.id) {
      return { id, ok: false, error: "Payload de orden invalido." };
    }

    // The server is the single writer for 4-digit order code assignment.
    const savedOrder = ordersRepo.createWithInventoryDeduction({
      ...order,
      code: "",
    });

    return { id, ok: true, data: { order: savedOrder } };
  }

  return { id, ok: false, error: `Tipo de solicitud no soportado: ${type}` };
}

export function startLanOrderServer(config) {
  const host = String(config?.host || "0.0.0.0").trim() || "0.0.0.0";
  const port = Number(config?.port || 4510);
  const discoveryPort = Number(config?.discoveryPort || DEFAULT_DISCOVERY_PORT);
  const token = normalizeToken(config?.token);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Puerto LAN invalido.");
  }

  if (tcpServer) {
    stopLanOrderServer();
  }

  connectedClients.clear();

  tcpServer = net.createServer((socket) => {
    let buffer = "";
    updateClientSnapshot(socket);

    socket.setEncoding("utf8");
    socket.on("data", async (chunk) => {
      updateClientSnapshot(socket);
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request = JSON.parse(line);
          incrementClientRequestCount(socket, request?.type);
          const response = await handleServerRequest(request, token);
          writeResponse(socket, response.id || request?.id || null, response);
        } catch (error) {
          writeResponse(socket, null, {
            ok: false,
            error: error instanceof Error ? error.message : "Error interno del servidor LAN.",
          });
        }
      }
    });

    socket.on("close", () => {
      markClientDisconnected(socket);
    });

    socket.on("error", () => {
      markClientDisconnected(socket);
    });
  });

  tcpServer.listen(port, host);
  discoveryServer = dgram.createSocket("udp4");
  discoveryServer.on("message", (msg, rinfo) => {
    try {
      const payload = JSON.parse(String(msg || "{}"));
      if (payload?.type !== DISCOVERY_REQUEST_TYPE) {
        return;
      }

      const response = Buffer.from(
        JSON.stringify({
          type: DISCOVERY_RESPONSE_TYPE,
          port,
          tokenRequired: Boolean(token),
          timestamp: Date.now(),
        }),
      );

      discoveryServer.send(response, rinfo.port, rinfo.address);
    } catch {
      // Ignore malformed discovery packets.
    }
  });
  discoveryServer.bind(discoveryPort, "0.0.0.0");

  tcpServerConfig = { host, port, token };
  return { running: true, host, port };
}

export function stopLanOrderServer() {
  if (!tcpServer) {
    tcpServerConfig = null;
    connectedClients.clear();
    return { running: false };
  }

  tcpServer.close();
  if (discoveryServer) {
    discoveryServer.close();
    discoveryServer = null;
  }
  tcpServer = null;
  tcpServerConfig = null;
  connectedClients.clear();
  return { running: false };
}

export function getLanOrderServerStatus() {
  return {
    running: Boolean(tcpServer),
    host: tcpServerConfig?.host || null,
    port: tcpServerConfig?.port || null,
    connectedClients: getConnectedClientList(),
  };
}

function requestLanServer({ host, port, token, type, payload, timeoutMs = 3000 }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) });
    let buffer = "";
    let finished = false;

    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const done = (fn, value) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      fn(value);
    };

    socket.setEncoding("utf8");
    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.write(
        `${JSON.stringify({ id: requestId, type, token: normalizeToken(token), payload })}\n`,
      );
    });

    socket.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response?.id !== requestId) continue;

          if (!response.ok) {
            done(reject, new Error(response.error || "Solicitud LAN rechazada."));
            return;
          }

          done(resolve, response.data);
          return;
        } catch {
          // Keep waiting for a valid JSON response for this request id.
        }
      }
    });

    socket.on("timeout", () => {
      done(reject, new Error("Tiempo de espera agotado al conectar con el servidor LAN."));
    });

    socket.on("error", (error) => {
      done(reject, error);
    });
  });
}

export async function getNextOrderCodeFromLan(config) {
  const data = await requestLanServer({
    host: config.host,
    port: config.port,
    token: config.token,
    type: "order:get-next-code",
  });
  return String(data?.code || "");
}

export async function createOrderThroughLan(config, order) {
  const data = await requestLanServer({
    host: config.host,
    port: config.port,
    token: config.token,
    type: "order:create",
    payload: { order },
    timeoutMs: 6000,
  });
  return data?.order || null;
}

export async function pingLanServer(config) {
  await requestLanServer({
    host: config.host,
    port: config.port,
    token: config.token,
    type: "health",
    timeoutMs: 1500,
  });
  return true;
}

export async function discoverLanServers(options = {}) {
  const discoveryPort = Number(options.discoveryPort || DEFAULT_DISCOVERY_PORT);
  const timeoutMs = Number(options.timeoutMs || 1200);

  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const found = new Map();
    let finished = false;

    const done = () => {
      if (finished) return;
      finished = true;
      socket.close();
      resolve(Array.from(found.values()));
    };

    socket.on("message", (msg, rinfo) => {
      try {
        const payload = JSON.parse(String(msg || "{}"));
        if (payload?.type !== DISCOVERY_RESPONSE_TYPE) {
          return;
        }

        const host = String(rinfo.address || "").trim();
        const port = Number(payload?.port || 0);
        if (!host || !Number.isInteger(port) || port <= 0) {
          return;
        }

        found.set(`${host}:${port}`, {
          host,
          port,
          tokenRequired: Boolean(payload?.tokenRequired),
          discoveredAt: new Date().toISOString(),
        });
      } catch {
        // Ignore invalid packets.
      }
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      const request = Buffer.from(JSON.stringify({ type: DISCOVERY_REQUEST_TYPE }));

      socket.send(request, discoveryPort, "255.255.255.255");
      socket.send(request, discoveryPort, "127.0.0.1");
      setTimeout(done, timeoutMs);
    });
  });
}
