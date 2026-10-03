import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const { ipcHandlers, sendMock, dialogMock, electronMock, mockAutoUpdater } = vi.hoisted(() => {
  const { EventEmitter } = require("node:events");
  const ipcHandlers = new Map();
  const sendMock = vi.fn();
  const dialogMock = {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  };
  const electronMock = {
    app: {
      getVersion: vi.fn(() => "2.3.0"),
      isPackaged: false,
      on: vi.fn(),
      quit: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn((channel, handler) => {
        ipcHandlers.set(channel, handler);
      }),
    },
    dialog: {
      showMessageBox: vi.fn((...args) => dialogMock.showMessageBox(...args)),
    },
  };

  const mockAutoUpdater = Object.assign(new EventEmitter(), {
    checkForUpdates: vi.fn().mockResolvedValue({ updateInfo: { version: "2.3.1" } }),
    quitAndInstall: vi.fn(),
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
  });

  return { ipcHandlers, sendMock, dialogMock, electronMock, mockAutoUpdater };
});

vi.mock("electron", () => ({
  ...electronMock,
  default: electronMock,
}));

vi.mock("electron-updater", () => ({
  default: { autoUpdater: mockAutoUpdater },
  autoUpdater: mockAutoUpdater,
}));

import { initializeAutoUpdater } from "../electron/main/auto-updater.js";
import { UPDATER_CHANNELS } from "../electron/shared/updater-channels.js";

describe("auto-updater ESM compatibility", () => {
  it("should not use named import { autoUpdater } from 'electron-updater' because it causes SyntaxError in Node ESM", () => {
    const filePath = resolve(process.cwd(), "electron/main/auto-updater.js");
    const fileContent = readFileSync(filePath, "utf-8");

    expect(fileContent).not.toMatch(/import\s*\{[^}]*\bautoUpdater\b[^}]*\}\s*from\s*["']electron-updater["']/);
  });

  it("reproduces that native Node ESM rejects named autoUpdater export from electron-updater", () => {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", "import { autoUpdater } from 'electron-updater';"],
      { encoding: "utf-8" }
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("SyntaxError");
    expect(result.stderr).toMatch(/autoUpdater/);
  });

  it("verifies that default import or CJS interop does not throw SyntaxError in Node ESM", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
        import electronUpdaterPkg from 'electron-updater';
        if (!electronUpdaterPkg) {
          throw new Error('electronUpdaterPkg not found');
        }
        process.exit(0);
        `,
      ],
      { encoding: "utf-8" }
    );
    expect(result.stderr).not.toContain("SyntaxError");
  });
});

describe("auto-updater runtime logic and IPC contracts", () => {
  const originalEnv = process.env.DISABLE_AUTO_UPDATER;

  beforeEach(() => {
    sendMock.mockClear();
    process.env.DISABLE_AUTO_UPDATER = "";
  });

  afterEach(() => {
    process.env.DISABLE_AUTO_UPDATER = originalEnv;
  });

  it("disables auto-updater in development mode and registers IPC handlers", () => {
    const mockWin = {
      isDestroyed: () => false,
      webContents: {
        send: sendMock,
      },
    };

    initializeAutoUpdater({
      isDevelopment: true,
      getMainWindow: () => mockWin,
    });

    expect(ipcHandlers.has(UPDATER_CHANNELS.getState)).toBe(true);
    expect(ipcHandlers.has(UPDATER_CHANNELS.checkForUpdates)).toBe(true);
    expect(ipcHandlers.has(UPDATER_CHANNELS.quitAndInstall)).toBe(true);

    const getStateHandler = ipcHandlers.get(UPDATER_CHANNELS.getState);
    const state = getStateHandler();

    expect(state.enabled).toBe(false);
    expect(state.disabledReason).toBe("development-mode");
    expect(state.currentVersion).toBe("2.3.0");

    // Event emitted to window
    expect(sendMock).toHaveBeenCalledWith(
      UPDATER_CHANNELS.event,
      expect.objectContaining({
        type: "disabled",
        payload: { reason: "development-mode" },
      })
    );
  });

  it("disables auto-updater when DISABLE_AUTO_UPDATER env is set to 1", () => {
    process.env.DISABLE_AUTO_UPDATER = "1";
    const mockWin = {
      isDestroyed: () => false,
      webContents: {
        send: sendMock,
      },
    };

    initializeAutoUpdater({
      isDevelopment: false,
      getMainWindow: () => mockWin,
    });

    const getStateHandler = ipcHandlers.get(UPDATER_CHANNELS.getState);
    const state = getStateHandler();

    expect(state.enabled).toBe(false);
    expect(state.disabledReason).toBe("disabled-by-env");
  });

  it("returns appropriate reason when checkForUpdates is invoked while disabled", async () => {
    const checkForUpdatesHandler = ipcHandlers.get(UPDATER_CHANNELS.checkForUpdates);
    const result = await checkForUpdatesHandler();

    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("returns appropriate reason when quitAndInstall is invoked while disabled", async () => {
    const quitAndInstallHandler = ipcHandlers.get(UPDATER_CHANNELS.quitAndInstall);
    const result = await quitAndInstallHandler();

    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("prompts the user with a dialog when an update is downloaded in production", async () => {
    const { app: mockedApp } = await import("electron");
    mockedApp.isPackaged = true;

    const mockWin = {
      isDestroyed: () => false,
      webContents: { send: sendMock },
    };

    initializeAutoUpdater({
      isDevelopment: false,
      getMainWindow: () => mockWin,
    });

    const electronUpdaterPkg = await import("electron-updater");
    const updater = electronUpdaterPkg.default?.autoUpdater || electronUpdaterPkg.autoUpdater;

    dialogMock.showMessageBox.mockClear();
    updater.emit("update-downloaded", { version: "2.3.1" });

    expect(dialogMock.showMessageBox).toHaveBeenCalledWith(
      mockWin,
      expect.objectContaining({
        type: "info",
        title: expect.stringContaining("Actualización"),
        message: expect.stringContaining("2.3.1"),
        buttons: expect.arrayContaining(["Reiniciar ahora", "Más tarde"]),
      })
    );
  });
});
