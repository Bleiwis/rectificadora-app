import React, { useState, useMemo } from "react";
import { Modal } from "../ui/modal";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import type { OrderItem } from "../pedidos/models/types";
import {
  getReceivablesStats,
  filterReceivables,
  classifyAgingTier,
  getAgingDays,
  getAgingTierMetadata,
  getOrderBalanceUSD,
  generateWhatsAppReminder,
  type ReceivablesTabFilter,
} from "../../utils/receivablesSchedule";
import {
  DollarLineIcon,
  EyeIcon,
  PaperPlaneIcon,
  CheckCircleIcon,
  FileIcon,
} from "../../icons";

interface AllReceivablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderItem[];
  bcvRate?: number;
  onSelectOrder: (order: OrderItem) => void;
  onOpenPayment: (order: OrderItem) => void;
}

export const AllReceivablesModal: React.FC<AllReceivablesModalProps> = ({
  isOpen,
  onClose,
  orders,
  bcvRate,
  onSelectOrder,
  onOpenPayment,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<ReceivablesTabFilter>("all");

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => getReceivablesStats(orders, todayIso), [orders, todayIso]);

  const filteredOrders = useMemo(() => {
    return filterReceivables(orders, {
      tab: activeTab,
      searchTerm,
      referenceDate: todayIso,
    });
  }, [orders, activeTab, searchTerm, todayIso]);

  const handleSendWhatsApp = (order: OrderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rawPhone = (order.clientPhone || "").replace(/\D/g, "");
    if (!rawPhone) {
      alert("La orden no tiene número de teléfono registrado.");
      return;
    }

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

  const handlePrintWorksheet = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rowsHtml = filteredOrders
      .map((o) => {
        const bal = getOrderBalanceUSD(o);
        const days = getAgingDays(o, todayIso);
        const status = (o.orderStatus || "Ingresado") === "Retirado" ? "⚠️ RETIRADO" : "En Taller";
        return `
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #ddd; font-weight: bold;">#${o.code}</td>
            <td style="padding: 6px; border-bottom: 1px solid #ddd;">${o.clientName} ${o.clientLastName}<br/><small>${o.clientPhone || "Sin tlf"}</small></td>
            <td style="padding: 6px; border-bottom: 1px solid #ddd;">${o.engineModel || "N/D"}</td>
            <td style="padding: 6px; border-bottom: 1px solid #ddd;">${status}</td>
            <td style="padding: 6px; border-bottom: 1px solid #ddd;">${days} días</td>
            <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">$${bal.toFixed(2)} USD</td>
          </tr>
        `;
      })
      .join("");

    const totalFilterBal = filteredOrders.reduce((sum, o) => sum + getOrderBalanceUSD(o), 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>Planilla de Cobranzas y Cuentas por Cobrar</title>
          <style>
            body { font-family: sans-serif; font-size: 12px; margin: 20px; color: #333; }
            h2 { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #f3f4f6; text-align: left; padding: 8px 6px; border-bottom: 2px solid #ccc; font-size: 11px; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px; }
          </style>
        </head>
        <body>
          <h2>Planilla de Gestión de Cobranzas - Rectificadora</h2>
          <div class="header-info">
            <span>Fecha de emisión: ${todayIso}</span>
            <span>Tasa BCV Referencia: ${bcvRate ? bcvRate.toFixed(2) : "N/D"}</span>
            <span>Total Pendiente Listado: <strong>$${totalFilterBal.toFixed(2)} USD</strong></span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente / Teléfono</th>
                <th>Motor</th>
                <th>Estado Pieza</th>
                <th>Atraso</th>
                <th style="text-align: right;">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[950px] p-6 sm:p-8"
      showCloseButton
    >
      <div className="flex flex-col space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <DollarLineIcon className="size-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Consolidado de Cartera y Cobranzas
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Auditoría de mora, saldo total en circulación y seguimiento de deudores
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintWorksheet}
            startIcon={<FileIcon className="size-4" />}
          >
            Imprimir Planilla de Cobro
          </Button>
        </div>

        {/* Resumen de Cartera KPI Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* KPI 1 */}
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-white/[0.02]">
            <span className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
              Total por Cobrar
            </span>
            <div className="mt-1 font-mono text-lg font-bold text-red-600 dark:text-red-400">
              ${stats.totalBalanceUSD.toFixed(2)} USD
            </div>
            {bcvRate && bcvRate > 0 && (
              <div className="text-xxs text-gray-400">
                ≈ Bs. {(stats.totalBalanceUSD * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {/* KPI 2 */}
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-white/[0.02]">
            <span className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
              Recaudación
            </span>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {stats.recoveryPercentage}%
            </div>
            <div className="text-xxs text-gray-400">
              ${stats.totalPaidUSD.toFixed(2)} pagados
            </div>
          </div>

          {/* KPI 3 */}
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-white/[0.02]">
            <span className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
              Mora Crítica (&gt;30d)
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-bold text-gray-800 dark:text-white">
                {stats.criticalCount}
              </span>
              <span className="text-xxs text-gray-400">órdenes</span>
            </div>
            <div className="text-xxs text-red-500 font-medium">Atención prioritaria</div>
          </div>

          {/* KPI 4 */}
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-white/[0.02]">
            <span className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
              Retirados con Deuda
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
                {stats.withdrawnWithDebtCount}
              </span>
              <span className="text-xxs text-gray-400">clientes</span>
            </div>
            <div className="text-xxs text-amber-600 dark:text-amber-400 font-medium">Sin pieza en taller</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tab buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTab === "all"
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              Todos ({stats.totalOrdersWithBalance})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("critical")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTab === "critical"
                  ? "bg-red-600 text-white"
                  : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              Mora Crítica ({stats.criticalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("withdrawn")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTab === "withdrawn"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              Retirados ({stats.withdrawnWithDebtCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("partial")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTab === "partial"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              Abonadas ({stats.partialPaidCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("current")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTab === "current"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              Al Día
            </button>
          </div>

          {/* Search box */}
          <div className="w-full sm:w-64">
            <Input
              type="text"
              placeholder="Buscar cliente, orden, CI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Receivables List Table */}
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircleIcon className="size-8 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                No hay órdenes que coincidan con la búsqueda.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  <th className="p-3">Orden</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Motor</th>
                  <th className="p-3">Urgencia / Mora</th>
                  <th className="p-3 text-right">Total / Saldo</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOrders.map((order) => {
                  const balanceUSD = getOrderBalanceUSD(order);
                  const totalUSD = Number(order.totalUSD || 0);
                  const agingDays = getAgingDays(order, todayIso);
                  const tier = classifyAgingTier(order, todayIso);
                  const meta = getAgingTierMetadata(tier, agingDays);
                  const isWithdrawn =
                    (order.orderStatus || "Ingresado") === "Retirado" ||
                    (order.orderStatus || "Ingresado") === "Parcialmente retirado";

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition"
                    >
                      <td className="p-3 font-bold text-gray-900 dark:text-white">
                        #{order.code}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {order.clientName} {order.clientLastName}
                        </div>
                        <div className="text-xxs text-gray-400">
                          {order.clientPhone || "Sin teléfono"} {order.clientCI ? `• CI: ${order.clientCI}` : ""}
                        </div>
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">
                        <div>{order.engineModel || "N/D"}</div>
                        {isWithdrawn ? (
                          <span className="text-xxs font-bold text-red-600 dark:text-red-400">
                            ⚠️ Retirado
                          </span>
                        ) : (
                          <span className="text-xxs text-gray-400">En taller</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge color={meta.badgeColor} variant={meta.badgeVariant} size="sm">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-mono font-bold text-red-600 dark:text-red-400">
                          ${balanceUSD.toFixed(2)} USD
                        </div>
                        <div className="text-xxs text-gray-400 font-mono">
                          Total: ${totalUSD.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleSendWhatsApp(order, e)}
                            title="Cobrar vía WhatsApp"
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                          >
                            <PaperPlaneIcon className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPayment(order)}
                            title="Registrar cobro"
                            className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition cursor-pointer font-mono font-bold"
                          >
                            <DollarLineIcon className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectOrder(order)}
                            title="Ver orden"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
                          >
                            <EyeIcon className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800">
          <span>Mostrando {filteredOrders.length} de {stats.totalOrdersWithBalance} órdenes pendientes</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AllReceivablesModal;
