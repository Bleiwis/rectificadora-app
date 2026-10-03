import { describe, it, expect } from "vitest";
import {
  sanitizeIntegerString,
  isInvalidIntegerKey,
  isInvalidDecimalKey,
  getInventoryStockStatus,
} from "../src/utils/inventoryHelpers";

describe("inventoryHelpers utility (TDD)", () => {
  describe("sanitizeIntegerString", () => {
    it("strips scientific notation 'e' and 'E'", () => {
      expect(sanitizeIntegerString("12e3")).toBe("123");
      expect(sanitizeIntegerString("10E5")).toBe("105");
      expect(sanitizeIntegerString("e")).toBe("");
      expect(sanitizeIntegerString("E")).toBe("");
    });

    it("strips negative signs and decimal points for integer quantities", () => {
      expect(sanitizeIntegerString("-50")).toBe("50");
      expect(sanitizeIntegerString("+25")).toBe("25");
      expect(sanitizeIntegerString("12.5")).toBe("125");
    });

    it("strips leading zeros properly while preserving standalone zero", () => {
      expect(sanitizeIntegerString("033123")).toBe("33123");
      expect(sanitizeIntegerString("007")).toBe("7");
      expect(sanitizeIntegerString("0")).toBe("0");
      expect(sanitizeIntegerString("00")).toBe("0");
    });

    it("returns empty string on empty input", () => {
      expect(sanitizeIntegerString("")).toBe("");
    });
  });

  describe("isInvalidIntegerKey", () => {
    it("identifies e, E, +, -, . as invalid keys for integer fields", () => {
      expect(isInvalidIntegerKey("e")).toBe(true);
      expect(isInvalidIntegerKey("E")).toBe(true);
      expect(isInvalidIntegerKey("+")).toBe(true);
      expect(isInvalidIntegerKey("-")).toBe(true);
      expect(isInvalidIntegerKey(".")).toBe(true);
      expect(isInvalidIntegerKey(",")).toBe(true);
    });

    it("allows digits and control keys", () => {
      expect(isInvalidIntegerKey("0")).toBe(false);
      expect(isInvalidIntegerKey("9")).toBe(false);
      expect(isInvalidIntegerKey("Backspace")).toBe(false);
      expect(isInvalidIntegerKey("ArrowLeft")).toBe(false);
      expect(isInvalidIntegerKey("Tab")).toBe(false);
    });
  });

  describe("isInvalidDecimalKey", () => {
    it("identifies e, E, +, - as invalid keys for price fields", () => {
      expect(isInvalidDecimalKey("e")).toBe(true);
      expect(isInvalidDecimalKey("E")).toBe(true);
      expect(isInvalidDecimalKey("+")).toBe(true);
      expect(isInvalidDecimalKey("-")).toBe(true);
    });

    it("allows decimal point, digits and control keys", () => {
      expect(isInvalidDecimalKey(".")).toBe(false);
      expect(isInvalidDecimalKey("5")).toBe(false);
      expect(isInvalidDecimalKey("Backspace")).toBe(false);
    });
  });

  describe("getInventoryStockStatus", () => {
    it("returns out_of_stock when quantity is 0", () => {
      expect(getInventoryStockStatus(0, 5)).toBe("out_of_stock");
    });

    it("returns low_stock when quantity is greater than 0 and less than or equal to minStock", () => {
      expect(getInventoryStockStatus(3, 5)).toBe("low_stock");
      expect(getInventoryStockStatus(5, 5)).toBe("low_stock");
    });

    it("returns in_stock when quantity is greater than minStock", () => {
      expect(getInventoryStockStatus(6, 5)).toBe("in_stock");
      expect(getInventoryStockStatus(20, 5)).toBe("in_stock");
    });
  });
});
