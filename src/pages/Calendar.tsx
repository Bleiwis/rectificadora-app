import { useState, useRef, useEffect, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { EventClickArg } from "@fullcalendar/core";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import { OrderQuickPreviewModal } from "../components/dashboard";
import type { OrderItem } from "../components/pedidos/models/types";
import {
  classifyDeliveryUrgency,
  getDayDifference,
  getDeliveryStats,
} from "../utils/deliverySchedule";

interface CalendarOrderEvent {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
  textColor?: string;
  extendedProps: {
    order: OrderItem;
    urgency: string;
    dayDiff: number;
  };
}

export default function Calendar() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Paid">("Pending");
  const calendarRef = useRef<FullCalendar>(null);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    window.database
      .getOrders()
      .then((list) => {
        if (Array.isArray(list)) {
          setOrders(list as unknown as OrderItem[]);
        }
      })
      .catch(console.error);
  }, []);

  const stats = useMemo(() => getDeliveryStats(orders, todayIso), [orders, todayIso]);

  // Convert orders to FullCalendar events with proper urgency color coding
  const events = useMemo<CalendarOrderEvent[]>(() => {
    return orders
      .filter((o) => {
        const orderStatus = o.orderStatus || "Ingresado";
        if (orderStatus === "Retirado" || orderStatus === "Cancelada") return false;
        if (!o.tentativeDeliveryDate) return false;

        if (statusFilter === "Paid" && o.paymentStatus !== "Paga") return false;
        if (statusFilter === "Pending" && o.paymentStatus === "Paga") return false;

        return true;
      })
      .map((order) => {
        const dayDiff = getDayDifference(order.tentativeDeliveryDate, todayIso);
        const urgency = classifyDeliveryUrgency(order.tentativeDeliveryDate, todayIso);

        // Color coding matching UI/UX design
        let bg = "#3b82f6"; // default blue
        if (urgency === "overdue") bg = "#ef4444"; // red
        if (urgency === "today") bg = "#f59e0b"; // amber
        if (urgency === "tomorrow") bg = "#0284c7"; // sky
        if (urgency === "day2") bg = "#6366f1"; // indigo
        if (urgency === "day3") bg = "#10b981"; // emerald

        return {
          id: order.id,
          title: `[${order.code}] ${order.clientName} - ${order.engineModel}`,
          start: order.tentativeDeliveryDate,
          backgroundColor: bg,
          borderColor: bg,
          textColor: "#ffffff",
          extendedProps: {
            order,
            urgency,
            dayDiff,
          },
        };
      });
  }, [orders, todayIso, statusFilter]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const order = clickInfo.event.extendedProps.order as OrderItem;
    if (order) {
      setSelectedOrder(order);
    }
  };

  return (
    <>
      <PageMeta
        title="Agenda de Entregas | Rectificadora App"
        description="Cronograma y calendario interactivo de entregas programadas de la rectificadora."
      />

      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Agenda de Entregas Programadas" />

        {/* Top KPI Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>Hoy (Prioridad)</span>
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.todayCount}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>Mañana</span>
              <span className="size-2 rounded-full bg-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.tomorrowCount}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>Próximos 3 días</span>
              <span className="size-2 rounded-full bg-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.next3DaysCount}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>Atrasadas</span>
              <span className="size-2 rounded-full bg-red-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.overdueCount}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>Total Activas</span>
              <span className="size-2 rounded-full bg-gray-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalPendingDeliveries}
            </div>
          </div>
        </div>

        {/* Legend and Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-500 dark:text-gray-400">Leyenda:</span>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-500" />
              <span className="text-gray-700 dark:text-gray-300">Atrasada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span className="text-gray-700 dark:text-gray-300 font-semibold">Hoy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-sky-500" />
              <span className="text-gray-700 dark:text-gray-300">Mañana</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-indigo-500" />
              <span className="text-gray-700 dark:text-gray-300">En 2-3 días</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="text-gray-700 dark:text-gray-300">A Futuro</span>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtrar:</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setStatusFilter("Pending")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "Pending"
                    ? "bg-white text-gray-900 shadow-xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400"
                }`}
              >
                Pendientes de pago
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("All")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "All"
                    ? "bg-white text-gray-900 shadow-xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400"
                }`}
              >
                Todas las activas
              </button>
            </div>
          </div>
        </div>

        {/* Calendar View Container */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="custom-calendar">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="es"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek",
              }}
              buttonText={{
                today: "Hoy",
                month: "Mes",
                week: "Semana",
              }}
              events={events}
              eventClick={handleEventClick}
              eventContent={renderCalendarEvent}
              height="auto"
            />
          </div>
        </div>

        {/* Quick Preview Modal when an order is clicked */}
        <OrderQuickPreviewModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      </div>
    </>
  );
}

// Custom Event rendering for FullCalendar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCalendarEvent = (eventInfo: any) => {
  const order = eventInfo.event.extendedProps.order as OrderItem;
  const isHigh = order?.priority === "Alta";

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white truncate rounded-md cursor-pointer hover:opacity-90 transition-opacity"
      style={{ backgroundColor: eventInfo.event.backgroundColor }}
    >
      {isHigh && <span className="size-1.5 rounded-full bg-white shrink-0 animate-ping" />}
      <span className="font-bold truncate">#{order?.code || ""}</span>
      <span className="truncate">{order?.clientName || eventInfo.event.title}</span>
    </div>
  );
};
