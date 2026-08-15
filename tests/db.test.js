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
          order_payments: {},
          order_part_deliveries: {},
          order_sequence_state: null,
          sync_outbox: {},
        };
      }
      pragma() {}
      exec() {}
      transaction(callback) {
        return (...args) => callback(...args);
      }
      prepare(query) {
        const compactQuery = String(query).replace(/\s+/g, " ").trim();

        return {
          all: (param) => {
            if (compactQuery.includes("FROM services")) {
              return Object.values(this.store.services);
            }
            if (compactQuery.includes("FROM inventory")) {
              return Object.values(this.store.inventory);
            }
            if (compactQuery.includes("FROM clients")) {
              const sorted = Object.values(this.store.clients).sort((a, b) =>
                String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
              );
              return sorted;
            }
            if (compactQuery.includes("FROM orders")) {
              return Object.values(this.store.orders);
            }
            if (compactQuery.includes("FROM sync_outbox")) {
              return Object.values(this.store.sync_outbox);
            }
            if (compactQuery.includes("FROM order_payments WHERE orderId = ?")) {
              return Object.values(this.store.order_payments)
                .filter((row) => row.orderId === param)
                .sort((a, b) => String(a.paidAt).localeCompare(String(b.paidAt)));
            }
            if (compactQuery.includes("FROM order_part_deliveries WHERE orderId = ? ORDER BY deliveredAt ASC")) {
              return Object.values(this.store.order_part_deliveries)
                .filter((row) => row.orderId === param)
                .sort((a, b) => String(a.deliveredAt).localeCompare(String(b.deliveredAt)));
            }
            if (compactQuery.includes("FROM order_part_deliveries") && compactQuery.includes("GROUP BY partIndex")) {
              const grouped = new Map();
              Object.values(this.store.order_part_deliveries)
                .filter((row) => row.orderId === param)
                .forEach((row) => {
                  const key = Number(row.partIndex);
                  const previous = Number(grouped.get(key) || 0);
                  grouped.set(key, previous + Number(row.quantity || 0));
                });

              return Array.from(grouped.entries()).map(([partIndex, deliveredQty]) => ({
                partIndex,
                deliveredQty,
              }));
            }
            return [];
          },
          get: (id) => {
            if (compactQuery.includes("FROM services")) return this.store.services[id] || null;
            if (compactQuery.includes("FROM inventory")) return this.store.inventory[id] || null;
            if (compactQuery.includes("FROM clients WHERE docNormalized")) {
              const values = Object.values(this.store.clients);
              return values.find((c) => c.docNormalized === id) || null;
            }
            if (compactQuery.includes("FROM orders")) return this.store.orders[id] || null;
            if (compactQuery.includes("FROM order_sequence_state WHERE id = 1")) {
              return this.store.order_sequence_state;
            }
            return null;
          },
          run: (...args) => {
            if (compactQuery.includes("UPDATE inventory SET quantity = ? WHERE id = ?")) {
              const [quantity, id] = args;
              const current = this.store.inventory[id];
              if (current) {
                this.store.inventory[id] = {
                  ...current,
                  quantity,
                };
              }
              return { changes: 1 };
            }

            if (compactQuery.includes("UPDATE orders SET paidUSD = ?, balanceUSD = ?, paymentStatus = ? WHERE id = ?")) {
              const [paidUSD, balanceUSD, paymentStatus, id] = args;
              const current = this.store.orders[id];
              if (current) {
                this.store.orders[id] = {
                  ...current,
                  paidUSD,
                  balanceUSD,
                  paymentStatus,
                };
              }
              return { changes: 1 };
            }

            if (compactQuery.includes("UPDATE orders SET orderStatus = ? WHERE id = ?")) {
              const [orderStatus, id] = args;
              const current = this.store.orders[id];
              if (current) {
                this.store.orders[id] = {
                  ...current,
                  orderStatus,
                };
              }
              return { changes: 1 };
            }

            if (compactQuery.includes("INSERT INTO order_payments")) {
              const payment = {
                id: args[0],
                orderId: args[1],
                paidAt: args[2],
                currency: args[3],
                amount: args[4],
                paidUSD: args[5],
                paidVES: args[6],
                exchangeRate: args[7],
                note: args[8],
                createdBy: args[9],
                createdByUserId: args[10],
              };
              this.store.order_payments[payment.id] = payment;
              return { changes: 1 };
            }

            if (compactQuery.includes("INSERT INTO order_part_deliveries")) {
              const delivery = {
                id: args[0],
                orderId: args[1],
                partIndex: args[2],
                quantity: args[3],
                note: args[4],
                deliveredAt: args[5],
                createdBy: args[6],
                createdByUserId: args[7],
              };
              this.store.order_part_deliveries[delivery.id] = delivery;
              return { changes: 1 };
            }

            if (compactQuery.includes("INSERT INTO order_sequence_state")) {
              this.store.order_sequence_state = {
                id: 1,
                prefix: args[0],
                nextValue: compactQuery.includes("VALUES (1, ?, 2, ?)") ? 2 : 1,
                updatedAt: args[1],
              };
              return { changes: 1 };
            }

            if (compactQuery.includes("UPDATE order_sequence_state SET nextValue = ?, updatedAt = ? WHERE id = 1")) {
              if (this.store.order_sequence_state) {
                this.store.order_sequence_state = {
                  ...this.store.order_sequence_state,
                  nextValue: args[0],
                  updatedAt: args[1],
                };
              }
              return { changes: 1 };
            }

            if (compactQuery.includes("INSERT INTO services") || compactQuery.includes("UPDATE services")) {
              const s = compactQuery.includes("INSERT") 
                ? { id: args[0], name: args[1], category: args[2], description: args[3], priceUSD: args[4] }
                : { id: args[4], name: args[0], category: args[1], description: args[2], priceUSD: args[3] };
              this.store.services[s.id] = s;
            }
            if (compactQuery.includes("INSERT INTO inventory") || compactQuery.includes("UPDATE inventory")) {
              const item = compactQuery.includes("INSERT")
                ? { id: args[0], name: args[1], category: args[2], priceUSD: args[3], quantity: args[4], minStock: args[5], description: args[6] }
                : { id: args[6], name: args[0], category: args[1], priceUSD: args[2], quantity: args[3], minStock: args[4], description: args[5] };
              this.store.inventory[item.id] = item;
            }
            if (compactQuery.includes("INSERT INTO clients")) {
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
            if (compactQuery.includes("UPDATE orders SET code = ?")) {
              const updated = {
                id: args[28],
                code: args[0],
                clientId: args[1],
                clientName: args[2],
                clientLastName: args[3],
                clientCI: args[4],
                clientPhone: args[5],
                clientAddress: args[6],
                engineModel: args[7],
                parts: args[8],
                services: args[9],
                inventoryItems: args[10],
                totalUSD: args[11],
                totalVES: args[12],
                paidUSD: args[13],
                balanceUSD: args[14],
                entryDate: args[15],
                deliveryDays: args[16],
                tentativeDeliveryDate: args[17],
                paymentStatus: args[18],
                orderStatus: args[19],
                cancelReason: args[20],
                canceledAt: args[21],
                canceledBy: args[22],
                canceledByUserId: args[23],
                priority: args[24],
                responsible: args[25],
                createdBy: args[26],
                createdByUserId: args[27],
              };
              this.store.orders[updated.id] = {
                ...updated,
                parts: typeof updated.parts === "string" ? updated.parts : JSON.stringify(updated.parts),
                services: typeof updated.services === "string" ? updated.services : JSON.stringify(updated.services),
                inventoryItems:
                  typeof updated.inventoryItems === "string"
                    ? updated.inventoryItems
                    : JSON.stringify(updated.inventoryItems || []),
                orderStatus: updated.orderStatus || "Ingresado",
              };
              return { changes: 1 };
            }
            if (compactQuery.includes("INSERT INTO orders")) {
              const o = {
                id: args[0],
                code: args[1],
                clientId: args[2],
                clientName: args[3],
                clientLastName: args[4],
                clientCI: args[5],
                clientPhone: args[6],
                clientAddress: args[7],
                engineModel: args[8],
                parts: args[9],
                services: args[10],
                inventoryItems: args[11],
                totalUSD: args[12],
                totalVES: args[13],
                paidUSD: args[14],
                balanceUSD: args[15],
                entryDate: args[16],
                deliveryDays: args[17],
                tentativeDeliveryDate: args[18],
                paymentStatus: args[19],
                orderStatus: args[20],
                cancelReason: args[21],
                canceledAt: args[22],
                canceledBy: args[23],
                canceledByUserId: args[24],
                priority: args[25],
                responsible: args[26],
                createdBy: args[27],
                createdByUserId: args[28],
              };
              this.store.orders[o.id] = {
                ...o,
                parts: typeof o.parts === "string" ? o.parts : JSON.stringify(o.parts),
                services: typeof o.services === "string" ? o.services : JSON.stringify(o.services),
                inventoryItems: typeof o.inventoryItems === "string" ? o.inventoryItems : JSON.stringify(o.inventoryItems || []),
                orderStatus: o.orderStatus || "Ingresado",
              };
            }
            if (compactQuery.includes("INSERT INTO sync_outbox")) {
              const id = Object.keys(this.store.sync_outbox).length + 1;
              this.store.sync_outbox[id] = { id, action: args[0], entity: args[1], entityId: args[2], payload: args[3], status: "pending" };
            }
            if (compactQuery.includes("DELETE FROM services WHERE id = ?")) {
              delete this.store.services[args[0]];
            }
            if (compactQuery.includes("DELETE FROM inventory WHERE id = ?")) {
              delete this.store.inventory[args[0]];
            }
            if (compactQuery.includes("DELETE FROM orders WHERE id = ?")) {
              delete this.store.orders[args[0]];
            }
            if (compactQuery.includes("UPDATE sync_outbox SET status = 'synced'")) {
              const row = this.store.sync_outbox[args[0]];
              if (row) {
                row.status = "synced";
                row.attempts = Number(row.attempts || 0) + 1;
                row.error = null;
              }
            }
            if (compactQuery.includes("UPDATE sync_outbox SET status = 'failed'")) {
              const row = this.store.sync_outbox[args[1]];
              if (row) {
                row.status = "failed";
                row.attempts = Number(row.attempts || 0) + 1;
                row.error = args[0];
              }
            }
            return { changes: 1 };
          }
        };
      }
    }
  };
});

import {
  initDatabase,
  servicesRepo,
  inventoryRepo,
  ordersRepo,
  outboxRepo,
  clientsRepo,
  orderPaymentsRepo,
  orderPartDeliveriesRepo,
} from "../electron/main/db.js";

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

  it("should register payments and transition payment status correctly", () => {
    const order = {
      id: "o_pay_1",
      code: "0100",
      clientId: null,
      clientName: "Mario",
      clientLastName: "Perez",
      clientCI: "V-99887766",
      clientPhone: "0414-1111111",
      clientAddress: "Zona Industrial",
      engineModel: "Isuzu 4HK1",
      parts: [{ partName: "Cigueñal", quantity: 1, measurement: "Std" }],
      services: [{ name: "Rectificado", priceUSD: 100 }],
      inventoryItems: [],
      totalUSD: 100,
      totalVES: 0,
      paidUSD: 0,
      balanceUSD: 100,
      entryDate: "2026-07-12",
      deliveryDays: 2,
      tentativeDeliveryDate: "2026-07-14",
      paymentStatus: "Pendiente por cobrar",
      orderStatus: "Ingresado",
      priority: "Alta",
      responsible: "",
      createdBy: "Administrador",
      createdByUserId: null,
    };

    ordersRepo.save(order);

    const firstPayment = orderPaymentsRepo.addPayment(order.id, {
      currency: "USD",
      amount: 40,
      paidAt: "2026-07-12T09:00:00.000Z",
      createdBy: "Administrador",
    });

    expect(firstPayment.order.paidUSD).toBe(40);
    expect(firstPayment.order.balanceUSD).toBe(60);
    expect(firstPayment.order.paymentStatus).toBe("Abonada");

    const secondPayment = orderPaymentsRepo.addPayment(order.id, {
      currency: "USD",
      amount: 80,
      paidAt: "2026-07-12T10:00:00.000Z",
      createdBy: "Administrador",
    });

    expect(secondPayment.order.paidUSD).toBe(100);
    expect(secondPayment.order.balanceUSD).toBe(0);
    expect(secondPayment.order.paymentStatus).toBe("Paga");

    const payments = orderPaymentsRepo.getByOrderId(order.id);
    expect(payments).toHaveLength(2);
  });

  it("should reject VES payments without exchange rate", () => {
    const order = {
      id: "o_pay_2",
      code: "0101",
      clientId: null,
      clientName: "Jose",
      clientLastName: "Diaz",
      clientCI: "V-88776655",
      clientPhone: "0414-2222222",
      clientAddress: "Centro",
      engineModel: "Cummins",
      parts: [{ partName: "Bloque", quantity: 1, measurement: "Std" }],
      services: [{ name: "Limpieza", priceUSD: 50 }],
      inventoryItems: [],
      totalUSD: 50,
      totalVES: 0,
      paidUSD: 0,
      balanceUSD: 50,
      entryDate: "2026-07-12",
      deliveryDays: 2,
      tentativeDeliveryDate: "2026-07-14",
      paymentStatus: "Pendiente por cobrar",
      orderStatus: "Ingresado",
      priority: "Media",
      responsible: "",
      createdBy: "Administrador",
      createdByUserId: null,
    };

    ordersRepo.save(order);

    expect(() => {
      orderPaymentsRepo.addPayment(order.id, {
        currency: "VES",
        amount: 1000,
      });
    }).toThrow("Debes indicar una tasa BCV válida para pagos en bolívares.");
  });

  it("should update order status from partial to full delivery", () => {
    const order = {
      id: "o_delivery_1",
      code: "0200",
      clientId: null,
      clientName: "Luis",
      clientLastName: "Rojas",
      clientCI: "V-55443322",
      clientPhone: "0412-3333333",
      clientAddress: "Norte",
      engineModel: "Perkins",
      parts: [
        { partName: "Bloque", quantity: 2, measurement: "Std" },
        { partName: "Culata", quantity: 1, measurement: "Std" },
      ],
      services: [{ name: "Soldadura", priceUSD: 70 }],
      inventoryItems: [],
      totalUSD: 70,
      totalVES: 0,
      paidUSD: 0,
      balanceUSD: 70,
      entryDate: "2026-07-12",
      deliveryDays: 4,
      tentativeDeliveryDate: "2026-07-16",
      paymentStatus: "Pendiente por cobrar",
      orderStatus: "Ingresado",
      priority: "Media",
      responsible: "",
      createdBy: "Administrador",
      createdByUserId: null,
    };

    ordersRepo.save(order);

    const firstDelivery = orderPartDeliveriesRepo.addDeliveries(order.id, {
      deliveries: [{ partIndex: 0, quantity: 1 }],
      createdBy: "Administrador",
    });
    expect(firstDelivery.order.orderStatus).toBe("Parcialmente retirado");

    const secondDelivery = orderPartDeliveriesRepo.addDeliveries(order.id, {
      deliveries: [
        { partIndex: 0, quantity: 1 },
        { partIndex: 1, quantity: 1 },
      ],
      createdBy: "Administrador",
    });
    expect(secondDelivery.order.orderStatus).toBe("Retirado");

    const deliveries = orderPartDeliveriesRepo.getByOrderId(order.id);
    expect(deliveries).toHaveLength(3);
  });

  it("should prevent delivering the same part beyond admitted quantity", () => {
    const order = {
      id: "o_delivery_2",
      code: "0201",
      clientId: null,
      clientName: "Carlos",
      clientLastName: "Soto",
      clientCI: "V-44332211",
      clientPhone: "0416-4444444",
      clientAddress: "Sur",
      engineModel: "Yanmar",
      parts: [{ partName: "Biela", quantity: 1, measurement: "Std" }],
      services: [{ name: "Alineacion", priceUSD: 30 }],
      inventoryItems: [],
      totalUSD: 30,
      totalVES: 0,
      paidUSD: 0,
      balanceUSD: 30,
      entryDate: "2026-07-12",
      deliveryDays: 1,
      tentativeDeliveryDate: "2026-07-13",
      paymentStatus: "Pendiente por cobrar",
      orderStatus: "Ingresado",
      priority: "Baja",
      responsible: "",
      createdBy: "Administrador",
      createdByUserId: null,
    };

    ordersRepo.save(order);

    orderPartDeliveriesRepo.addDeliveries(order.id, {
      deliveries: [{ partIndex: 0, quantity: 1 }],
      createdBy: "Administrador",
    });

    expect(() => {
      orderPartDeliveriesRepo.addDeliveries(order.id, {
        deliveries: [{ partIndex: 0, quantity: 1 }],
        createdBy: "Administrador",
      });
    }).toThrow(/ya fue retirada completamente/i);
  });
});
