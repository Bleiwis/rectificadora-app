import React, { useState, useMemo } from "react";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import type { OrderItem } from "../pedidos/models/types";
import {
  formatDateSpanish,
  getDayDifference,
  getUrgencyMetadata,
  groupOrdersByDeliveryDate,
  getDeliveryStats,
} from "../../utils/deliverySchedule";
import {
  CalenderIcon,
  AlertIcon,
  EyeIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from "../../icons";

interface DeliveriesCardProps {
  orders: OrderItem[];
  onOpenOrderPreview: (order: OrderItem) => void;
  onOpenAllDeliveries: () => void;
}

type TabFilter = "next3" | "today" | "tomorrow" | "later" | "overdue";

export const DeliveriesCard: React.FC<DeliveriesCardProps> = ({
  orders,
  onOpenOrderPreview,
  onOpenAllDeliveries,
}) => {
  const [activeTab, setActiveTab] = useState<TabFilter>("next3");

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => getDeliveryStats(orders, todayIso), [orders, todayIso]);

  // Compute grouped orders based on selected tab
  const displayGroups = useMemo(() => {
    // Overdue tab
    if (activeTab === "overdue") {
      return groupOrdersByDeliveryDate(orders, {
        referenceDate: todayIso,
        includeOverdue: true,
      }).filter((g) => g.urgency === "overdue");
    }

    // Today tab
    if (activeTab === "today") {
      return groupOrdersByDeliveryDate(orders, {
        referenceDate: todayIso,
        maxDaysAhead: 0,
        includeOverdue: false,
      }).filter((g) => g.urgency === "today");
    }

    // Tomorrow tab
    if (activeTab === "tomorrow") {
      return groupOrdersByDeliveryDate(orders, {
        referenceDate: todayIso,
        maxDaysAhead: 1,
        includeOverdue: false,
      }).filter((g) => g.urgency === "tomorrow");
    }

    // Later (day2 and day3)
    if (activeTab === "later") {
      return groupOrdersByDeliveryDate(orders, {
        referenceDate: todayIso,
        maxDaysAhead: 3,
        includeOverdue: false,
      }).filter((g) => g.urgency === "day2" || g.urgency === "day3");
    }

    // Default: Next 3 days (Today + Tomorrow + Day 2 + Day 3)
    return groupOrdersByDeliveryDate(orders, {
      referenceDate: todayIso,
      maxDaysAhead: 3,
      includeOverdue: false,
    });
  }, [orders, todayIso, activeTab]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition-all dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <CalenderIcon className="size-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Próximas Entregas de Pedidos
              </h3>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {stats.next3DaysCount} en 3 días
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Priorización de entrega por día y estado de trabajo de rectificación
            </p>
          </div>
        </div>

        {/* Action Button: Opens full schedule */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAllDeliveries}
          startIcon={<CalenderIcon className="size-4" />}
          className="w-full sm:w-auto"
        >
          Ver Cronograma Completo
        </Button>
      </div>

      {/* Segmented Filter Pills */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setActiveTab("next3")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "next3"
              ? "bg-brand-500 text-white shadow-xs"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          <span>Próximos 3 días</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-xxs font-bold">
            {stats.next3DaysCount}
          </span>
        </button>

        {/* Hoy Tab (Urgent focus) */}
        <button
          type="button"
          onClick={() => setActiveTab("today")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "today"
              ? "bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/40"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
          }`}
        >
          <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Hoy</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-xxs font-bold ${
              activeTab === "today" ? "bg-white/20 text-white" : "bg-amber-200/80 text-amber-900"
            }`}
          >
            {stats.todayCount}
          </span>
        </button>

        {/* Mañana Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("tomorrow")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "tomorrow"
              ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/40"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
          }`}
        >
          <span>Mañana</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-xxs font-bold ${
              activeTab === "tomorrow" ? "bg-white/20 text-white" : "bg-blue-200/80 text-blue-900"
            }`}
          >
            {stats.tomorrowCount}
          </span>
        </button>

        {/* En 2 y 3 días Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("later")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "later"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          <span>En 2-3 días</span>
        </button>

        {/* Overdue alert tab (shown if any exist) */}
        {stats.overdueCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("overdue")}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === "overdue"
                ? "bg-red-600 text-white shadow-xs ring-2 ring-red-400/40"
                : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            <AlertIcon className="size-3.5" />
            <span>Atrasadas</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xxs font-bold ${
                activeTab === "overdue" ? "bg-white/20 text-white" : "bg-red-200 text-red-900"
              }`}
            >
              {stats.overdueCount}
            </span>
          </button>
        )}
      </div>

      {/* Main Delivery Day Groups */}
      <div className="mt-5 space-y-5">
        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircleIcon className="size-6" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-gray-800 dark:text-white">
              No hay entregas pendientes para este período
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Todos los pedidos programados para estas fechas están al día o ya fueron retirados.
            </p>
          </div>
        ) : (
          displayGroups.map((group) => {
            const dayDiff = getDayDifference(group.date, todayIso);
            const meta = getUrgencyMetadata(group.urgency, dayDiff);

            return (
              <div
                key={group.date}
                className={`rounded-xl border p-4 transition-all ${meta.borderClass} ${meta.bgLightClass}`}
              >
                {/* Day Header with Relative Badge & Count */}
                <div className="flex items-center justify-between border-b border-gray-200/60 pb-3 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${meta.dotColorClass} animate-pulse`} />
                    <Badge variant={meta.badgeVariant} color={meta.badgeColor}>
                      {meta.label}
                    </Badge>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {formatDateSpanish(group.date)}
                    </span>
                    <span className="text-xxs text-gray-500 dark:text-gray-400">
                      ({group.date})
                    </span>
                  </div>

                  <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-gray-700 shadow-2xs dark:bg-gray-900/80 dark:text-gray-300">
                    {group.count} {group.count === 1 ? "entrega" : "entregas"}
                  </span>
                </div>

                {/* Multiple Orders Grid for this Day */}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        onClick={() => onOpenOrderPreview(order)}
                        className="group flex flex-col justify-between rounded-lg border border-gray-200/80 bg-white/90 p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/90 dark:hover:border-brand-500 cursor-pointer"
                      >
                        <div>
                          {/* Order Top line: Code, Priority, Payment */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                              #{order.code}
                            </span>
                            <div className="flex items-center gap-1">
                              {order.priority === "Alta" && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-xxs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                  <AlertIcon className="size-2.5" />
                                  Alta
                                </span>
                              )}
                              <Badge variant="light" color={paymentBadgeColor} size="sm">
                                {order.paymentStatus}
                              </Badge>
                            </div>
                          </div>

                          {/* Client & Engine */}
                          <div className="mt-2">
                            <div className="text-xs font-bold text-gray-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400 transition-colors">
                              {order.clientName} {order.clientLastName}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-600 line-clamp-1 dark:text-gray-300 font-medium">
                              🔧 {order.engineModel}
                            </div>
                            {order.clientPhone && (
                              <div className="mt-1 text-xxs text-gray-500 dark:text-gray-400">
                                📞 {order.clientPhone}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card bottom: Total and Quick Action */}
                        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xxs text-gray-500 dark:border-gray-800/80 dark:text-gray-400">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            ${(order.totalUSD || 0).toFixed(2)} USD
                          </span>
                          <span className="flex items-center gap-1 font-bold text-brand-600 group-hover:translate-x-0.5 transition-transform dark:text-brand-400">
                            <EyeIcon className="size-3" />
                            Ver orden
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

      {/* Card Footer Strip with Quick Summary & Action */}
      <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Hoy:{" "}
            <strong className="text-amber-600 dark:text-amber-400 font-bold">
              {stats.todayCount}
            </strong>
          </span>
          <span>•</span>
          <span>
            Mañana:{" "}
            <strong className="text-blue-600 dark:text-blue-400 font-bold">
              {stats.tomorrowCount}
            </strong>
          </span>
          <span>•</span>
          <span>
            Total en 3 días:{" "}
            <strong className="text-gray-900 dark:text-white font-bold">
              {stats.next3DaysCount}
            </strong>
          </span>
          {stats.overdueCount > 0 && (
            <>
              <span>•</span>
              <span className="text-red-600 dark:text-red-400 font-bold">
                ⚠️ {stats.overdueCount} atrasada(s)
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenAllDeliveries}
          className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300 cursor-pointer"
        >
          <span>Ver todas las entregas programadas ({stats.totalPendingDeliveries})</span>
          <ArrowRightIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

export default DeliveriesCard;
