import "./runtime-env.js";
import { app, BrowserWindow, net, protocol, ipcMain, Tray, Menu, Notification, nativeImage, shell } from "electron";
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
  getLicenseStatusFromLan,
  refreshLicenseFromLan,
} from "./lan-order-service.js";
import {
  startSyncInterval,
  stopSyncInterval,
  processOutbox,
  restoreFromCloudBackup,
} from "./supabase-sync.js";
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
import { initializeAutoUpdater } from "./auto-updater.js";

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

let mainWindow = null;
let tray = null;
let isQuitting = false;
let hasShownBackgroundNotification = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toFixed(2);
}

function assertObjectPayload(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

function assertNonEmptyString(value, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

let orderNoteLogoDataUrl = null;

function resolveOrderNoteLogoDataUrl() {
  if (orderNoteLogoDataUrl !== null) {
    return orderNoteLogoDataUrl;
  }

  const logoCandidates = [
    path.join(distPath, "images/logo/logo.png"),
    path.join(__dirname, "../../public/images/logo/logo.png"),
  ];

  for (const logoPath of logoCandidates) {
    if (!fs.existsSync(logoPath)) continue;

    try {
      const binary = fs.readFileSync(logoPath);
      const ext = path.extname(logoPath).toLowerCase();
      const mimeType =
        ext === ".svg"
          ? "image/svg+xml"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "image/png";
      orderNoteLogoDataUrl = `data:${mimeType};base64,${binary.toString("base64")}`;
      return orderNoteLogoDataUrl;
    } catch {
      // Keep looking on fallback paths.
    }
  }

  orderNoteLogoDataUrl = "";
  return orderNoteLogoDataUrl;
}

function buildOrderNoteHtml(payload) {
  const logoDataUrl = resolveOrderNoteLogoDataUrl();
  const parts = Array.isArray(payload?.parts) ? payload.parts : [];
  const services = Array.isArray(payload?.services) ? payload.services : [];
  const inventoryItems = Array.isArray(payload?.inventoryItems)
    ? payload.inventoryItems
    : [];

  const partsRows = parts
    .map((part) => {
      const partName =
        part?.partName === "Otro (Escribir abajo)"
          ? part?.customName || "Otro"
          : part?.partName || "Parte";
      return `
        <tr>
          <td>${escapeHtml(partName)}</td>
          <td class="text-center">${escapeHtml(part?.quantity ?? "")}</td>
          <td>${escapeHtml(part?.measurement ?? "")}</td>
        </tr>
      `;
    })
    .join("");

  const servicesRows = services
    .map(
      (service) => `
        <tr>
          <td>${escapeHtml(service?.name || "Servicio")}</td>
          <td class="text-right">$${formatMoney(service?.priceUSD)} USD</td>
        </tr>
      `,
    )
    .join("");

  const inventoryRows = inventoryItems
    .map((item) => {
      const qty = Number(item?.quantity || 0);
      const unitPrice = Number(item?.priceUSD || 0);
      return `
        <tr>
          <td>${escapeHtml(item?.name || "Ítem")}</td>
          <td class="text-center">${escapeHtml(qty)}</td>
          <td class="text-right">$${formatMoney(unitPrice * qty)} USD</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nota de Entrega ${escapeHtml(payload?.code || "")}</title>
  <style>
    @page {
      size: A4;
      margin: 14mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Segoe UI", Tahoma, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      background: #ffffff;
    }
    .doc {
      width: 100%;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand-title {
      margin: 0;
      font-size: 20px;
      color: #2563eb;
    }
    .brand {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .brand-logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .muted {
      color: #475569;
      margin: 2px 0;
    }
    .note-number {
      text-align: right;
    }
    .note-number strong {
      display: block;
      font-size: 20px;
      color: #2563eb;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .section-title {
      margin: 0 0 4px;
      font-size: 10px;
      letter-spacing: 0.06em;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    th,
    td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      text-align: left;
      font-size: 11px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .summary {
      margin-top: 8px;
      padding-top: 10px;
      border-top: 1px solid #d1d5db;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 14px;
    }
    .status {
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-paga {
      color: #15803d;
    }
    .status-abonada {
      color: #1d4ed8;
    }
    .status-pendiente {
      color: #a16207;
    }
    .totals {
      text-align: right;
    }
    .totals .main {
      font-size: 20px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main class="doc">
    <header class="header">
      <div class="brand">
        ${logoDataUrl ? `<img class="brand-logo" src="${logoDataUrl}" alt="Logo Rectificadora Bruno C.A" />` : ""}
        <div>
          <h1 class="brand-title">Rectificadora Bruno C.A</h1>
          <p class="muted"><strong>RIF:</strong> J-507200914</p>
          <p class="muted">Cuidado y precisión para su motor</p>
        </div>
      </div>
      <div class="note-number">
        <div class="section-title">Nota de entrega</div>
        <strong>Nº ${escapeHtml(payload?.code || "")}</strong>
        <p class="muted">Ingreso: ${escapeHtml(payload?.entryDate || "")}</p>
      </div>
    </header>

    <section class="grid">
      <div>
        <p class="section-title">Cliente</p>
        <div><strong>${escapeHtml(payload?.clientName || "")} ${escapeHtml(payload?.clientLastName || "")}</strong></div>
        <div>Cédula: ${escapeHtml(payload?.clientCI || "")}</div>
        <div>Teléfono: ${escapeHtml(payload?.clientPhone || "")}</div>
        ${payload?.clientAddress ? `<div>Dirección: ${escapeHtml(payload.clientAddress)}</div>` : ""}
      </div>
      <div>
        <p class="section-title">Detalles motor</p>
        <div><strong>${escapeHtml(payload?.engineModel || "")}</strong></div>
        <div class="muted" style="margin-top: 8px;">Recibido por: ${escapeHtml(payload?.createdBy || "")}</div>
      </div>
    </section>

    <section>
      <p class="section-title">Partes de motor recibidas</p>
      <table>
        <thead>
          <tr>
            <th>Descripción de Parte</th>
            <th style="width: 90px;">Cant.</th>
            <th style="width: 160px;">Medida Salida</th>
          </tr>
        </thead>
        <tbody>
          ${partsRows || '<tr><td colspan="3">Sin partes registradas.</td></tr>'}
        </tbody>
      </table>
    </section>

    ${servicesRows
      ? `
      <section>
        <p class="section-title">Servicios realizados</p>
        <table>
          <tbody>${servicesRows}</tbody>
        </table>
      </section>
    `
      : ""}

    ${inventoryRows
      ? `
      <section>
        <p class="section-title">Repuestos e insumos adicionales</p>
        <table>
          <thead>
            <tr>
              <th>Repuesto</th>
              <th style="width: 90px;">Cant.</th>
              <th style="width: 160px;" class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>${inventoryRows}</tbody>
        </table>
      </section>
    `
      : ""}

    <section class="summary">
      <div>
        <div class="section-title">Estado de nota</div>
        <div class="status ${
          payload?.paymentStatus === "Paga"
            ? "status-paga"
            : payload?.paymentStatus === "Abonada"
              ? "status-abonada"
              : "status-pendiente"
        }">
          ${escapeHtml(payload?.paymentStatus || "Pendiente por cobrar")}
        </div>
      </div>
      <div class="totals">
        <div class="section-title">Total orden</div>
        <div class="main">$${formatMoney(payload?.totalUSD)} USD</div>
        <div>Abonado: $${formatMoney(payload?.paidUSD)} USD</div>
        <div>Saldo pendiente: $${formatMoney(payload?.balanceUSD)} USD</div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

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

function applyLanServerMode(authStore = null) {
  const config = getEffectiveLanConfig();
  let result = { running: false };
  if (config.mode === "server") {
    result = startLanOrderServer(config, authStore);
    // Server listen/error events are asynchronous; refresh tray after boot settles.
    setTimeout(() => updateTrayMenu(), 600);
    setTimeout(() => updateTrayMenu(), 1800);
  } else {
    stopLanOrderServer();
  }
  updateTrayMenu();
  return result;
}

function getTrayIcon() {
  const faviconPath = path.join(distPath, "favicon.png");
  const publicFavicon = path.join(__dirname, "../../public/favicon.png");
  const targetPath = fs.existsSync(faviconPath) ? faviconPath : publicFavicon;

  if (fs.existsSync(targetPath)) {
    return nativeImage.createFromPath(targetPath);
  }
  return nativeImage.createEmpty();
}

function updateTrayMenu() {
  if (!tray) return;

  const config = getEffectiveLanConfig();
  const serverStatus = getLanOrderServerStatus();

  let modeLabel = "Modo: Monousuario (Standalone)";
  if (config.mode === "server") {
    if (serverStatus.running) {
      modeLabel = `Servidor LAN Activo (Puerto ${serverStatus.port || config.port})`;
    } else if (serverStatus.lastError) {
      modeLabel = `Servidor LAN Inactivo (${serverStatus.lastError})`;
    } else if (serverStatus.host || serverStatus.port) {
      modeLabel = `Servidor LAN Iniciando... (Puerto ${serverStatus.port || config.port})`;
    } else {
      modeLabel = "Servidor LAN Inactivo";
    }
  } else if (config.mode === "client") {
    modeLabel = `Modo Cliente LAN (${config.host}:${config.port})`;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Rectificadora Bruno C.A",
      enabled: false,
    },
    {
      label: modeLabel,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Abrir Aplicación",
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Salir por Completo",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Rectificadora Bruno C.A - ${modeLabel}`);
}

function createSystemTray() {
  if (tray) return;

  const icon = getTrayIcon();
  tray = new Tray(icon);

  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  updateTrayMenu();
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
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    icon: getTrayIcon(),
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

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (!hasShownBackgroundNotification) {
        hasShownBackgroundNotification = true;
        if (Notification.isSupported()) {
          new Notification({
            title: "Rectificadora Bruno C.A",
            body: "La aplicación sigue ejecutándose en segundo plano para mantener los servicios activos.",
          }).show();
        }
      }
    }
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

function registerDbIpcHandlers(authStore = null) {
  ipcMain.handle("db:get-services", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return getServicesFromLan(resolvedConfig);
    }
    return servicesRepo.getAll();
  });
  ipcMain.handle("db:save-service", (_, service) => {
    const payload = assertObjectPayload(service, "Payload de servicio inválido.");
    return servicesRepo.save(payload);
  });
  ipcMain.handle("db:delete-service", (_, id) => {
    const serviceId = assertNonEmptyString(id, "ID de servicio inválido.");
    return servicesRepo.delete(serviceId);
  });

  ipcMain.handle("db:get-inventory", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return getInventoryFromLan(resolvedConfig);
    }
    return inventoryRepo.getAll();
  });
  ipcMain.handle("db:save-inventory", (_, item) => {
    const payload = assertObjectPayload(item, "Payload de inventario inválido.");
    return inventoryRepo.save(payload);
  });
  ipcMain.handle("db:delete-inventory", (_, id) => {
    const inventoryId = assertNonEmptyString(id, "ID de inventario inválido.");
    return inventoryRepo.delete(inventoryId);
  });

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
    const payload = assertObjectPayload(order, "Payload de orden inválido.");
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      const resolvedConfig = await resolveClientLanConfig(config);
      return createOrderThroughLan(resolvedConfig, payload);
    }
    return ordersRepo.createWithInventoryDeduction(payload);
  });
  ipcMain.handle("db:save-order", (_, order) => {
    const payload = assertObjectPayload(order, "Payload de orden inválido.");
    return ordersRepo.save(payload);
  });
  ipcMain.handle("db:delete-order", (_, id) => {
    const orderId = assertNonEmptyString(id, "ID de orden inválido.");
    return ordersRepo.delete(orderId);
  });
  ipcMain.handle("db:cancel-order", (_, payload) =>
    ordersRepo.cancel(
      assertNonEmptyString(payload?.id, "ID de orden inválido."),
      assertObjectPayload(payload, "Payload de cancelación inválido."),
    ),
  );
  ipcMain.handle("db:get-order-payments", (_, orderId) =>
    orderPaymentsRepo.getByOrderId(orderId),
  );
  ipcMain.handle("db:add-order-payment", (_, payload) => {
    const data = assertObjectPayload(payload, "Payload de pago inválido.");
    const orderId = assertNonEmptyString(data.orderId, "ID de orden inválido para pago.");
    const payment = assertObjectPayload(data.payment, "Detalle de pago inválido.");
    return orderPaymentsRepo.addPayment(orderId, payment);
  });
  ipcMain.handle("db:get-order-part-deliveries", (_, orderId) =>
    orderPartDeliveriesRepo.getByOrderId(orderId),
  );
  ipcMain.handle("db:add-order-part-deliveries", (_, payload) => {
    const data = assertObjectPayload(payload, "Payload de retiro de partes inválido.");
    const orderId = assertNonEmptyString(
      data.orderId,
      "ID de orden inválido para retiro de partes.",
    );
    return orderPartDeliveriesRepo.addDeliveries(orderId, data);
  });

  ipcMain.handle("db:get-clients", () => clientsRepo.getAll());
  ipcMain.handle("db:find-client-by-document", (_, docNormalized) =>
    clientsRepo.findByDocument(docNormalized),
  );
  ipcMain.handle("db:upsert-client", (_, client) => {
    const payload = assertObjectPayload(client, "Payload de cliente inválido.");
    return clientsRepo.upsert(payload);
  });

  ipcMain.handle("db:trigger-sync", () => {
    processOutbox();
    return true;
  });

  ipcMain.handle("db:restore-from-cloud", async (_, options) => {
    return restoreFromCloudBackup(options || {});
  });

  ipcMain.handle("db:get-bcv-usd-rate", () => getLatestBcvUsdRate());
  ipcMain.handle("db:refresh-bcv-usd-rate", () =>
    refreshBcvUsdRateSafe({ force: true, reason: "manual" }),
  );
  ipcMain.handle("db:get-bcv-usd-rate-status", () => getBcvUsdRateStatus());
  ipcMain.handle("db:set-manual-bcv-usd-rate", (_, valueUsd) => {
    if (!Number.isFinite(Number(valueUsd))) {
      throw new Error("Tasa manual BCV inválida.");
    }
    return setManualBcvUsdRate(valueUsd);
  });

  ipcMain.handle("db:get-lan-config", () => getEffectiveLanConfig());
  ipcMain.handle("db:set-lan-config", (_, input) => {
    const payload = assertObjectPayload(input, "Payload de configuración LAN inválido.");
    const current = runtimeConfigRepo.getLanConfig();
    const requestedMode = String(payload?.mode || "").trim();
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
      ...payload,
      modeLocked: current.modeLocked,
      installedRole: current.installedRole,
    });
    applyLanServerMode(authStore);
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

  ipcMain.handle("db:print-order-note", async (_, payload) => {
    let printWindow = null;
    try {
      const html = buildOrderNoteHtml(payload || {});
      const printUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

      printWindow = new BrowserWindow({
        width: 900,
        height: 1200,
        show: false,
        backgroundColor: "#ffffff",
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      await printWindow.loadURL(printUrl);

      const pdfBuffer = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
        preferCSSPageSize: true,
      });

      const tempDir = app.getPath("temp");
      const safeCode = String(payload?.code || "nota")
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 48);
      const pdfPath = path.join(
        tempDir,
        `nota-entrega-${safeCode}-${Date.now()}.pdf`,
      );

      await fs.promises.writeFile(pdfPath, pdfBuffer);
      const openError = await shell.openPath(pdfPath);
      if (openError) {
        throw new Error(openError);
      }

      return { ok: true, filePath: pdfPath };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible generar la nota en PDF.",
      };
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.destroy();
      }
    }
  });
}

function registerLicenseIpcHandlers() {
  ipcMain.handle("license:get-status", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      try {
        const resolvedConfig = await resolveClientLanConfig(config);
        const remoteStatus = await getLicenseStatusFromLan(resolvedConfig);
        if (remoteStatus) {
          return remoteStatus;
        }
      } catch (error) {
        return {
          status: "blocked",
          reason: "lan-server-unreachable",
          installationId: "desconocida (modo cliente)",
          nowIso: new Date().toISOString(),
          warningStartAt: null,
          blockAt: null,
          daysUntilBlock: 0,
          periodLabel: null,
          lastSyncAt: null,
          lastError: error instanceof Error ? error.message : "No fue posible conectar con el servidor LAN.",
          insecureMode: false,
        };
      }
    }
    return getLicenseStatus();
  });

  ipcMain.handle("license:refresh", async () => {
    const config = getEffectiveLanConfig();
    if (config.mode === "client") {
      try {
        const resolvedConfig = await resolveClientLanConfig(config);
        const remoteStatus = await refreshLicenseFromLan(resolvedConfig);
        if (remoteStatus) {
          return remoteStatus;
        }
      } catch (error) {
        return {
          status: "blocked",
          reason: "lan-server-unreachable",
          installationId: "desconocida (modo cliente)",
          nowIso: new Date().toISOString(),
          warningStartAt: null,
          blockAt: null,
          daysUntilBlock: 0,
          periodLabel: null,
          lastSyncAt: null,
          lastError: error instanceof Error ? error.message : "No fue posible conectar con el servidor LAN.",
          insecureMode: false,
        };
      }
    }
    return refreshLicense("manual");
  });
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

  registerAuthIpcHandlers(authStore, mirrorAuthUser, {
    getLanConfig: getEffectiveLanConfig,
    resolveClientLanConfig,
  });
  registerDbIpcHandlers(authStore);
  registerLicenseIpcHandlers();

  if (!isDevelopment) {
    registerAppProtocol();
  }

  createSystemTray();
  createMainWindow();
  initializeAutoUpdater({
    isDevelopment,
    getMainWindow: () => mainWindow,
  });
  applyLanServerMode(authStore);
  const effectiveLanConfig = getEffectiveLanConfig();
  if (effectiveLanConfig.mode !== "client") {
    initializeLicenseService({ refreshIntervalMs: 5 * 60 * 1000 });
  }
  startSyncInterval(30000); // Check outbox every 30 seconds
  startBcvRateSyncInterval(60 * 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    stopLanOrderServer();
    stopLicenseService();
    stopSyncInterval();
    stopBcvRateSyncInterval();
    if (process.platform !== "darwin") {
      app.quit();
    }
  }
});

