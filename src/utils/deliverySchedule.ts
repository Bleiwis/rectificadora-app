import type { OrderItem } from "../components/pedidos/models/types";

export type DeliveryUrgency =
  | "overdue"
  | "today"
  | "tomorrow"
  | "day2"
  | "day3"
  | "future";

export interface DeliveryGroup {
  date: string;
  urgency: DeliveryUrgency;
  count: number;
  orders: OrderItem[];
}

export interface DeliveryStats {
  overdueCount: number;
  todayCount: number;
  tomorrowCount: number;
  next3DaysCount: number;
  futureCount: number;
  totalPendingDeliveries: number;
}

export interface GroupOrdersOptions {
  referenceDate?: string;
  maxDaysAhead?: number;
  includeOverdue?: boolean;
  searchTerm?: string;
}

export function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getDayDifference(targetDateStr: string, refDateStr: string): number {
  const target = parseLocalDate(targetDateStr);
  const ref = parseLocalDate(refDateStr);

  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((targetUtc - refUtc) / msPerDay);
}

export function classifyDeliveryUrgency(dateStr: string, refDateStr: string): DeliveryUrgency {
  const diff = getDayDifference(dateStr, refDateStr);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === 2) return "day2";
  if (diff === 3) return "day3";
  return "future";
}

export function formatDateSpanish(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const weekday = d.toLocaleDateString("es-VE", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("es-VE", { month: "long" });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalizedWeekday} ${day} de ${month}`;
}

export interface UrgencyMeta {
  label: string;
  shortLabel: string;
  badgeColor: "error" | "warning" | "info" | "primary" | "success" | "light";
  badgeVariant: "solid" | "light";
  borderClass: string;
  bgLightClass: string;
  textColorClass: string;
  dotColorClass: string;
}

export function getUrgencyMetadata(urgency: DeliveryUrgency, dayDiff: number): UrgencyMeta {
  switch (urgency) {
    case "overdue":
      return {
        label: `Atrasado (${Math.abs(dayDiff)} d)`,
        shortLabel: "Atrasado",
        badgeColor: "error",
        badgeVariant: "solid",
        borderClass: "border-red-400 dark:border-red-600/70",
        bgLightClass: "bg-red-50/70 dark:bg-red-950/20",
        textColorClass: "text-red-700 dark:text-red-400",
        dotColorClass: "bg-red-500",
      };
    case "today":
      return {
        label: "Hoy",
        shortLabel: "Hoy",
        badgeColor: "warning",
        badgeVariant: "solid",
        borderClass: "border-amber-400 dark:border-amber-600/70",
        bgLightClass: "bg-amber-50/70 dark:bg-amber-950/20",
        textColorClass: "text-amber-800 dark:text-amber-300",
        dotColorClass: "bg-amber-500",
      };
    case "tomorrow":
      return {
        label: "Mañana",
        shortLabel: "Mañana",
        badgeColor: "info",
        badgeVariant: "solid",
        borderClass: "border-blue-400 dark:border-blue-600/70",
        bgLightClass: "bg-blue-50/70 dark:bg-blue-950/20",
        textColorClass: "text-blue-700 dark:text-blue-300",
        dotColorClass: "bg-blue-500",
      };
    case "day2":
      return {
        label: "En 2 días",
        shortLabel: "Pasado mañana",
        badgeColor: "primary",
        badgeVariant: "light",
        borderClass: "border-indigo-300 dark:border-indigo-700/60",
        bgLightClass: "bg-indigo-50/50 dark:bg-indigo-950/15",
        textColorClass: "text-indigo-700 dark:text-indigo-300",
        dotColorClass: "bg-indigo-500",
      };
    case "day3":
      return {
        label: "En 3 días",
        shortLabel: "En 3 días",
        badgeColor: "success",
        badgeVariant: "light",
        borderClass: "border-emerald-300 dark:border-emerald-700/60",
        bgLightClass: "bg-emerald-50/50 dark:bg-emerald-950/15",
        textColorClass: "text-emerald-700 dark:text-emerald-300",
        dotColorClass: "bg-emerald-500",
      };
    case "future":
    default:
      return {
        label: `En ${dayDiff} días`,
        shortLabel: "A futuro",
        badgeColor: "light",
        badgeVariant: "light",
        borderClass: "border-gray-200 dark:border-gray-700/60",
        bgLightClass: "bg-gray-50/50 dark:bg-gray-800/20",
        textColorClass: "text-gray-700 dark:text-gray-300",
        dotColorClass: "bg-gray-400",
      };
  }
}

const PRIORITY_ORDER: Record<string, number> = {
  Alta: 3,
  Media: 2,
  Baja: 1,
};

export function groupOrdersByDeliveryDate(
  orders: OrderItem[],
  options: GroupOrdersOptions = {},
): DeliveryGroup[] {
  const refDateStr = options.referenceDate || new Date().toISOString().slice(0, 10);
  const maxDaysAhead = options.maxDaysAhead !== undefined ? options.maxDaysAhead : Infinity;
  const includeOverdue = options.includeOverdue !== undefined ? options.includeOverdue : true;
  const search = options.searchTerm?.trim().toLowerCase();

  const validOrders = orders.filter((o) => {
    const status = o.orderStatus || "Ingresado";
    if (status === "Retirado" || status === "Cancelada") return false;
    if (!o.tentativeDeliveryDate) return false;

    if (search) {
      const matchCode = (o.code || "").toLowerCase().includes(search);
      const matchClient = `${o.clientName || ""} ${o.clientLastName || ""}`
        .toLowerCase()
        .includes(search);
      const matchEngine = (o.engineModel || "").toLowerCase().includes(search);
      if (!matchCode && !matchClient && !matchEngine) return false;
    }

    const diff = getDayDifference(o.tentativeDeliveryDate, refDateStr);
    if (diff < 0 && !includeOverdue) return false;
    if (diff > maxDaysAhead) return false;

    return true;
  });

  const map = new Map<string, OrderItem[]>();
  for (const order of validOrders) {
    const date = order.tentativeDeliveryDate;
    if (!map.has(date)) {
      map.set(date, []);
    }
    map.get(date)!.push(order);
  }

  const groups: DeliveryGroup[] = [];
  for (const [date, dateOrders] of map.entries()) {
    dateOrders.sort((a, b) => {
      const pA = PRIORITY_ORDER[a.priority || "Media"] || 2;
      const pB = PRIORITY_ORDER[b.priority || "Media"] || 2;
      if (pB !== pA) return pB - pA;
      return (a.code || "").localeCompare(b.code || "");
    });

    groups.push({
      date,
      urgency: classifyDeliveryUrgency(date, refDateStr),
      count: dateOrders.length,
      orders: dateOrders,
    });
  }

  groups.sort((a, b) => a.date.localeCompare(b.date));

  return groups;
}

export function getDeliveryStats(
  orders: OrderItem[],
  refDateStr: string = new Date().toISOString().slice(0, 10),
): DeliveryStats {
  const activeOrders = orders.filter((o) => {
    const status = o.orderStatus || "Ingresado";
    return status !== "Retirado" && status !== "Cancelada" && Boolean(o.tentativeDeliveryDate);
  });

  let overdueCount = 0;
  let todayCount = 0;
  let tomorrowCount = 0;
  let next3DaysCount = 0;
  let futureCount = 0;

  for (const order of activeOrders) {
    const diff = getDayDifference(order.tentativeDeliveryDate, refDateStr);
    if (diff < 0) {
      overdueCount++;
    } else if (diff === 0) {
      todayCount++;
      next3DaysCount++;
    } else if (diff === 1) {
      tomorrowCount++;
      next3DaysCount++;
    } else if (diff === 2 || diff === 3) {
      next3DaysCount++;
    } else {
      futureCount++;
    }
  }

  return {
    overdueCount,
    todayCount,
    tomorrowCount,
    next3DaysCount,
    futureCount,
    totalPendingDeliveries: activeOrders.length,
  };
}
