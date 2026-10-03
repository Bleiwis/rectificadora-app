import React, { useState, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Modal } from "../ui/modal";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import type { OrderItem } from "../pedidos/models/types";
import {
  classifyDeliveryUrgency,
  formatDateSpanish,
  getDayDifference,
  getUrgencyMetadata,
  groupOrdersByDeliveryDate,
  getDeliveryStats,
} from "../../utils/deliverySchedule";
import {
  CalenderIcon,
  ListIcon,
  GridIcon,
  AlertIcon,
  EyeIcon,
} from "../../icons";

interface AllDeliveriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderItem[];
  onSelectOrder: (order: OrderItem) => void;
}

type TimeframeFilter =
  | "all"
  | "overdue"
  | "today"
  | "tomorrow"
  | "next7"
  | "month"
  | "future";

export const AllDeliveriesModal: React.FC<AllDeliveriesModalProps> = ({
  isOpen,
  onClose,
  orders,
  onSelectOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all");
  const [viewMode, setViewMode] = useState<"timeline" | "calendar">("timeline");

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => getDeliveryStats(orders, todayIso), [orders, todayIso]);

  // Filter orders according to timeframe and search
  const filteredGroups = useMemo(() => {
    let maxDays: number | undefined = undefined;
    let includeOverdue = true;

    if (timeframe === "today") {
      maxDays = 0;
      includeOverdue = false;
    } else if (timeframe === "tomorrow") {
      maxDays = 1;
      includeOverdue = false;
    } else if (timeframe === "next7") {
      maxDays = 7;
      includeOverdue = false;
    } else if (timeframe === "month") {
      maxDays = 30;
      includeOverdue = true;
    } else if (timeframe === "overdue") {
      maxDays = -1;
      includeOverdue = true;
    }

    const groups = groupOrdersByDeliveryDate(orders, {
      referenceDate: todayIso,
      maxDaysAhead: maxDays,
      includeOverdue,
      searchTerm,
    });

    if (timeframe === "today") {
      return groups.filter((g) => g.urgency === "today");
    }
    if (timeframe === "tomorrow") {
      return groups.filter((g) => g.urgency === "tomorrow");
    }
    if (timeframe === "overdue") {
      return groups.filter((g) => g.urgency === "overdue");
    }
    if (timeframe === "future") {
      return groups.filter((g) => g.urgency === "future");
    }

    return groups;
  }, [orders, todayIso, timeframe, searchTerm]);

  // Prepare events for FullCalendar view
  const calendarEvents = useMemo(() => {
    const active = orders.filter((o) => {
      const status = o.orderStatus || "Ingresado";
      return status !== "Retirado" && status !== "Cancelada" && Boolean(o.tentativeDeliveryDate);
    });

    return active.map((order) => {
      const urgency = classifyDeliveryUrgency(order.tentativeDeliveryDate, todayIso);
      let color = "#3b82f6"; // blue
      if (urgency === "overdue") color = "#ef4444"; // red
      if (urgency === "today") color = "#f59e0b"; // amber
      if (urgency === "tomorrow") color = "#0284c7"; // sky
      if (urgency === "day2") color = "#6366f1"; // indigo
      if (urgency === "day3") color = "#10b981"; // emerald

      return {
        id: order.id,
        title: `[${order.code}] ${order.clientName} (${order.engineModel})`,
        start: order.tentativeDeliveryDate,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { order },
      };
    });
  }, [orders, todayIso]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[1100px] w-[95vw] max-h-[92vh] flex flex-col p-6 sm:p-8 overflow-hidden"
      showCloseButton
    >
      <div className="flex flex-col h-full max-h-[85vh] space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                <CalenderIcon className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Cronograma Completo de Entregas
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Agenda global de entregas programadas y distribución diaria de pedidos
                </p>
              </div>
            </div>
          </div>

          {/* View Mode Toggle: Timeline vs Calendar */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  viewMode === "timeline"
                    ? "bg-white text-gray-900 shadow-xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                <ListIcon className="size-3.5" />
                <span>Línea de Tiempo</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-white text-gray-900 shadow-xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                <GridIcon className="size-3.5" />
                <span>Calendario Mensual</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick KPI Counters Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {/* Overdue Card */}
          <button
            type="button"
            onClick={() => setTimeframe(timeframe === "overdue" ? "all" : "overdue")}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              timeframe === "overdue"
                ? "border-red-500 bg-red-500/10 ring-2 ring-red-400/40"
                : "border-gray-200 bg-white hover:border-red-300 dark:border-gray-800 dark:bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>Atrasadas</span>
              <span className="size-2 rounded-full bg-red-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.overdueCount}
            </div>
          </button>

          {/* Today Card */}
          <button
            type="button"
            onClick={() => setTimeframe(timeframe === "today" ? "all" : "today")}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              timeframe === "today"
                ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-400/40"
                : "border-gray-200 bg-white hover:border-amber-300 dark:border-gray-800 dark:bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>Hoy (Prioridad)</span>
              <span className="size-2 rounded-full bg-amber-500 animate-ping" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.todayCount}
            </div>
          </button>

          {/* Tomorrow Card */}
          <button
            type="button"
            onClick={() => setTimeframe(timeframe === "tomorrow" ? "all" : "tomorrow")}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              timeframe === "tomorrow"
                ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-400/40"
                : "border-gray-200 bg-white hover:border-blue-300 dark:border-gray-800 dark:bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>Mañana</span>
              <span className="size-2 rounded-full bg-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.tomorrowCount}
            </div>
          </button>

          {/* Next 3 Days Card */}
          <button
            type="button"
            onClick={() => setTimeframe("all")}
            className="rounded-xl border border-gray-200 bg-white p-3 text-left transition cursor-pointer hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.02]"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>Próximos 3 días</span>
              <span className="size-2 rounded-full bg-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.next3DaysCount}
            </div>
          </button>

          {/* Total Pending Card */}
          <button
            type="button"
            onClick={() => setTimeframe("all")}
            className="rounded-xl border border-gray-200 bg-white p-3 text-left transition cursor-pointer hover:border-gray-400 dark:border-gray-800 dark:bg-white/[0.02]"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>Total Activas</span>
              <span className="size-2 rounded-full bg-gray-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">
              {stats.totalPendingDeliveries}
            </div>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por orden, cliente, motor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs text-gray-800 placeholder-gray-400 shadow-theme-xs outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Timeframe pill filters */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTimeframe("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                timeframe === "all"
                  ? "bg-brand-500 text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              Todas ({stats.totalPendingDeliveries})
            </button>
            {stats.overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setTimeframe("overdue")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  timeframe === "overdue"
                    ? "bg-red-500 text-white shadow-xs"
                    : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-300"
                }`}
              >
                Atrasadas ({stats.overdueCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setTimeframe("today")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                timeframe === "today"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
              }`}
            >
              Hoy ({stats.todayCount})
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("tomorrow")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                timeframe === "tomorrow"
                  ? "bg-blue-500 text-white shadow-xs"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
              }`}
            >
              Mañana ({stats.tomorrowCount})
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("next7")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                timeframe === "next7"
                  ? "bg-indigo-500 text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              7 Días
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("month")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                timeframe === "month"
                  ? "bg-brand-500 text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              30 Días
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("future")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                timeframe === "future"
                  ? "bg-gray-700 text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              A Futuro ({stats.futureCount})
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {viewMode === "timeline" ? (
            <div className="space-y-6 pb-4">
              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <CalenderIcon className="size-6 text-gray-400" />
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">
                    No se encontraron entregas programadas
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                    {searchTerm
                      ? `No hay órdenes que coincidan con "${searchTerm}".`
                      : "No hay órdenes pendientes con fecha de entrega para este filtro."}
                  </p>
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const dayDiff = getDayDifference(group.date, todayIso);
                  const meta = getUrgencyMetadata(group.urgency, dayDiff);

                  return (
                    <div
                      key={group.date}
                      className="rounded-2xl border border-gray-200 bg-white p-4.5 shadow-xs dark:border-gray-800 dark:bg-white/[0.02]"
                    >
                      {/* Day Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
                        <div className="flex items-center gap-2.5">
                          <span className={`size-3 rounded-full ${meta.dotColorClass}`} />
                          <Badge variant={meta.badgeVariant} color={meta.badgeColor}>
                            {meta.label}
                          </Badge>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatDateSpanish(group.date)}
                          </span>
                          <span className="text-xs text-gray-400">({group.date})</span>
                        </div>

                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {group.count} {group.count === 1 ? "pedido" : "pedidos"}
                        </span>
                      </div>

                      {/* Orders for this day */}
                      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {group.orders.map((order) => {
                          const paymentBadgeColor: "success" | "info" | "warning" =
                            order.paymentStatus === "Paga"
                              ? "success"
                              : order.paymentStatus === "Abonada"
                              ? "info"
                              : "warning";

                          return (
                            <div
                              key={order.id}
                              onClick={() => onSelectOrder(order)}
                              className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/40 p-3.5 transition-all duration-200 hover:border-brand-400 hover:bg-white hover:shadow-md dark:border-gray-800 dark:bg-white/[0.01] dark:hover:border-brand-600 dark:hover:bg-white/[0.03] cursor-pointer"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                                    #{order.code}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {order.priority === "Alta" && (
                                      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xxs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                        <AlertIcon className="size-2.5" />
                                        Alta
                                      </span>
                                    )}
                                    <Badge variant="light" color={paymentBadgeColor} size="sm">
                                      {order.paymentStatus}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="mt-2">
                                  <h5 className="text-xs font-bold text-gray-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400 transition-colors">
                                    {order.clientName} {order.clientLastName}
                                  </h5>
                                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                                    🔧 {order.engineModel}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between border-t border-gray-200/60 pt-2 text-xxs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                                <span>Total: ${(order.totalUSD || 0).toFixed(2)}</span>
                                <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400 font-semibold group-hover:underline">
                                  <EyeIcon className="size-3" />
                                  Detalle
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Calendar View */
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-white/[0.02]">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="es"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth",
                }}
                buttonText={{
                  today: "Hoy",
                  month: "Mes",
                }}
                events={calendarEvents}
                eventClick={(info) => {
                  const order = info.event.extendedProps.order as OrderItem;
                  if (order) {
                    onSelectOrder(order);
                  }
                }}
                height="auto"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Total entregas mostradas:{" "}
            <span className="font-bold text-gray-900 dark:text-white">
              {filteredGroups.reduce((acc, g) => acc + g.count, 0)} pedidos
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar Cronograma
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AllDeliveriesModal;
