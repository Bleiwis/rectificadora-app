import "./runtime-env.js";
import { app, BrowserWindow, net, protocol, ipcMain } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAuthStore } from "./auth-store.js";
import { registerAuthIpcHandlers } from "./auth-ipc.js";
import {
  initDatabase,
  servicesRepo,
  inventoryRepo,
  ordersRepo,
  orderPaymentsRepo,
  orderPartDeliveriesRepo,
  clientsRepo,
  usersRepo,
  orderCodeRepo,
  runtimeConfigRepo,
} from "./db.js";
import {
  startLanOrderServer,
  stopLanOrderServer,
  getLanOrderServerStatus,
  getNextOrderCodeFromLan,
  createOrderThroughLan,
  pingLanServer,
  discoverLanServers,
  getOrdersFromLan,
  getServicesFromLan,
  getInventoryFromLan,
} from "./lan-order-service.js";
import { startSyncInterval, stopSyncInterval, processOutbox } from "./supabase-sync.js";
import {
  initializeLicenseService,
  stopLicenseService,
  getLicenseStatus,
  refreshLicense,
} from "./license-service.js";
import {
  getLatestBcvUsdRate,
  refreshBcvUsdRateSafe,
  getBcvUsdRateStatus,
  setManualBcvUsdRate,
  startBcvRateSyncInterval,
  stopBcvRateSyncInterval,
} from "./bcv-rate-service.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const preloadFile = path.join(__dirname, "../preload/index.cjs");
const distPath = path.join(__dirname, "../../dist");

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

function isDefaultStandaloneLanConfig(config) {
  return (
    String(config?.mode || "") === "standalone" &&
    String(config?.host || "").trim() === "127.0.0.1" &&
    Number(config?.port || 0) === 4510 &&
    String(config?.token || "").trim() === ""
  );
}

function getEffectiveLanConfig() {
  const persisted = runtimeConfigRepo.getLanConfig();
  const envMode = isDevelopment
    ? String(process.env.APP_DEPLOYMENT_MODE || "").trim().toLowerCase()
    : "";
  const envHost = isDevelopment ? String(process.env.APP_LAN_HOST || "").trim() : "";
  const envPort = isDevelopment ? Number(process.env.APP_LAN_PORT || 0) : 0;
  const envToken = isDevelopment ? String(process.env.APP_LAN_TOKEN || "").trim() : "";

  let mode =
    envMode === "server" || envMode === "client" || envMode === "standalone"
      ? envMode
      : persisted.mode;
  let host = envHost || persisted.host;
  let port = Number.isInteger(envPort) && envPort > 0 ? envPort : persisted.port;
  const token = envToken || persisted.token;

  // In developer runs, treat untouched default config as client+auto to avoid silent standalone mode.
  if (isDevelopment && !envMode && isDefaultStandaloneLanConfig(persisted)) {
    mode = "client";
    host = "auto";
    port = 4510;
  }

  return {
    mode:
      mode === "server" || mode === "client" || mode === "standalone"
        ? mode
        : persisted.mode,
    host,
    port,
    token,
    modeLocked: Boolean(persisted.modeLocked),
    installedRole: persisted.installedRole || null,
  };
}

function applyLanServerMode() {
  const config = getEffectiveLanConfig();
  if (config.mode === "server") {
    return startLanOrderServer(config);
  }
  stopLanOrderServer();
  return { running: false };
}

async function resolveClientLanConfig(baseConfig) {
  const configuredHost = String(baseConfig?.host || "").trim();
  const configuredPort = Number(baseConfig?.port || 4510);

  if (configuredHost && configuredHost.toLowerCase() !== "auto") {
    return {
      ...baseConfig,
      host: configuredHost,
      port: configuredPort,
    };
  }

  const discovered = await discoverLanServers({ timeoutMs: 1200 });
  if (!discovered.length) {
    throw new Error("No se detectó servidor LAN automáticamente. Verifica que el servidor esté activo en la misma red.");
  }

  const selected = discovered[0];
  const nextConfig = {
    ...baseConfig,
    host: selected.host,
    port: selected.port,
  };

  // Persist resolved target so future requests are faster and transparent.
  runtimeConfigRepo.saveLanConfig(nextConfig);
  return nextConfig;
}

function applyInstallerLanBootstrap(userDataPath) {
  const appDataPath = process.env.APPDATA || "";
  const candidatePaths = [
    path.join(userDataPath, "installer-lan-config.txt"),
    appDataPath ? path.join(appDataPath, "Rectificadora App", "installer-lan-config.txt") : "",
    appDataPath ? path.join(appDataPath, "tailadmin-react", "installer-lan-config.txt") : "",
  ].filter(Boolean);

  const bootstrapPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
  if (!bootstrapPath) {
    return;
  }

  try {
    const raw = fs.readFileSync(bootstrapPath, "utf8");
    const values = {};

    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = String(line || "").trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separator = trimmed.indexOf("=");
      if (separator === -1) return;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      values[key] = value;
    });

    runtimeConfigRepo.saveLanConfig({
      mode: values.mode,
      host: values.host,
      port: values.port,
      token: values.token,
    });

    if (values.mode === "server" || values.mode === "client" || values.mode === "standalone") {
      runtimeConfigRepo.setLanModeLock(true, values.mode);
    }

    fs.unlinkSync(bootstrapPath);
  } catch (error) {
    console.error("[lan-bootstrap] failed to apply installer config", error);
  }
}

function getLocalNetworkIps() {
  const isPrivateIpv4 = (address) => {
    const parts = String(address || "").split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      return false;
    }

    if (parts[0] === 10) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    return false;
  };

  const isLinkLocalIpv4 = (address) => {
    const parts = String(address || "").split(".").map((part) => Number(part));
    return parts.length === 4 && parts[0] === 169 && parts[1] === 254;
  };

  const isLikelyVirtualInterface = (interfaceName) => {
    const value = String(interfaceName || "").toLowerCase();
    return /^(lo|lo0|utun|awdl|llw|gif|stf|anpi|docker|veth|br-|vboxnet|vmnet|zt|tailscale|wg|tap|tun|vnic)/.test(value) ||
      value.includes("veth") ||
      value.includes("docker") ||
      value.includes("virtual") ||
      value.includes("hyper-v") ||
      value.includes("vethernet") ||
      value.includes("vmware") ||
      value.includes("vpn") ||
      value.includes("hamachi") ||
      value.includes("tailscale") ||
      value.includes("wireguard");
  };

  const scoreAddress = (interfaceName, address) => {
    const normalizedInterface = String(interfaceName || "").toLowerCase();
    let score = 0;

    if (isPrivateIpv4(address)) score += 50;
    if (String(address || "").startsWith("192.168.")) score += 30;
    if (String(address || "").startsWith("10.")) score += 20;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(String(address || ""))) score += 10;

    if (normalizedInterface.startsWith("en") || normalizedInterface.startsWith("eth") || normalizedInterface.includes("wifi") || normalizedInterface.includes("wi-fi") || normalizedInterface.includes("ethernet")) {
      score += 25;
    }

    if (isLikelyVirtualInterface(interfaceName)) score -= 60;
    return score;
  };

  const interfaces = os.networkInterfaces();
  const rows = [];

  Object.entries(interfaces).forEach(([interfaceName, values]) => {
    (values || []).forEach((entry) => {
      const family =
        typeof entry.family === "string"
          ? entry.family
          : entry.family === 4
            ? "IPv4"
            : "IPv6";

      if (!entry?.address || entry.internal || family !== "IPv4") {
        return;
      }

      if (isLinkLocalIpv4(entry.address)) {
        return;
      }

      rows.push({
        interfaceName,
        family,
        address: entry.address,
        netmask: entry.netmask || "",
        cidr: entry.cidr || "",
        _score: scoreAddress(interfaceName, entry.address),
      });
    });
  });

  return rows
    .sort((a, b) => {
      if (b._score !== a._score) {
        return b._score - a._score;
      }
      return String(a.interfaceName).localeCompare(String(b.interfaceName));
    })
    .map(({ _score, ...row }) => row);
}

function registerAppProtocol() {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const relativePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.join(distPath, decodeURIComponent(relativePath));

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadFile,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[desktop-auth] preload error", preloadPath, error);
  });

  if (isDevelopment) {
    mainWindow.webContents.once("dom-ready", async () => {
      try {
        const hasDesktopAuthBridge = await mainWindow.webContents.executeJavaScript(
          "Boolean(window.desktopAuth)",
          true,
        );
        console.log(`[desktop-auth] bridge available: ${hasDesktopAuthBridge}`);
      } catch (error) {
        console.error("[desktop-auth] bridge check failed", error);
      }
    });
  }

  if (isDevelopment) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.loadURL("app://-/index.html");
}

function registerDbIpcHandlers() {
  ipcMain.handle("db:get-services", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return getServicesFromLan(resolvedConfig);
    }
    return servicesRepo.getAll();
  });
  ipcMain.handle("db:save-service", (_, service) => servicesRepo.save(service));
  ipcMain.handle("db:delete-service", (_, id) => servicesRepo.delete(id));

  ipcMain.handle("db:get-inventory", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return getInventoryFromLan(resolvedConfig);
    }
    return inventoryRepo.getAll();
  });
  ipcMain.handle("db:save-inventory", (_, item) => inventoryRepo.save(item));
  ipcMain.handle("db:delete-inventory", (_, id) => inventoryRepo.delete(id));

  ipcMain.handle("db:get-orders", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return getOrdersFromLan(resolvedConfig);
    }
    return ordersRepo.getAll();
  });
  ipcMain.handle("db:get-next-order-code", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return getNextOrderCodeFromLan(resolvedConfig);
    }
    return orderCodeRepo.getNextCode();
  });
  ipcMain.handle("db:reserve-next-order-code", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      throw new Error("En modo cliente, el código lo asigna el servidor al crear la orden.");
    }
    return orderCodeRepo.reserveNextCode();
  });
  ipcMain.handle("db:create-order-with-inventory", async (_, order) => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return createOrderThroughLan(resolvedConfig, order);
    }
    return ordersRepo.createWithInventoryDeduction(order);
  });
  ipcMain.handle("db:save-order", (_, order) => ordersRepo.save(order));
  ipcMain.handle("db:delete-order", (_, id) => ordersRepo.delete(id));
  ipcMain.handle("db:cancel-order", (_, payload) =>
    ordersRepo.cancel(payload?.id, payload),
  );
  ipcMain.handle("db:get-order-payments", (_, orderId) =>
    orderPaymentsRepo.getByOrderId(orderId),
  );
  ipcMain.handle("db:add-order-payment", (_, payload) =>
    orderPaymentsRepo.addPayment(payload?.orderId, payload?.payment),
  );
  ipcMain.handle("db:get-order-part-deliveries", (_, orderId) =>
    orderPartDeliveriesRepo.getByOrderId(orderId),
  );
  ipcMain.handle("db:add-order-part-deliveries", (_, payload) =>
    orderPartDeliveriesRepo.addDeliveries(payload?.orderId, payload),
  );

  ipcMain.handle("db:get-clients", () => clientsRepo.getAll());
  ipcMain.handle("db:find-client-by-document", (_, docNormalized) =>
    clientsRepo.findByDocument(docNormalized),
  );
  ipcMain.handle("db:upsert-client", (_, client) => clientsRepo.upsert(client));

  ipcMain.handle("db:trigger-sync", () => {
    processOutbox();
    return true;
  });

  ipcMain.handle("db:get-bcv-usd-rate", () => getLatestBcvUsdRate());
  ipcMain.handle("db:refresh-bcv-usd-rate", () =>
    refreshBcvUsdRateSafe({ force: true, reason: "manual" }),
  );
  ipcMain.handle("db:get-bcv-usd-rate-status", () => getBcvUsdRateStatus());
  ipcMain.handle("db:set-manual-bcv-usd-rate", (_, valueUsd) =>
    setManualBcvUsdRate(valueUsd),
  );

  ipcMain.handle("db:get-lan-config", () => getEffectiveLanConfig());
  ipcMain.handle("db:set-lan-config", (_, input) => {
    const current = runtimeConfigRepo.getLanConfig();
    const requestedMode = String(input?.mode || "").trim();
    if (
      current.modeLocked &&
      (requestedMode === "server" || requestedMode === "client" || requestedMode === "standalone") &&
      requestedMode !== current.mode
    ) {
      throw new Error(
        `El modo LAN está bloqueado por instalación (${current.installedRole || current.mode}) y no puede modificarse.`,
      );
    }

    const next = runtimeConfigRepo.saveLanConfig({
      ...(input || {}),
      modeLocked: current.modeLocked,
      installedRole: current.installedRole,
    });
    applyLanServerMode();
    return next;
  });
  ipcMain.handle("db:get-lan-status", async () => {
    const config = getEffectiveLanConfig();
    const serverStatus = getLanOrderServerStatus();
    let remoteReachable = false;
    let discoveredServers = [];

    if (config.mode === "client") {
      try {
        const resolvedConfig = await resolveClientLanConfig(config);
        await pingLanServer(resolvedConfig);
        remoteReachable = true;
      } catch {
        remoteReachable = false;
      }

      try {
        discoveredServers = await discoverLanServers({ timeoutMs: 900 });
      } catch {
        discoveredServers = [];
      }
    }

    return {
      config,
      serverStatus,
      remoteReachable,
      discoveredServers,
    };
  });
  ipcMain.handle("db:discover-lan-servers", async () => {
    return discoverLanServers({ timeoutMs: 1500 });
  });
  ipcMain.handle("db:probe-lan-server", async (_, input) => {
    const host = String(input?.host || "").trim();
    const port = Number(input?.port || 4510);
    const token = String(input?.token || "").trim();

    if (!host) {
      return {
        reachable: false,
        error: "Host LAN inválido para validación.",
      };
    }

    try {
      await pingLanServer({ host, port, token });
      return {
        reachable: true,
        error: null,
      };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : "No se pudo conectar al servidor LAN.",
      };
    }
  });
  ipcMain.handle("db:get-local-network-ips", () => getLocalNetworkIps());
}

function registerLicenseIpcHandlers() {
  ipcMain.handle("license:get-status", () => getLicenseStatus());
  ipcMain.handle("license:refresh", () => refreshLicense("manual"));
}

app.whenReady().then(() => {
  const userDataPath = app.getPath("userData");
  initDatabase(path.join(userDataPath, "rectificadora.db"));
  applyInstallerLanBootstrap(userDataPath);

  const authStore = createAuthStore(userDataPath);
  const mirrorAuthUser = (user) => {
    if (user?.id) {
      usersRepo.upsertFromAuthUser(user);
    }
  };

  // Bootstrap mirror for existing users so orders.createdByUserId can relate locally/remotely.
  try {
    const existingUsers = authStore.listUsers();
    existingUsers.forEach(mirrorAuthUser);
  } catch (error) {
    console.error("[auth-mirror] failed bootstrap", error);
  }

  registerAuthIpcHandlers(authStore, mirrorAuthUser);
  registerDbIpcHandlers();
  registerLicenseIpcHandlers();

  if (!isDevelopment) {
    registerAppProtocol();
  }

  createMainWindow();
  applyLanServerMode();
  initializeLicenseService({ refreshIntervalMs: 5 * 60 * 1000 });
  startSyncInterval(30000); // Check outbox every 30 seconds
  startBcvRateSyncInterval(60 * 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopLanOrderServer();
  stopLicenseService();
  stopSyncInterval();
  stopBcvRateSyncInterval();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
