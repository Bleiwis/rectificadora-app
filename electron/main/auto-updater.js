import { app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { UPDATER_CHANNELS } from "../shared/updater-channels.js";

const state = {
  enabled: false,
  disabledReason: "not-initialized",
  checking: false,
  available: false,
  downloaded: false,
  currentVersion: "0.0.0",
  latestVersion: null,
  downloadedVersion: null,
  lastCheckedAt: null,
  lastError: null,
};

let getMainWindowRef = () => null;
let ipcRegistered = false;
let listenersBound = false;

function snapshotState() {
  return {
    ...state,
  };
}

function setState(patch) {
  Object.assign(state, patch);
}

function resolveErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Error desconocido en auto-actualización.";
}

function emitUpdaterEvent(type, payload = {}) {
  const win = getMainWindowRef();
  if (!win || win.isDestroyed()) return;

  win.webContents.send(UPDATER_CHANNELS.event, {
    type,
    payload,
    state: snapshotState(),
    at: new Date().toISOString(),
  });
}

async function checkForUpdatesSafe(manual = false) {
  if (!state.enabled) {
    return {
      ok: false,
      reason: state.disabledReason,
    };
  }

  if (state.checking) {
    return {
      ok: false,
      reason: "already-checking",
    };
  }

  setState({
    checking: true,
    lastError: null,
  });
  emitUpdaterEvent("checking", { manual });

  try {
    const result = await autoUpdater.checkForUpdates();
    const checkedAt = new Date().toISOString();
    setState({
      checking: false,
      lastCheckedAt: checkedAt,
    });

    emitUpdaterEvent("checked", {
      manual,
      updateInfo: result?.updateInfo || null,
    });

    return {
      ok: true,
      updateInfo: result?.updateInfo || null,
      checkedAt,
    };
  } catch (error) {
    const message = resolveErrorMessage(error);
    setState({
      checking: false,
      lastError: message,
      lastCheckedAt: new Date().toISOString(),
    });
    emitUpdaterEvent("error", { manual, message });

    return {
      ok: false,
      reason: "check-failed",
      message,
    };
  }
}

function bindUpdaterListeners() {
  if (listenersBound) return;

  autoUpdater.on("checking-for-update", () => {
    setState({
      checking: true,
      lastError: null,
    });
    emitUpdaterEvent("checking");
  });

  autoUpdater.on("update-available", (info) => {
    setState({
      checking: false,
      available: true,
      downloaded: false,
      latestVersion: info?.version || null,
      downloadedVersion: null,
      lastError: null,
      lastCheckedAt: new Date().toISOString(),
    });
    emitUpdaterEvent("available", { info });
  });

  autoUpdater.on("update-not-available", (info) => {
    setState({
      checking: false,
      available: false,
      downloaded: false,
      latestVersion: null,
      downloadedVersion: null,
      lastError: null,
      lastCheckedAt: new Date().toISOString(),
    });
    emitUpdaterEvent("not-available", { info });
  });

  autoUpdater.on("download-progress", (progress) => {
    emitUpdaterEvent("download-progress", { progress });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setState({
      checking: false,
      available: true,
      downloaded: true,
      latestVersion: info?.version || state.latestVersion,
      downloadedVersion: info?.version || state.latestVersion,
      lastError: null,
    });
    emitUpdaterEvent("downloaded", { info });
  });

  autoUpdater.on("error", (error) => {
    const message = resolveErrorMessage(error);
    setState({
      checking: false,
      lastError: message,
      lastCheckedAt: new Date().toISOString(),
    });
    emitUpdaterEvent("error", { message });
  });

  listenersBound = true;
}

function registerUpdaterIpc() {
  if (ipcRegistered) return;

  ipcMain.handle(UPDATER_CHANNELS.getState, () => snapshotState());
  ipcMain.handle(UPDATER_CHANNELS.checkForUpdates, () => checkForUpdatesSafe(true));
  ipcMain.handle(UPDATER_CHANNELS.quitAndInstall, () => {
    if (!state.enabled) {
      return {
        ok: false,
        reason: state.disabledReason,
      };
    }

    if (!state.downloaded) {
      return {
        ok: false,
        reason: "update-not-downloaded",
      };
    }

    emitUpdaterEvent("installing", {
      version: state.downloadedVersion || state.latestVersion,
    });

    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 250);

    return {
      ok: true,
    };
  });

  ipcRegistered = true;
}

export function initializeAutoUpdater({ isDevelopment, getMainWindow }) {
  getMainWindowRef = typeof getMainWindow === "function" ? getMainWindow : () => null;
  setState({
    currentVersion: app.getVersion(),
  });

  registerUpdaterIpc();

  const disabledReason =
    process.env.DISABLE_AUTO_UPDATER === "1"
      ? "disabled-by-env"
      : isDevelopment || !app.isPackaged
        ? "development-mode"
        : null;

  if (disabledReason) {
    setState({
      enabled: false,
      disabledReason,
    });
    emitUpdaterEvent("disabled", { reason: disabledReason });
    return;
  }

  setState({
    enabled: true,
    disabledReason: null,
    lastError: null,
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = process.env.AUTO_UPDATER_ALLOW_PRERELEASE === "1";

  bindUpdaterListeners();

  // Let the app stabilize before checking network/update feed on startup.
  setTimeout(() => {
    void checkForUpdatesSafe(false);
  }, 15000);
}
