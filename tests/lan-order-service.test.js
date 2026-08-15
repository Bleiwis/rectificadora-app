import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedDeps = vi.hoisted(() => ({
  orderCodeRepo: {
    getNextCode: vi.fn(),
  },
  ordersRepo: {
    createWithInventoryDeduction: vi.fn(),
    getAll: vi.fn(),
  },
  servicesRepo: {
    getAll: vi.fn(),
  },
  inventoryRepo: {
    getAll: vi.fn(),
  },
  getLicenseStatus: vi.fn(),
  refreshLicense: vi.fn(),
}));

vi.mock("../electron/main/db.js", () => ({
  orderCodeRepo: mockedDeps.orderCodeRepo,
  ordersRepo: mockedDeps.ordersRepo,
  servicesRepo: mockedDeps.servicesRepo,
  inventoryRepo: mockedDeps.inventoryRepo,
}));

vi.mock("../electron/main/license-service.js", () => ({
  getLicenseStatus: mockedDeps.getLicenseStatus,
  refreshLicense: mockedDeps.refreshLicense,
}));

import {
  checkUsernameFromLan,
  createOrderThroughLan,
  forceResetPasswordFromLan,
  getBootstrapStateFromLan,
  getInventoryFromLan,
  getLanOrderServerStatus,
  getLicenseStatusFromLan,
  getNextOrderCodeFromLan,
  getOrdersFromLan,
  getServicesFromLan,
  getUserByIdFromLan,
  pingLanServer,
  refreshLicenseFromLan,
  setInitialPasswordFromLan,
  signInFromLan,
  startLanOrderServer,
  stopLanOrderServer,
} from "../electron/main/lan-order-service.js";

let nextPort = 56000 + Math.floor(Math.random() * 1000);

function allocatePort() {
  nextPort += 3;
  return nextPort;
}

async function waitForLanReady(timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getLanOrderServerStatus().running) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("El servidor LAN no se marco como listo a tiempo.");
}

describe("LAN order service synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopLanOrderServer();
  });

  it("should sync health, order creation, and catalog endpoints over LAN", async () => {
    const port = allocatePort();
    const discoveryPort = allocatePort();
    const lanConfig = { host: "127.0.0.1", port, token: "secreto" };

    mockedDeps.orderCodeRepo.getNextCode.mockReturnValue("0042");
    mockedDeps.ordersRepo.createWithInventoryDeduction.mockImplementation((order) => ({
      ...order,
      code: "0042",
      orderStatus: "Ingresado",
    }));
    mockedDeps.ordersRepo.getAll.mockReturnValue([{ id: "o_1", code: "0042" }]);
    mockedDeps.servicesRepo.getAll.mockReturnValue([{ id: "s_1", name: "Rectificado" }]);
    mockedDeps.inventoryRepo.getAll.mockReturnValue([{ id: "i_1", name: "Piston" }]);

    startLanOrderServer(
      { host: lanConfig.host, port, token: lanConfig.token, discoveryPort },
      null,
    );

    await waitForLanReady();

    await expect(pingLanServer(lanConfig)).resolves.toBe(true);
    await expect(getNextOrderCodeFromLan(lanConfig)).resolves.toBe("0042");

    const createdOrder = await createOrderThroughLan(lanConfig, {
      id: "o_1",
      clientName: "Pedro",
    });

    expect(createdOrder).toMatchObject({ id: "o_1", code: "0042" });
    expect(mockedDeps.ordersRepo.createWithInventoryDeduction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "o_1", code: "" }),
    );

    await expect(getOrdersFromLan(lanConfig)).resolves.toEqual([
      { id: "o_1", code: "0042" },
    ]);
    await expect(getServicesFromLan(lanConfig)).resolves.toEqual([
      { id: "s_1", name: "Rectificado" },
    ]);
    await expect(getInventoryFromLan(lanConfig)).resolves.toEqual([
      { id: "i_1", name: "Piston" },
    ]);

    const status = getLanOrderServerStatus();
    expect(status.running).toBe(true);
    expect(status.listenReady).toBe(true);
  });

  it("should reject unauthorized requests when token is invalid", async () => {
    const port = allocatePort();
    const discoveryPort = allocatePort();

    startLanOrderServer(
      { host: "127.0.0.1", port, token: "secreto", discoveryPort },
      null,
    );
    await waitForLanReady();

    await expect(
      pingLanServer({ host: "127.0.0.1", port, token: "token-malo" }),
    ).rejects.toThrow("No autorizado para usar el servidor LAN.");
  });

  it("should sync auth and license endpoints through LAN", async () => {
    const port = allocatePort();
    const discoveryPort = allocatePort();

    const authUser = {
      id: "u_1",
      username: "admin",
      role: "master",
      status: "active",
      requiresPasswordReset: false,
    };

    const authStore = {
      getBootstrapState: vi.fn(() => ({ hasMasterUser: true })),
      getSignInState: vi.fn(() => ({
        exists: true,
        hasPassword: true,
        isActive: true,
        requiresPasswordReset: false,
      })),
      signIn: vi.fn(() => authUser),
      setInitialPassword: vi.fn(() => authUser),
      getUserById: vi.fn(() => authUser),
      forceResetPassword: vi.fn(),
    };

    mockedDeps.getLicenseStatus.mockReturnValue({ valid: true, status: "ok" });
    mockedDeps.refreshLicense.mockResolvedValue({ valid: true, status: "refreshed" });

    startLanOrderServer({ host: "127.0.0.1", port, discoveryPort }, authStore);
    await waitForLanReady();

    const config = { host: "127.0.0.1", port, token: "" };

    await expect(getBootstrapStateFromLan(config)).resolves.toEqual({
      hasMasterUser: true,
    });

    await expect(checkUsernameFromLan(config, "admin")).resolves.toEqual({
      exists: true,
      hasPassword: true,
      isActive: true,
      requiresPasswordReset: false,
    });

    await expect(checkUsernameFromLan(config, "   ")).rejects.toThrow(
      "Usuario invalido.",
    );

    await expect(signInFromLan(config, { username: "admin", password: "123" })).resolves.toEqual(authUser);
    await expect(
      setInitialPasswordFromLan(config, {
        username: "admin",
        newPassword: "secreto123",
      }),
    ).resolves.toEqual(authUser);
    await expect(getUserByIdFromLan(config, "u_1")).resolves.toEqual(authUser);
    await expect(forceResetPasswordFromLan(config, "u_1", "nuevo123")).resolves.toEqual(authUser);

    expect(authStore.forceResetPassword).toHaveBeenCalledWith("u_1", "nuevo123");

    await expect(getLicenseStatusFromLan(config)).resolves.toEqual({
      valid: true,
      status: "ok",
    });
    await expect(refreshLicenseFromLan(config)).resolves.toEqual({
      valid: true,
      status: "refreshed",
    });
    expect(mockedDeps.refreshLicense).toHaveBeenCalledWith("lan-client-request");
  });

});
