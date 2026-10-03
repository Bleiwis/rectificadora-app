import React, { useState, useMemo } from "react";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import type { OrderItem } from "../pedidos/models/types";
import {
  getReceivablesStats,
  filterReceivables,
  classifyAgingTier,
  getAgingDays,
  getAgingTierMetadata,
  getOrderBalanceUSD,
  getOrderPaidUSD,
  generateWhatsAppReminder,
  type ReceivablesTabFilter,
} from "../../utils/receivablesSchedule";
import {
  DollarLineIcon,
  AlertIcon,
  EyeIcon,
  CheckCircleIcon,
  PaperPlaneIcon,
} from "../../icons";

interface ReceivablesCardProps {
  orders: OrderItem[];
  bcvRate?: number;
  onOpenOrderPreview: (order: OrderItem) => void;
  onOpenPayment: (order: OrderItem) => void;
  onOpenAllReceivables: () => void;
}

export const ReceivablesCard: React.FC<ReceivablesCardProps> = ({
  orders,
  bcvRate,
  onOpenOrderPreview,
  onOpenPayment,
  onOpenAllReceivables,
}) => {
  const [activeTab, setActiveTab] = useState<ReceivablesTabFilter>("all");

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => getReceivablesStats(orders, todayIso), [orders, todayIso]);

  const filteredOrders = useMemo(() => {
    return filterReceivables(orders, {
      tab: activeTab,
      referenceDate: todayIso,
    });
  }, [orders, activeTab, todayIso]);

  const handleSendWhatsApp = (order: OrderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rawPhone = (order.clientPhone || "").replace(/\D/g, "");
    if (!rawPhone) {
      alert("La orden no tiene número de teléfono registrado.");
      return;
    }

    // Format phone: if Venezuelan 04XX, convert to 584XX
    let internationalPhone = rawPhone;
    if (rawPhone.startsWith("0")) {
      internationalPhone = "58" + rawPhone.slice(1);
    } else if (!rawPhone.startsWith("58") && rawPhone.length === 10) {
      internationalPhone = "58" + rawPhone;
    }

    const message = generateWhatsAppReminder(order, { bcvRate });
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${internationalPhone}?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition-all dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <DollarLineIcon className="size-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Cuentas por Cobrar & Mora
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono">
                ${stats.totalBalanceUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Control de saldos pendientes, días de mora y contacto directo con el cliente
            </p>
          </div>
        </div>

        {/* Action Button: Opens full receivables modal */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAllReceivables}
          startIcon={<DollarLineIcon className="size-4" />}
          className="w-full sm:w-auto"
        >
          Ver Cartera Completa ({stats.totalOrdersWithBalance})
        </Button>
      </div>

      {/* Segmented Filter Pills */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-800">
        {/* All Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "all"
              ? "bg-brand-500 text-white shadow-xs"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          <span>Todos los saldos</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-xxs font-bold">
            {stats.totalOrdersWithBalance}
          </span>
        </button>

        {/* Critical Overdue Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("critical")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "critical"
              ? "bg-red-600 text-white shadow-xs ring-2 ring-red-400/40"
              : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {stats.criticalCount > 0 && (
            <span className="size-2 rounded-full bg-red-400 animate-pulse" />
          )}
          <span>Mora Crítica</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-xxs font-bold ${
              activeTab === "critical" ? "bg-white/20 text-white" : "bg-red-200/80 text-red-900"
            }`}
          >
            {stats.criticalCount}
          </span>
        </button>

        {/* Withdrawn with Debt Tab */}
        {stats.withdrawnWithDebtCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("withdrawn")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === "withdrawn"
                ? "bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/40"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            <AlertIcon className="size-3.5" />
            <span>Retirado con Deuda</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xxs font-bold ${
                activeTab === "withdrawn" ? "bg-white/20 text-white" : "bg-amber-200/80 text-amber-900"
              }`}
            >
              {stats.withdrawnWithDebtCount}
            </span>
          </button>
        )}

        {/* Partial Paid Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("partial")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "partial"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          <span>Abonadas</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-xxs font-bold">
            {stats.partialPaidCount}
          </span>
        </button>

        {/* Current Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("current")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "current"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          <span>Al día</span>
        </button>
      </div>

      {/* Main List of Pending Receivables */}
      <div className="mt-5 space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircleIcon className="size-6" />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
              {activeTab === "critical"
                ? "¡Excelente! No hay órdenes en mora crítica"
                : activeTab === "withdrawn"
                ? "No hay piezas retiradas con saldo pendiente"
                : "No hay cuentas pendientes por cobrar en esta categoría"}
            </h4>
            <p className="mt-1 text-xs text-gray-400">
              La cartera de cobro se encuentra al día.
            </p>
          </div>
        ) : (
          filteredOrders.slice(0, 5).map((order) => {
            const balanceUSD = getOrderBalanceUSD(order);
            const paidUSD = getOrderPaidUSD(order);
            const totalUSD = Number(order.totalUSD || 0);
            const agingDays = getAgingDays(order, todayIso);
            const tier = classifyAgingTier(order, todayIso);
            const meta = getAgingTierMetadata(tier, agingDays);
            const isWithdrawn =
              (order.orderStatus || "Ingresado") === "Retirado" ||
              (order.orderStatus || "Ingresado") === "Parcialmente retirado";
            const percentPaid = totalUSD > 0 ? Math.min(100, Math.round((paidUSD / totalUSD) * 100)) : 0;

            return (
              <div
                key={order.id}
                onClick={() => onOpenOrderPreview(order)}
                className="group relative flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:border-gray-300 hover:bg-white hover:shadow-sm dark:border-gray-800/60 dark:bg-white/[0.01] dark:hover:border-gray-700 dark:hover:bg-white/[0.03] cursor-pointer"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {/* Client and Engine info */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white font-bold text-gray-700 shadow-2xs dark:bg-gray-800 dark:text-gray-200 text-xs">
                      #{order.code}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {order.clientName} {order.clientLastName}
                        </span>
                        {/* Physical status badge */}
                        {isWithdrawn ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xxs font-bold text-red-800 dark:bg-red-950/60 dark:text-red-300">
                            ⚠️ Pieza Retirada
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xxs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            En Taller
                          </span>
                        )}
                        {/* Aging badge */}
                        <Badge color={meta.badgeColor} variant={meta.badgeVariant} size="sm">
                          {meta.label}
                        </Badge>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        {order.engineModel && (
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            🔧 {order.engineModel}
                          </span>
                        )}
                        {order.clientPhone && (
                          <span>📞 {order.clientPhone}</span>
                        )}
                        {order.tentativeDeliveryDate && (
                          <span>Entrega: {order.tentativeDeliveryDate}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial figures */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center border-t border-gray-100 pt-2 sm:border-0 sm:pt-0 dark:border-gray-800">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-gray-400">Saldo:</span>
                      <span className="font-mono text-base font-bold text-red-600 dark:text-red-400">
                        ${balanceUSD.toFixed(2)} USD
                      </span>
                    </div>
                    {bcvRate && bcvRate > 0 && (
                      <span className="text-xxs text-gray-400">
                        ≈ Bs. {(balanceUSD * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar + Quick Actions */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100/70 pt-2.5 dark:border-gray-800/60">
                  <div className="flex items-center gap-2 text-xxs text-gray-400 sm:w-1/2">
                    <div className="h-1.5 w-24 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                    <span>{percentPaid}% pagado (${paidUSD.toFixed(2)} de ${totalUSD.toFixed(2)})</span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {/* WhatsApp Action */}
                    <button
                      type="button"
                      onClick={(e) => handleSendWhatsApp(order, e)}
                      title="Enviar recordatorio por WhatsApp"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 transition cursor-pointer"
                    >
                      <PaperPlaneIcon className="size-3.5" />
                      <span>Cobrar por WhatsApp</span>
                    </button>

                    {/* Quick Payment Action */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPayment(order);
                      }}
                      title="Registrar cobro de saldo"
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300 transition cursor-pointer"
                    >
                      <DollarLineIcon className="size-3.5" />
                      <span>Cobrar</span>
                    </button>

                    {/* Preview Action */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenOrderPreview(order);
                      }}
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
                      title="Ver detalles de orden"
                    >
                      <EyeIcon className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {filteredOrders.length > 5 && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onOpenAllReceivables}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer"
            >
              + Ver {filteredOrders.length - 5} órdenes más con saldo pendiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceivablesCard;
