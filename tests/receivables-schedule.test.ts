import { describe, it, expect } from "vitest";
import {
  getOrderBalanceUSD,
  getOrderPaidUSD,
  getAgingDays,
  classifyAgingTier,
  getReceivablesStats,
  filterReceivables,
  generateWhatsAppReminder,
} from "../src/utils/receivablesSchedule";
import type { OrderItem } from "../src/components/pedidos/models/types";

const mockOrder = (overrides: Partial<OrderItem>): OrderItem => ({
  id: "order-1",
  code: "ORD-001",
  clientName: "Carlos",
  clientLastName: "Pérez",
  clientCI: "V-12345678",
  clientPhone: "0414-1234567",
  clientAddress: "Calle 1",
  engineModel: "Toyota 4.5",
  parts: [],
  services: [],
  totalUSD: 200,
  totalVES: 8000,
  paidUSD: 50,
  balanceUSD: 150,
  entryDate: "2026-09-15",
  deliveryDays: 3,
  tentativeDeliveryDate: "2026-09-18",
  paymentStatus: "Abonada",
  orderStatus: "Ingresado",
  priority: "Media",
  createdBy: "Admin",
  ...overrides,
});

describe("receivablesSchedule utility", () => {
  const refDate = "2026-10-02"; // Reference date

  describe("getOrderBalanceUSD & getOrderPaidUSD", () => {
    it("returns explicit balanceUSD when finite and positive", () => {
      const order = mockOrder({ totalUSD: 300, paidUSD: 100, balanceUSD: 200 });
      expect(getOrderBalanceUSD(order)).toBe(200);
      expect(getOrderPaidUSD(order)).toBe(100);
    });

    it("calculates balance as totalUSD - paidUSD when balanceUSD is missing", () => {
      const order = mockOrder({ totalUSD: 300, paidUSD: 100, balanceUSD: undefined });
      expect(getOrderBalanceUSD(order)).toBe(200);
    });

    it("returns 0 balance and full paid if paymentStatus is Paga", () => {
      const order = mockOrder({
        totalUSD: 300,
        paidUSD: undefined,
        balanceUSD: undefined,
        paymentStatus: "Paga",
      });
      expect(getOrderBalanceUSD(order)).toBe(0);
      expect(getOrderPaidUSD(order)).toBe(300);
    });

    it("returns 0 for canceled orders", () => {
      const order = mockOrder({
        totalUSD: 300,
        balanceUSD: 300,
        orderStatus: "Cancelada",
      });
      expect(getOrderBalanceUSD(order)).toBe(0);
    });
  });

  describe("getAgingDays", () => {
    it("computes elapsed days from tentativeDeliveryDate if provided", () => {
      // refDate is 2026-10-02, tentativeDeliveryDate is 2026-09-22 -> 10 days of delay
      const order = mockOrder({ tentativeDeliveryDate: "2026-09-22", entryDate: "2026-09-15" });
      expect(getAgingDays(order, refDate)).toBe(10);
    });

    it("falls back to entryDate if tentativeDeliveryDate is missing or in the future", () => {
      // tentativeDeliveryDate is in future (2026-10-05), entryDate is 2026-09-30 -> 2 days since entry
      const order = mockOrder({ tentativeDeliveryDate: "2026-10-05", entryDate: "2026-09-30" });
      expect(getAgingDays(order, refDate)).toBe(2);
    });
  });

  describe("classifyAgingTier", () => {
    it("classifies as critical if order is already Retirado with pending balance", () => {
      const order = mockOrder({
        orderStatus: "Retirado",
        paymentStatus: "Pendiente por cobrar",
        balanceUSD: 100,
        tentativeDeliveryDate: "2026-10-01",
      });
      expect(classifyAgingTier(order, refDate)).toBe("critical");
    });

    it("classifies based on aging days for orders still in workshop", () => {
      const current = mockOrder({ tentativeDeliveryDate: "2026-10-01" }); // 1 day
      expect(classifyAgingTier(current, refDate)).toBe("current");

      const early = mockOrder({ tentativeDeliveryDate: "2026-09-22" }); // 10 days
      expect(classifyAgingTier(early, refDate)).toBe("early_warning");

      const moderate = mockOrder({ tentativeDeliveryDate: "2026-09-12" }); // 20 days
      expect(classifyAgingTier(moderate, refDate)).toBe("moderate");

      const critical = mockOrder({ tentativeDeliveryDate: "2026-08-20" }); // 43 days
      expect(classifyAgingTier(critical, refDate)).toBe("critical");
    });
  });

  describe("getReceivablesStats", () => {
    it("aggregates totals, counts, and critical risk items", () => {
      const orders: OrderItem[] = [
        mockOrder({ id: "1", balanceUSD: 100, paidUSD: 50, paymentStatus: "Abonada", tentativeDeliveryDate: "2026-10-01" }), // current (100)
        mockOrder({ id: "2", balanceUSD: 200, paidUSD: 0, paymentStatus: "Pendiente por cobrar", tentativeDeliveryDate: "2026-08-01" }), // critical (200)
        mockOrder({ id: "3", balanceUSD: 150, paidUSD: 50, paymentStatus: "Abonada", orderStatus: "Retirado" }), // withdrawn with debt -> critical (150)
        mockOrder({ id: "4", balanceUSD: 0, paidUSD: 300, paymentStatus: "Paga" }), // paid, ignore
        mockOrder({ id: "5", balanceUSD: 500, paidUSD: 0, paymentStatus: "Pendiente por cobrar", orderStatus: "Cancelada" }), // canceled, ignore
      ];

      const stats = getReceivablesStats(orders, refDate);
      expect(stats.totalOrdersWithBalance).toBe(3);
      expect(stats.totalBalanceUSD).toBe(450); // 100 + 200 + 150
      expect(stats.totalPaidUSD).toBe(100); // 50 + 0 + 50
      expect(stats.criticalCount).toBe(2); // order 2 (>30d) and order 3 (withdrawn with debt)
      expect(stats.withdrawnWithDebtCount).toBe(1); // order 3
      expect(stats.partialPaidCount).toBe(2); // order 1 and 3
      expect(stats.unpaidCount).toBe(1); // order 2
    });
  });

  describe("filterReceivables", () => {
    const orders: OrderItem[] = [
      mockOrder({ id: "1", code: "ORD-001", clientName: "Carlos", balanceUSD: 100, paidUSD: 50, paymentStatus: "Abonada", tentativeDeliveryDate: "2026-10-01" }), // current
      mockOrder({ id: "2", code: "ORD-002", clientName: "María", balanceUSD: 200, paidUSD: 0, paymentStatus: "Pendiente por cobrar", tentativeDeliveryDate: "2026-08-01" }), // critical, unpaid
      mockOrder({ id: "3", code: "ORD-003", clientName: "Juan", balanceUSD: 150, paidUSD: 50, paymentStatus: "Abonada", orderStatus: "Retirado" }), // withdrawn
      mockOrder({ id: "4", code: "ORD-004", clientName: "Pedro", balanceUSD: 0, paidUSD: 200, paymentStatus: "Paga" }), // paid
    ];

    it("filters by tab: all, critical, withdrawn, partial, current", () => {
      expect(filterReceivables(orders, { tab: "all", referenceDate: refDate })).toHaveLength(3);
      expect(filterReceivables(orders, { tab: "critical", referenceDate: refDate })).toHaveLength(2);
      expect(filterReceivables(orders, { tab: "withdrawn", referenceDate: refDate })).toHaveLength(1);
      expect(filterReceivables(orders, { tab: "partial", referenceDate: refDate })).toHaveLength(2);
      expect(filterReceivables(orders, { tab: "current", referenceDate: refDate })).toHaveLength(1);
    });

    it("filters by search term", () => {
      const result = filterReceivables(orders, { tab: "all", searchTerm: "maría", referenceDate: refDate });
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("ORD-002");
    });
  });

  describe("generateWhatsAppReminder", () => {
    it("formats a polite and professional message with order info and balance", () => {
      const order = mockOrder({
        clientName: "Juan",
        code: "ORD-005",
        engineModel: "Ford 302",
        balanceUSD: 120,
      });

      const message = generateWhatsAppReminder(order, { bcvRate: 40 });
      expect(message).toContain("Juan");
      expect(message).toContain("ORD-005");
      expect(message).toContain("Ford 302");
      expect(message).toContain("120.00 USD");
      expect(message).toContain("VES a tasa BCV");
    });
  });
});
