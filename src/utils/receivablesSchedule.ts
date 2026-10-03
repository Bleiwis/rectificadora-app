import type { OrderItem } from "../components/pedidos/models/types";

export type AgingTier = "current" | "early_warning" | "moderate" | "critical";

export type ReceivablesTabFilter = "all" | "critical" | "withdrawn" | "partial" | "current";

export interface ReceivablesStats {
  totalOrdersWithBalance: number;
  totalBalanceUSD: number;
  totalPaidUSD: number;
  totalRevenueUSD: number;
  criticalCount: number;
  withdrawnWithDebtCount: number;
  partialPaidCount: number;
  unpaidCount: number;
  recoveryPercentage: number;
}

export interface AgingTierMetadata {
  tier: AgingTier;
  label: string;
  badgeColor: "success" | "warning" | "error" | "light";
  badgeVariant: "light" | "solid";
  colorClass: string;
  bgClass: string;
  description: string;
}

/**
 * Parses YYYY-MM-DD string into a local Date without UTC day shifting.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("T")) {
    const [datePart] = dateStr.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculates the exact balance in USD for an order.
 * Takes into account explicit balanceUSD, totalUSD, paidUSD, and paymentStatus.
 * Canceled orders return 0.
 */
export function getOrderBalanceUSD(order: OrderItem): number {
  if ((order.orderStatus || "Ingresado") === "Cancelada") {
    return 0;
  }
  if (order.paymentStatus === "Paga") {
    return 0;
  }

  const explicit = Number(order.balanceUSD);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }

  const total = Number(order.totalUSD || 0);
  const paid = Number(order.paidUSD || 0);
  return Math.max(0, total - paid);
}

/**
 * Calculates the total amount paid in USD for an order.
 */
export function getOrderPaidUSD(order: OrderItem): number {
  if ((order.orderStatus || "Ingresado") === "Cancelada") {
    return 0;
  }
  if (order.paymentStatus === "Paga") {
    return Number(order.totalUSD || 0);
  }

  const explicit = Number(order.paidUSD);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }

  return 0;
}

/**
 * Calculates elapsed days of debt (aging).
 * If tentativeDeliveryDate has passed, aging is days since that tentative date.
 * If tentativeDeliveryDate is in the future or absent, aging is days since entryDate.
 */
export function getAgingDays(order: OrderItem, referenceDate?: string): number {
  const ref = referenceDate ? parseLocalDate(referenceDate) : new Date();
  ref.setHours(0, 0, 0, 0);

  const deliveryStr = order.tentativeDeliveryDate;
  if (deliveryStr) {
    const deliveryDate = parseLocalDate(deliveryStr);
    deliveryDate.setHours(0, 0, 0, 0);
    const diffTime = ref.getTime() - deliveryDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      return diffDays;
    }
  }

  // Fallback to entryDate
  const entryStr = order.entryDate;
  if (entryStr) {
    const entryDate = parseLocalDate(entryStr);
    entryDate.setHours(0, 0, 0, 0);
    const diffTime = ref.getTime() - entryDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  return 0;
}

/**
 * Classifies an order into an aging tier.
 * Special rule: An order that is "Retirado" with an outstanding balance is immediately "critical".
 */
export function classifyAgingTier(order: OrderItem, referenceDate?: string): AgingTier {
  const balance = getOrderBalanceUSD(order);
  if (balance <= 0) {
    return "current";
  }

  const orderStatus = order.orderStatus || "Ingresado";
  if (orderStatus === "Retirado" || orderStatus === "Parcialmente retirado") {
    return "critical";
  }

  const days = getAgingDays(order, referenceDate);
  if (days <= 7) return "current";
  if (days <= 14) return "early_warning";
  if (days <= 30) return "moderate";
  return "critical";
}

/**
 * Returns metadata and Tailwind styles for each aging tier.
 */
export function getAgingTierMetadata(tier: AgingTier, agingDays: number): AgingTierMetadata {
  switch (tier) {
    case "current":
      return {
        tier,
        label: agingDays === 0 ? "Al día (Hoy)" : `Al día (${agingDays} d)`,
        badgeColor: "success",
        badgeVariant: "light",
        colorClass: "text-emerald-700 dark:text-emerald-400",
        bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
        description: "Dentro del plazo regular de trabajo",
      };
    case "early_warning":
      return {
        tier,
        label: `Atraso leve (${agingDays} d)`,
        badgeColor: "warning",
        badgeVariant: "light",
        colorClass: "text-amber-700 dark:text-amber-400",
        bgClass: "bg-amber-50 dark:bg-amber-950/40",
        description: "Atraso de 8 a 14 días",
      };
    case "moderate":
      return {
        tier,
        label: `Vencido (${agingDays} d)`,
        badgeColor: "warning",
        badgeVariant: "light",
        colorClass: "text-orange-700 dark:text-orange-400",
        bgClass: "bg-orange-50 dark:bg-orange-950/40",
        description: "Vencimiento moderado de 15 a 30 días",
      };
    case "critical":
    default:
      return {
        tier,
        label: `Mora Crítica (${agingDays} d)`,
        badgeColor: "error",
        badgeVariant: "light",
        colorClass: "text-red-700 dark:text-red-400",
        bgClass: "bg-red-50 dark:bg-red-950/40",
        description: "Mayor a 30 días o cliente retiró pieza con deuda",
      };
  }
}

/**
 * Aggregates statistics for the receivables portfolio.
 */
export function getReceivablesStats(orders: OrderItem[], referenceDate?: string): ReceivablesStats {
  let totalOrdersWithBalance = 0;
  let totalBalanceUSD = 0;
  let totalPaidUSD = 0;
  let totalRevenueUSD = 0;
  let criticalCount = 0;
  let withdrawnWithDebtCount = 0;
  let partialPaidCount = 0;
  let unpaidCount = 0;

  for (const order of orders) {
    if ((order.orderStatus || "Ingresado") === "Cancelada") continue;

    const balance = getOrderBalanceUSD(order);
    const paid = getOrderPaidUSD(order);
    const total = Number(order.totalUSD || 0);

    if (balance > 0.001) {
      totalOrdersWithBalance++;
      totalBalanceUSD += balance;
      totalPaidUSD += paid;
      totalRevenueUSD += total;

      const tier = classifyAgingTier(order, referenceDate);
      if (tier === "critical") {
        criticalCount++;
      }

      const status = order.orderStatus || "Ingresado";
      if (status === "Retirado" || status === "Parcialmente retirado") {
        withdrawnWithDebtCount++;
      }

      if (paid > 0.001) {
        partialPaidCount++;
      } else {
        unpaidCount++;
      }
    }
  }

  const recoveryPercentage =
    totalRevenueUSD > 0 ? Math.round((totalPaidUSD / totalRevenueUSD) * 100) : 0;

  return {
    totalOrdersWithBalance,
    totalBalanceUSD,
    totalPaidUSD,
    totalRevenueUSD,
    criticalCount,
    withdrawnWithDebtCount,
    partialPaidCount,
    unpaidCount,
    recoveryPercentage,
  };
}

/**
 * Filters orders with pending balance by tab and search term.
 * Sorts with highest priority / critical debt first.
 */
export function filterReceivables(
  orders: OrderItem[],
  options: {
    tab?: ReceivablesTabFilter;
    searchTerm?: string;
    referenceDate?: string;
  } = {},
): OrderItem[] {
  const { tab = "all", searchTerm = "", referenceDate } = options;
  const term = searchTerm.trim().toLowerCase();

  return orders
    .filter((order) => {
      // Must not be canceled
      if ((order.orderStatus || "Ingresado") === "Cancelada") return false;

      // Must have pending balance
      const balance = getOrderBalanceUSD(order);
      if (balance <= 0.001) return false;

      // Tab filtering
      if (tab === "critical") {
        const tier = classifyAgingTier(order, referenceDate);
        if (tier !== "critical") return false;
      } else if (tab === "withdrawn") {
        const status = order.orderStatus || "Ingresado";
        if (status !== "Retirado" && status !== "Parcialmente retirado") return false;
      } else if (tab === "partial") {
        const paid = getOrderPaidUSD(order);
        if (paid <= 0.001) return false;
      } else if (tab === "current") {
        const tier = classifyAgingTier(order, referenceDate);
        if (tier !== "current") return false;
      }

      // Search term filtering
      if (term) {
        const code = (order.code || "").toLowerCase();
        const client = `${order.clientName || ""} ${order.clientLastName || ""}`.toLowerCase();
        const ci = (order.clientCI || "").toLowerCase();
        const phone = (order.clientPhone || "").toLowerCase();
        const engine = (order.engineModel || "").toLowerCase();

        return (
          code.includes(term) ||
          client.includes(term) ||
          ci.includes(term) ||
          phone.includes(term) ||
          engine.includes(term)
        );
      }

      return true;
    })
    .sort((a, b) => {
      // Sort priority: Critical tier first, then highest balance, then older date
      const tierA = classifyAgingTier(a, referenceDate);
      const tierB = classifyAgingTier(b, referenceDate);
      const isCritA = tierA === "critical" ? 1 : 0;
      const isCritB = tierB === "critical" ? 1 : 0;

      if (isCritB !== isCritA) return isCritB - isCritA;

      const balA = getOrderBalanceUSD(a);
      const balB = getOrderBalanceUSD(b);
      if (Math.abs(balB - balA) > 0.01) return balB - balA;

      const daysA = getAgingDays(a, referenceDate);
      const daysB = getAgingDays(b, referenceDate);
      return daysB - daysA;
    });
}

/**
 * Generates an amicable, clear, and professional WhatsApp collection reminder.
 */
export function generateWhatsAppReminder(
  order: OrderItem,
  options: { bcvRate?: number; businessName?: string } = {},
): string {
  const { bcvRate, businessName = "Rectificadora" } = options;
  const balanceUSD = getOrderBalanceUSD(order);
  const clientName = `${order.clientName || ""} ${order.clientLastName || ""}`.trim() || "Cliente";

  const formattedUSD = balanceUSD.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let message = `Hola estimado(a) *${clientName}*, le saludamos cordialmente de *${businessName}*.\n\n`;
  message += `Le escribimos para recordarle el estado de su orden de servicio:\n`;
  message += `📄 *Orden:* #${order.code || "S/N"}\n`;
  if (order.engineModel) {
    message += `🔧 *Motor:* ${order.engineModel}\n`;
  }
  message += `💰 *Saldo pendiente:* ${formattedUSD} USD`;

  if (bcvRate && bcvRate > 0) {
    const balanceVES = balanceUSD * bcvRate;
    const formattedVES = balanceVES.toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    message += ` (aprox. Bs. ${formattedVES} VES a tasa BCV)`;
  }

  message += `\n\n`;
  if ((order.orderStatus || "Ingresado") === "Retirado") {
    message += `Agradecemos gestionar la cancelación de este saldo pendiente a la brevedad posible.\n`;
  } else {
    message += `Puede pasar por nuestras instalaciones para realizar el pago y coordinar el retiro de sus piezas.\n`;
  }
  message += `¡Muchas gracias por su confianza y preferencia!`;

  return message;
}
