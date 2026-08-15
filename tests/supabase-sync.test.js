import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedDeps = vi.hoisted(() => {
  const counters = {
    services: 0,
    inventory: 0,
    clients: 0,
    orders: 0,
    order_payments: 0,
    order_part_deliveries: 0,
    app_users: 0,
  };

  const database = {
    prepare: vi.fn((query) => {
      const compact = String(query).replace(/\s+/g, " ").trim();
      return {
        run: vi.fn(() => {
          if (compact.includes("INSERT INTO services")) counters.services += 1;
          if (compact.includes("INSERT INTO inventory")) counters.inventory += 1;
          if (compact.includes("INSERT INTO clients")) counters.clients += 1;
          if (compact.includes("INSERT INTO orders")) counters.orders += 1;
          if (compact.includes("INSERT INTO order_payments")) counters.order_payments += 1;
          if (compact.includes("INSERT INTO order_part_deliveries")) counters.order_part_deliveries += 1;
          if (compact.includes("INSERT INTO app_users")) counters.app_users += 1;
          return { changes: 1 };
        }),
      };
    }),
  };

  return {
    fetchMock: vi.fn(),
    counters,
    resetCounters: () => {
      Object.keys(counters).forEach((key) => {
        counters[key] = 0;
      });
    },
    getDb: vi.fn(() => database),
    outboxRepo: {
      getPending: vi.fn(() => []),
      markSynced: vi.fn(),
      markFailed: vi.fn(),
    },
  };
});

vi.mock("../electron/main/db.js", () => ({
  getDb: mockedDeps.getDb,
  outboxRepo: mockedDeps.outboxRepo,
}));

describe("Supabase cloud restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDeps.resetCounters();
    global.fetch = mockedDeps.fetchMock;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "public-key";
    process.env.SUPABASE_SECRET_KEY = "secret-key";
  });

  it("should restore services and inventory from cloud", async () => {
    vi.resetModules();

    mockedDeps.fetchMock.mockImplementation(async (url) => {
      const raw = String(url);

      if (raw.includes("/rest/v1/services?limit=1") && !raw.includes("select=*")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(""),
          json: vi.fn().mockResolvedValue([]),
        };
      }

      if (raw.includes("/rest/v1/services?select=*&limit=500&offset=0")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(""),
          json: vi.fn().mockResolvedValue([
            { id: "s1", name: "Rectificado", category: "Motor", description: "", priceUSD: 12.5 },
            { id: "s2", name: "Limpieza", category: "General", description: "", priceUSD: 8.75 },
          ]),
        };
      }

      if (raw.includes("/rest/v1/services?select=*&limit=500&offset=500")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(""),
          json: vi.fn().mockResolvedValue([]),
        };
      }

      if (raw.includes("/rest/v1/inventory?select=*&limit=500&offset=0")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(""),
          json: vi.fn().mockResolvedValue([
            { id: "i1", name: "Piston", category: "Partes", priceUSD: 25, quantity: 3, minStock: 1, description: "" },
          ]),
        };
      }

      if (raw.includes("/rest/v1/inventory?select=*&limit=500&offset=500")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(""),
          json: vi.fn().mockResolvedValue([]),
        };
      }

      return {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
        json: vi.fn().mockResolvedValue([]),
      };
    });

    const service = await import("../electron/main/supabase-sync.js");

    const result = await service.restoreFromCloudBackup({
      tables: ["services", "inventory"],
    });

    expect(result.ok).toBe(true);
    expect(result.tables.services.status).toBe("ok");
    expect(result.tables.services.restored).toBe(2);
    expect(result.tables.inventory.status).toBe("ok");
    expect(result.tables.inventory.restored).toBe(1);

    expect(mockedDeps.counters.services).toBe(2);
    expect(mockedDeps.counters.inventory).toBe(1);
  });

  it("should skip missing remote tables without aborting restore", async () => {
    vi.resetModules();

    mockedDeps.fetchMock.mockImplementation(async (url) => {
      const raw = String(url);

      if (raw.includes("/rest/v1/services?limit=1") && !raw.includes("select=*")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(""),
          json: vi.fn().mockResolvedValue([]),
        };
      }

      if (raw.includes("/rest/v1/clients?select=*&limit=500&offset=0")) {
        return {
          ok: false,
          status: 404,
          text: vi.fn().mockResolvedValue("{\"code\":\"PGRST205\",\"message\":\"table missing\"}"),
          json: vi.fn().mockResolvedValue({}),
        };
      }

      return {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
        json: vi.fn().mockResolvedValue([]),
      };
    });

    const service = await import("../electron/main/supabase-sync.js");

    const result = await service.restoreFromCloudBackup({
      tables: ["clients"],
    });

    expect(result.ok).toBe(true);
    expect(result.tables.clients.status).toBe("skipped");
    expect(result.tables.clients.restored).toBe(0);
  });
});
