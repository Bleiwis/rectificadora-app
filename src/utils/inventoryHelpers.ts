export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

export interface StockStatusMetadata {
  status: StockStatus;
  label: string;
  badgeColor: "error" | "warning" | "success";
  badgeVariant: "light" | "solid";
  textColor: string;
  bgColor: string;
  description: string;
}

/**
 * Strips any characters that are not digits from an integer string (including 'e', 'E', '+', '-', '.').
 * Removes leading zeroes unless the value is strictly "0".
 */
export function sanitizeIntegerString(val: string): string {
  if (!val) return "";
  const digitsOnly = val.replace(/[^0-9]/g, "");
  if (!digitsOnly) return "";
  // Strip leading zeroes, but if all digits are 0, return "0"
  const stripped = digitsOnly.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

/**
 * Checks if a pressed key is invalid for an integer field.
 * Explicitly blocks 'e', 'E', '+', '-', '.', and ','.
 */
export function isInvalidIntegerKey(key: string): boolean {
  return ["e", "E", "+", "-", ".", ","].includes(key);
}

/**
 * Checks if a pressed key is invalid for a decimal/currency field.
 * Explicitly blocks 'e', 'E', '+', '-'.
 */
export function isInvalidDecimalKey(key: string): boolean {
  return ["e", "E", "+", "-"].includes(key);
}

/**
 * Evaluates stock status according to quantity and minimum alert threshold.
 */
export function getInventoryStockStatus(quantity: number, minStock: number): StockStatus {
  if (quantity <= 0) {
    return "out_of_stock";
  }
  if (quantity <= minStock) {
    return "low_stock";
  }
  return "in_stock";
}

/**
 * Returns metadata, badge colors, and descriptions for stock status.
 */
export function getStockStatusMetadata(status: StockStatus, minStock = 5): StockStatusMetadata {
  switch (status) {
    case "out_of_stock":
      return {
        status,
        label: "Agotado (0 existencias)",
        badgeColor: "error",
        badgeVariant: "light",
        textColor: "text-red-700 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/40",
        description: "El artículo no tiene unidades disponibles en almacén.",
      };
    case "low_stock":
      return {
        status,
        label: `Bajo Stock (≤ ${minStock})`,
        badgeColor: "warning",
        badgeVariant: "light",
        textColor: "text-amber-700 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/40",
        description: "Próximo a agotarse según el mínimo de alerta.",
      };
    case "in_stock":
    default:
      return {
        status,
        label: "En Stock Óptimo",
        badgeColor: "success",
        badgeVariant: "light",
        textColor: "text-emerald-700 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
        description: "Existencias suficientes en inventario.",
      };
  }
}
