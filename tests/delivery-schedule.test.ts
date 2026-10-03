import { describe, it, expect } from "vitest";
import {
  parseLocalDate,
  getDayDifference,
  classifyDeliveryUrgency,
  groupOrdersByDeliveryDate,
  getDeliveryStats,
} from "../src/utils/deliverySchedule";
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
  totalUSD: 150,
  totalVES: 6000,
  entryDate: "2026-10-01",
  deliveryDays: 2,
  tentativeDeliveryDate: "2026-10-03",
  paymentStatus: "Pendiente por cobrar",
  orderStatus: "Ingresado",
  priority: "Media",
  createdBy: "Admin",
  ...overrides,
});

describe("deliverySchedule utility", () => {
  const refDate = "2026-10-02"; // Reference date: Oct 2, 2026

  describe("parseLocalDate", () => {
    it("parses YYYY-MM-DD correctly without UTC day shift", () => {
      const d = parseLocalDate("2026-10-02");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(9); // 0-indexed, 9 = October
      expect(d.getDate()).toBe(2);
    });

    it("parses ISO strings correctly", () => {
      const d = parseLocalDate("2026-10-02T15:30:00.000Z");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(9);
      expect(d.getDate()).toBe(2);
    });
  });

  describe("getDayDifference", () => {
    it("calculates difference in days correctly", () => {
      expect(getDayDifference("2026-10-01", refDate)).toBe(-1); // yesterday
      expect(getDayDifference("2026-10-02", refDate)).toBe(0); // today
      expect(getDayDifference("2026-10-03", refDate)).toBe(1); // tomorrow
      expect(getDayDifference("2026-10-04", refDate)).toBe(2); // in 2 days
      expect(getDayDifference("2026-10-05", refDate)).toBe(3); // in 3 days
      expect(getDayDifference("2026-10-10", refDate)).toBe(8); // in 8 days
    });
  });

  describe("classifyDeliveryUrgency", () => {
    it("correctly identifies urgency tier", () => {
      expect(classifyDeliveryUrgency("2026-10-01", refDate)).toBe("overdue");
      expect(classifyDeliveryUrgency("2026-10-02", refDate)).toBe("today");
      expect(classifyDeliveryUrgency("2026-10-03", refDate)).toBe("tomorrow");
      expect(classifyDeliveryUrgency("2026-10-04", refDate)).toBe("day2");
      expect(classifyDeliveryUrgency("2026-10-05", refDate)).toBe("day3");
      expect(classifyDeliveryUrgency("2026-10-10", refDate)).toBe("future");
    });
  });

  describe("groupOrdersByDeliveryDate", () => {
    it("groups multiple orders on the same day and sorts by date and priority", () => {
      const orders: OrderItem[] = [
        mockOrder({ id: "1", code: "ORD-001", tentativeDeliveryDate: "2026-10-02", priority: "Baja" }),
        mockOrder({ id: "2", code: "ORD-002", tentativeDeliveryDate: "2026-10-02", priority: "Alta" }),
        mockOrder({ id: "3", code: "ORD-003", tentativeDeliveryDate: "2026-10-03", priority: "Media" }),
        mockOrder({ id: "4", code: "ORD-004", tentativeDeliveryDate: "2026-10-01", priority: "Alta" }), // overdue
        mockOrder({ id: "5", code: "ORD-005", tentativeDeliveryDate: "2026-10-02", orderStatus: "Retirado" }), // already picked up, should ignore
        mockOrder({ id: "6", code: "ORD-006", tentativeDeliveryDate: "2026-10-02", orderStatus: "Cancelada" }), // canceled, should ignore
      ];

      const groups = groupOrdersByDeliveryDate(orders, { referenceDate: refDate });

      // Should have 3 active groups: Overdue (Oct 1), Today (Oct 2), Tomorrow (Oct 3)
      expect(groups).toHaveLength(3);

      // 1st group: Overdue
      expect(groups[0].urgency).toBe("overdue");
      expect(groups[0].date).toBe("2026-10-01");
      expect(groups[0].count).toBe(1);

      // 2nd group: Today (2 orders, with priority Alta first)
      expect(groups[1].urgency).toBe("today");
      expect(groups[1].date).toBe("2026-10-02");
      expect(groups[1].count).toBe(2);
      expect(groups[1].orders[0].code).toBe("ORD-002"); // Alta
      expect(groups[1].orders[1].code).toBe("ORD-001"); // Baja

      // 3rd group: Tomorrow
      expect(groups[2].urgency).toBe("tomorrow");
      expect(groups[2].date).toBe("2026-10-03");
      expect(groups[2].count).toBe(1);
    });

    it("respects maxDays limit when specified", () => {
      const orders: OrderItem[] = [
        mockOrder({ id: "1", tentativeDeliveryDate: "2026-10-02" }), // Today (diff 0)
        mockOrder({ id: "2", tentativeDeliveryDate: "2026-10-03" }), // Tomorrow (diff 1)
        mockOrder({ id: "3", tentativeDeliveryDate: "2026-10-04" }), // Day 2 (diff 2)
        mockOrder({ id: "4", tentativeDeliveryDate: "2026-10-05" }), // Day 3 (diff 3)
        mockOrder({ id: "5", tentativeDeliveryDate: "2026-10-06" }), // Day 4 (diff 4 - beyond maxDays 3)
      ];

      const groups = groupOrdersByDeliveryDate(orders, {
        referenceDate: refDate,
        maxDaysAhead: 3,
        includeOverdue: false,
      });

      expect(groups.map((g) => g.date)).toEqual([
        "2026-10-02",
        "2026-10-03",
        "2026-10-04",
        "2026-10-05",
      ]);
    });

    it("filters orders by search term matching code, client name, or engine", () => {
      const orders: OrderItem[] = [
        mockOrder({ id: "1", code: "ORD-100", clientName: "José", engineModel: "Toyota 1FZ", tentativeDeliveryDate: "2026-10-02" }),
        mockOrder({ id: "2", code: "ORD-200", clientName: "María", engineModel: "Ford 302", tentativeDeliveryDate: "2026-10-02" }),
        mockOrder({ id: "3", code: "ORD-300", clientName: "Pedro", engineModel: "Chevrolet 350", tentativeDeliveryDate: "2026-10-03" }),
      ];

      const searchByEngine = groupOrdersByDeliveryDate(orders, { referenceDate: refDate, searchTerm: "ford" });
      expect(searchByEngine).toHaveLength(1);
      expect(searchByEngine[0].orders[0].code).toBe("ORD-200");

      const searchByClient = groupOrdersByDeliveryDate(orders, { referenceDate: refDate, searchTerm: "josé" });
      expect(searchByClient).toHaveLength(1);
      expect(searchByClient[0].orders[0].code).toBe("ORD-100");

      const searchByCode = groupOrdersByDeliveryDate(orders, { referenceDate: refDate, searchTerm: "300" });
      expect(searchByCode).toHaveLength(1);
      expect(searchByCode[0].orders[0].code).toBe("ORD-300");
    });

    it("handles empty lists and invalid dates gracefully", () => {
      expect(groupOrdersByDeliveryDate([])).toEqual([]);
      const ordersWithInvalid = [
        mockOrder({ id: "1", tentativeDeliveryDate: "" }),
      ];
      expect(groupOrdersByDeliveryDate(ordersWithInvalid)).toEqual([]);
    });
  });

  describe("getDeliveryStats", () => {
    it("computes accurate counts for dashboard badges", () => {
      const orders: OrderItem[] = [
        mockOrder({ id: "1", tentativeDeliveryDate: "2026-10-01" }), // Overdue
        mockOrder({ id: "2", tentativeDeliveryDate: "2026-10-02" }), // Today
        mockOrder({ id: "3", tentativeDeliveryDate: "2026-10-02" }), // Today
        mockOrder({ id: "4", tentativeDeliveryDate: "2026-10-03" }), // Tomorrow
        mockOrder({ id: "5", tentativeDeliveryDate: "2026-10-04" }), // Day 2
        mockOrder({ id: "6", tentativeDeliveryDate: "2026-10-05" }), // Day 3
        mockOrder({ id: "7", tentativeDeliveryDate: "2026-10-15" }), // Future
        mockOrder({ id: "8", tentativeDeliveryDate: "2026-10-02", orderStatus: "Retirado" }), // Excluded
      ];

      const stats = getDeliveryStats(orders, refDate);
      expect(stats.overdueCount).toBe(1);
      expect(stats.todayCount).toBe(2);
      expect(stats.tomorrowCount).toBe(1);
      expect(stats.next3DaysCount).toBe(5); // today (2) + tomorrow (1) + day2 (1) + day3 (1)
      expect(stats.futureCount).toBe(1);
      expect(stats.totalPendingDeliveries).toBe(7);
    });
  });
});
