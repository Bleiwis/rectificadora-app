import { describe, it, expect, beforeAll, vi } from "vitest";

// Mock better-sqlite3 to run unit tests in standard node environment 
// without binary binding conflicts.
vi.mock("better-sqlite3", () => {
  return {
    default: class MockDatabase {
      constructor() {
        this.store = {
          services: {},
          inventory: {},
          clients: {},
          orders: {},
          sync_outbox: {},
        };
      }
      pragma() {}
      exec() {}
      prepare(query) {
        return {
          all: () => {
            if (query.includes("FROM services")) {
              return Object.values(this.store.services);
            }
            if (query.includes("FROM inventory")) {
              return Object.values(this.store.inventory);
            }
            if (query.includes("FROM clients")) {
              const sorted = Object.values(this.store.clients).sort((a, b) =>
                String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
              );
              return sorted;
            }
            if (query.includes("FROM orders")) {
              return Object.values(this.store.orders);
            }
            if (query.includes("FROM sync_outbox")) {
              return Object.values(this.store.sync_outbox);
            }
            return [];
          },
          get: (id) => {
            if (query.includes("FROM services")) return this.store.services[id] || null;
            if (query.includes("FROM inventory")) return this.store.inventory[id] || null;
            if (query.includes("FROM clients WHERE docNormalized")) {
              const values = Object.values(this.store.clients);
              return values.find((c) => c.docNormalized === id) || null;
            }
            if (query.includes("FROM orders")) return this.store.orders[id] || null;
            return null;
          },
          run: (...args) => {
            if (query.includes("INSERT INTO services") || query.includes("UPDATE services")) {
              const s = query.includes("INSERT") 
                ? { id: args[0], name: args[1], category: args[2], description: args[3], priceUSD: args[4] }
                : { id: args[4], name: args[0], category: args[1], description: args[2], priceUSD: args[3] };
              this.store.services[s.id] = s;
            }
            if (query.includes("INSERT INTO inventory") || query.includes("UPDATE inventory")) {
              const item = query.includes("INSERT")
                ? { id: args[0], name: args[1], category: args[2], priceUSD: args[3], quantity: args[4], minStock: args[5], description: args[6] }
                : { id: args[6], name: args[0], category: args[1], priceUSD: args[2], quantity: args[3], minStock: args[4], description: args[5] };
              this.store.inventory[item.id] = item;
            }
            if (query.includes("INSERT INTO clients")) {
              const incoming = {
                id: args[0],
                docType: args[1],
                docNumber: args[2],
                docNormalized: args[3],
                firstName: args[4],
                lastName: args[5],
                phone: args[6],
                address: args[7],
                createdAt: args[8],
                updatedAt: args[9],
              };

              const existing = Object.values(this.store.clients).find(
                (c) => c.docNormalized === incoming.docNormalized,
              );
              const id = existing ? existing.id : incoming.id;
              this.store.clients[id] = {
                ...(this.store.clients[id] || {}),
                ...incoming,
                id,
                createdAt: this.store.clients[id]?.createdAt || incoming.createdAt,
              };
            }
            if (query.includes("INSERT INTO orders") || query.includes("UPDATE orders")) {
              const o = query.includes("INSERT")
                ? { id: args[0], code: args[1], clientId: args[2], clientName: args[3], clientLastName: args[4], clientCI: args[5], clientPhone: args[6], clientAddress: args[7], engineModel: args[8], parts: args[9], services: args[10], inventoryItems: args[11], totalUSD: args[12], totalVES: args[13], paidUSD: args[14], balanceUSD: args[15], entryDate: args[16], deliveryDays: args[17], tentativeDeliveryDate: args[18], paymentStatus: args[19], orderStatus: args[20], priority: args[21], responsible: args[22], createdBy: args[23], createdByUserId: args[24] }
                : { id: args[24], code: args[0], clientId: args[1], clientName: args[2], clientLastName: args[3], clientCI: args[4], clientPhone: args[5], clientAddress: args[6], engineModel: args[7], parts: args[8], services: args[9], inventoryItems: args[10], totalUSD: args[11], totalVES: args[12], paidUSD: args[13], balanceUSD: args[14], entryDate: args[15], deliveryDays: args[16], tentativeDeliveryDate: args[17], paymentStatus: args[18], orderStatus: args[19], priority: args[20], responsible: args[21], createdBy: args[22], createdByUserId: args[23] };
              this.store.orders[o.id] = {
                ...o,
                parts: typeof o.parts === "string" ? o.parts : JSON.stringify(o.parts),
                services: typeof o.services === "string" ? o.services : JSON.stringify(o.services),
                inventoryItems: typeof o.inventoryItems === "string" ? o.inventoryItems : JSON.stringify(o.inventoryItems || []),
                orderStatus: o.orderStatus || "Ingresado",
              };
            }
            if (query.includes("INSERT INTO sync_outbox")) {
              const id = Object.keys(this.store.sync_outbox).length + 1;
              this.store.sync_outbox[id] = { id, action: args[0], entity: args[1], entityId: args[2], payload: args[3], status: "pending" };
            }
            return { changes: 1 };
          }
        };
      }
    }
  };
});

import { initDatabase, servicesRepo, inventoryRepo, ordersRepo, outboxRepo, clientsRepo } from "../electron/main/db.js";

describe("SQLite Database Repositories", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  it("should create and retrieve services", () => {
    const service = {
      id: "s_test_1",
      name: "Prueba Rectificado",
      category: "Culata",
      description: "Prueba",
      priceUSD: 120.5,
    };

    servicesRepo.save(service);
    const all = servicesRepo.getAll();
    
    expect(all.length).toBeGreaterThanOrEqual(1);
    const retrieved = all.find((s) => s.id === service.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.name).toBe(service.name);
    expect(retrieved.priceUSD).toBe(service.priceUSD);
  });

  it("should create and retrieve inventory items", () => {
    const item = {
      id: "i_test_1",
      name: "Pistón Ranger 3.0",
      category: "Pistones",
      priceUSD: 45.0,
      quantity: 10,
      minStock: 4,
      description: "Pistón Ranger original",
    };

    inventoryRepo.save(item);
    const all = inventoryRepo.getAll();

    expect(all.length).toBeGreaterThanOrEqual(1);
    const retrieved = all.find((i) => i.id === item.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.name).toBe(item.name);
    expect(retrieved.quantity).toBe(item.quantity);
  });

  it("should create and retrieve orders, and queue to outbox", () => {
    const order = {
      id: "o_test_1",
      code: "0001",
      clientId: null,
      clientName: "Pedro",
      clientLastName: "Gomez",
      clientCI: "V-11223344",
      clientPhone: "0412-5555555",
      clientAddress: "Av. Falsa 123",
      engineModel: "Toyota D4D",
      parts: [{ partName: "Bloque", quantity: 1, measurement: "Std" }],
      services: [{ name: "Baño Químico", priceUSD: 20 }],
      inventoryItems: [],
      totalUSD: 20,
      totalVES: 730,
      entryDate: "2026-07-11",
      deliveryDays: 3,
      tentativeDeliveryDate: "2026-07-14",
      paymentStatus: "Pendiente por cobrar",
      orderStatus: "Ingresado",
      priority: "Media",
      responsible: "",
      createdBy: "Administrador",
      createdByUserId: null,
    };

    ordersRepo.save(order);
    const all = ordersRepo.getAll();

    expect(all.length).toBeGreaterThanOrEqual(1);
    const retrieved = all.find((o) => o.id === order.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.clientName).toBe(order.clientName);
    expect(retrieved.parts[0].partName).toBe("Bloque");

    // Check outbox queue
    const pending = outboxRepo.getPending();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    const orderLog = pending.find((p) => p.entity === "orders" && p.entityId === order.id);
    expect(orderLog).toBeDefined();
    expect(orderLog.action).toBe("INSERT");
  });

  it("should upsert clients by normalized document without duplicates", () => {
    const first = clientsRepo.upsert({
      docType: "V",
      docNumber: "12345678",
      firstName: "Ana",
      lastName: "Ruiz",
      phone: "04120000000",
      address: "Centro",
    });

    const second = clientsRepo.upsert({
      docNormalized: "V-12345678",
      firstName: "Ana Maria",
      lastName: "Ruiz",
      phone: "04129999999",
      address: "Centro Norte",
    });

    const allClients = clientsRepo.getAll().filter((c) => c.docNormalized === "V-12345678");
    expect(first.id).toBe(second.id);
    expect(allClients.length).toBe(1);
    expect(allClients[0].firstName).toBe("Ana Maria");
  });
});
