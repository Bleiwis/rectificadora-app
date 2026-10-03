import { useState } from "react";
import Button from "../../ui/button/Button";
import Badge from "../../ui/badge/Badge";
import { OrderItem, OrderPartDeliveryRow, OrderPaymentRow, PartRow } from "../models/types";
import {
  DollarLineIcon,
  BoxIcon,
  UserIcon,
  CalenderIcon,
  CheckCircleIcon,
  AlertIcon,
  CloseIcon,
  BoltIcon,
  FileIcon,
  PaperPlaneIcon,
  TrashBinIcon,
} from "../../../icons";
import { generateWhatsAppReminder } from "../../../utils/receivablesSchedule";

interface OrderDetailModalProps {
  order: OrderItem | null;
  paymentHistory: OrderPaymentRow[];
  withdrawalHistory: OrderPartDeliveryRow[];
  onClose: () => void;
  onAssignResponsible: (order: OrderItem) => void;
  onOpenPayment: (order: OrderItem) => void;
  onOpenWithdrawal: (order: OrderItem) => void;
  onOpenCancel: (order: OrderItem) => void;
  onOpenPrint: (order: OrderItem) => void;
  getOrderPaidUSD: (order: OrderItem) => number;
  getOrderBalanceUSD: (order: OrderItem) => number;
  getPartDisplayName: (part?: PartRow) => string;
  getPartAdmittedQty: (part: PartRow) => number;
  buildDeliveredByPartMap: (deliveries: OrderPartDeliveryRow[]) => Map<number, number>;
}

export default function OrderDetailModal({
  order,
  paymentHistory,
  withdrawalHistory,
  onClose,
  onAssignResponsible,
  onOpenPayment,
  onOpenWithdrawal,
  onOpenCancel,
  onOpenPrint,
  getOrderPaidUSD,
  getOrderBalanceUSD,
  getPartDisplayName,
  getPartAdmittedQty,
  buildDeliveredByPartMap,
}: OrderDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"parts" | "financial">("parts");

  if (!order) return null;

  const isCanceled = (order.orderStatus || "Ingresado") === "Cancelada";
  const paidUSD = getOrderPaidUSD(order);
  const balanceUSD = getOrderBalanceUSD(order);
  const totalUSD = Number(order.totalUSD || 0);
  const percentPaid = totalUSD > 0 ? Math.min(100, Math.round((paidUSD / totalUSD) * 100)) : 0;

  // Parts delivered stats
  const deliveredMap = buildDeliveredByPartMap(withdrawalHistory);
  let totalAdmitted = 0;
  let totalDelivered = 0;
  order.parts.forEach((part, index) => {
    const admitted = getPartAdmittedQty(part);
    const delivered = deliveredMap.get(index) || 0;
    totalAdmitted += admitted;
    totalDelivered += delivered;
  });
  const pendingPartsCount = Math.max(0, totalAdmitted - totalDelivered);
  const partsDeliveredPercent =
    totalAdmitted > 0 ? Math.min(100, Math.round((totalDelivered / totalAdmitted) * 100)) : 0;

  // Order status badge color
  const orderStatusColor: "primary" | "success" | "warning" | "error" | "info" =
    order.orderStatus === "Retirado"
      ? "success"
      : order.orderStatus === "Parcialmente retirado"
      ? "warning"
      : order.orderStatus === "Cancelada"
      ? "error"
      : "info";

  // Payment status badge color
  const paymentStatusColor: "success" | "warning" | "error" =
    order.paymentStatus === "Paga"
      ? "success"
      : order.paymentStatus === "Abonada"
      ? "warning"
      : "error";

  const handleSendWhatsApp = () => {
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

    const message = generateWhatsAppReminder(order);
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${internationalPhone}?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-5 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-[1020px] max-h-[92vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 dark:text-white">
        
        {/* Header Section */}
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/50 p-5 sm:px-8 sm:py-6 dark:border-gray-800 dark:bg-white/[0.01]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 shadow-2xs font-bold text-lg">
                #{order.code}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Orden de Servicio #{order.code}
                  </h3>
                  <Badge color={orderStatusColor} variant="light" size="sm">
                    {order.orderStatus || "Ingresado"}
                  </Badge>
                  <Badge color={paymentStatusColor} variant="light" size="sm">
                    {order.paymentStatus === "Paga" ? "✓ Totalmente Paga" : order.paymentStatus}
                  </Badge>
                  {order.priority && order.priority !== "Baja" && (
                    <Badge
                      color={order.priority === "Alta" ? "error" : "warning"}
                      variant="light"
                      size="sm"
                    >
                      Prioridad {order.priority}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Ingreso: {order.entryDate || "N/D"} • Entrega estimada: {order.tentativeDeliveryDate || "N/D"} ({order.deliveryDays || 0} días hábiles)
                </p>
              </div>
            </div>

            {/* Close Button X */}
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
              title="Cerrar modal"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          {/* Action Toolbar with clear visual hierarchy */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-800">
            {/* Main Operations Group */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Registrar Pago (Primary CTA if balance > 0) */}
              <Button
                onClick={() => onOpenPayment(order)}
                size="sm"
                variant={balanceUSD > 0.001 ? "primary" : "outline"}
                disabled={isCanceled}
                startIcon={<DollarLineIcon className="size-4" />}
              >
                {balanceUSD > 0.001 ? "Registrar Pago / Abono" : "Ver / Registrar Pago"}
              </Button>

              {/* Registrar Retiro */}
              <Button
                onClick={() => onOpenWithdrawal(order)}
                size="sm"
                variant={balanceUSD <= 0.001 && pendingPartsCount > 0 ? "primary" : "outline"}
                disabled={isCanceled || pendingPartsCount === 0}
                startIcon={<BoxIcon className="size-4" />}
              >
                {pendingPartsCount === 0 ? "Piezas Entregadas" : "Registrar Retiro"}
              </Button>

              {/* Asignar Responsable */}
              <Button
                onClick={() => !isCanceled && onAssignResponsible(order)}
                variant="outline"
                size="sm"
                disabled={isCanceled}
                startIcon={<UserIcon className="size-4" />}
              >
                {order.responsible ? `Responsable: ${order.responsible}` : "Asignar Responsable"}
              </Button>
            </div>

            {/* Tools and Secondary Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* WhatsApp Quick Link */}
              {order.clientPhone && (
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 transition cursor-pointer"
                  title="Enviar estado de cuenta por WhatsApp"
                >
                  <PaperPlaneIcon className="size-3.5" />
                  <span>WhatsApp</span>
                </button>
              )}

              {/* Ver Comprobante */}
              <Button
                onClick={() => onOpenPrint(order)}
                variant="outline"
                size="sm"
                startIcon={<FileIcon className="size-4" />}
              >
                Comprobante
              </Button>

              {/* Cancelar Orden (Destructive Ghost Action) */}
              {!isCanceled && (
                <button
                  type="button"
                  onClick={() => onOpenCancel(order)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition cursor-pointer"
                  title="Cancelar esta orden de servicio"
                >
                  <TrashBinIcon className="size-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body - Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {/* Canceled banner if applicable */}
          {isCanceled && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <AlertIcon className="size-5 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-bold text-sm">Orden Cancelada</p>
                <p className="mt-0.5">Motivo: {order.cancelReason || "Sin motivo registrado"}</p>
                <p className="mt-1 text-xxs text-red-600 dark:text-red-400">
                  Cancelada el {order.canceledAt ? new Date(order.canceledAt).toLocaleString() : "-"}
                  {order.canceledBy ? ` por ${order.canceledBy}` : ""}
                </p>
              </div>
            </div>
          )}

          {/* Top 3 Summary Bento Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Card 1: Cliente & Contacto */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/40 p-4.5 dark:border-gray-800 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <UserIcon className="size-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Cliente
                  </span>
                </div>
                {order.clientCI && (
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xxs font-mono font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {order.clientCI}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <p className="font-bold text-gray-900 dark:text-white text-base">
                  {order.clientName} {order.clientLastName}
                </p>
                <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  {order.clientPhone && (
                    <p className="flex items-center gap-1.5">
                      <span>📞 {order.clientPhone}</span>
                    </p>
                  )}
                  {order.clientAddress && (
                    <p className="flex items-start gap-1.5 text-gray-500 dark:text-gray-400">
                      <span>📍 {order.clientAddress}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Motor & Taller */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/40 p-4.5 dark:border-gray-800 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <BoltIcon className="size-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Motor & Taller
                  </span>
                </div>
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xxs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {order.responsible || "Sin responsable"}
                </span>
              </div>

              <div className="mt-3">
                <p className="font-bold text-gray-900 dark:text-white text-base">
                  🔧 {order.engineModel || "Modelo no especificado"}
                </p>
                <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <p className="flex items-center gap-1.5">
                    <CalenderIcon className="size-3.5 text-gray-400" />
                    <span>Entrega: {order.tentativeDeliveryDate || "N/D"}</span>
                  </p>
                  <p className="text-gray-400 text-xxs">
                    Registrado por: {order.createdBy || "Sistema"}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Estado Financiero & Cobro */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/40 p-4.5 dark:border-gray-800 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <DollarLineIcon className="size-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Estado de Cobro
                  </span>
                </div>
                <span className="text-xxs font-semibold text-gray-500">
                  {percentPaid}% abonado
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-xxs uppercase tracking-wider text-gray-400">Saldo Restante</span>
                  <div className={`font-mono text-xl font-bold ${balanceUSD > 0.001 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    ${balanceUSD.toFixed(2)} USD
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xxs uppercase tracking-wider text-gray-400">Total Orden</span>
                  <div className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-200">
                    ${totalUSD.toFixed(2)} USD
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${balanceUSD <= 0.001 ? "bg-emerald-500" : "bg-brand-500"}`}
                  style={{ width: `${percentPaid}%` }}
                />
              </div>
              <p className="mt-1 text-xxs text-gray-400 text-right">
                Abonado a la fecha: ${paidUSD.toFixed(2)} USD
              </p>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setActiveTab("parts")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "parts"
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <BoxIcon className="size-4" />
              <span>Partes Admitidas & Despacho ({totalDelivered}/{totalAdmitted})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("financial")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "financial"
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <DollarLineIcon className="size-4" />
              <span>Servicios, Repuestos & Historial ({paymentHistory.length} pagos)</span>
            </button>
          </div>

          {/* TAB 1: Partes & Despacho */}
          {activeTab === "parts" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left: Parts Table (2 cols) */}
              <div className="lg:col-span-2 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                      Partes y Tracking de Despacho
                    </h5>
                    <p className="text-xs text-gray-400">
                      Control unitario de piezas ingresadas y retiradas por el cliente
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      {partsDeliveredPercent}% entregado
                    </span>
                    <div className="h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${partsDeliveredPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/60 font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                        <th className="py-2.5 px-3">Pieza</th>
                        <th className="py-2.5 px-3 text-center">Admitido</th>
                        <th className="py-2.5 px-3 text-center">Retirado</th>
                        <th className="py-2.5 px-3 text-center">Pendiente</th>
                        <th className="py-2.5 px-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {order.parts.map((part, partIndex) => {
                        const admitted = getPartAdmittedQty(part);
                        const delivered = deliveredMap.get(partIndex) || 0;
                        const pending = Math.max(0, admitted - delivered);
                        const isComplete = delivered >= admitted && admitted > 0;

                        return (
                          <tr
                            key={`${order.id}_detail_part_${partIndex}`}
                            className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]"
                          >
                            <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                              {getPartDisplayName(part)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-medium">
                              {admitted}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              {delivered}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                              {pending}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isComplete ? (
                                <Badge color="success" variant="light" size="sm">
                                  ✓ Completo
                                </Badge>
                              ) : delivered > 0 ? (
                                <Badge color="warning" variant="light" size="sm">
                                  Parcial ({delivered}/{admitted})
                                </Badge>
                              ) : (
                                <Badge color="light" variant="light" size="sm">
                                  En taller
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Withdrawal History (1 col) */}
              <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                  Historial de Retiros ({withdrawalHistory.length})
                </h5>
                <p className="text-xs text-gray-400 mb-4">
                  Despachos registrados a la fecha
                </p>

                {withdrawalHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                    <BoxIcon className="size-8 text-gray-300 dark:text-gray-700" />
                    <p className="mt-2 text-xs">Sin retiros registrados aún.</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                    {withdrawalHistory.map((delivery) => {
                      const part = order.parts[delivery.partIndex];
                      return (
                        <div
                          key={delivery.id}
                          className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-xs dark:border-gray-800 dark:bg-white/[0.01]"
                        >
                          <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white">
                            <span>{getPartDisplayName(part)}</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              x{delivery.quantity}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xxs text-gray-500 dark:text-gray-400">
                            <span>{new Date(delivery.deliveredAt).toLocaleDateString()}</span>
                            <span>{delivery.note || "Sin nota"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Servicios, Repuestos & Historial Financiero */}
          {activeTab === "financial" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left: Services & Repuestos breakdown (2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Services */}
                <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                  <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                    Servicios de Rectificación
                  </h5>
                  <p className="text-xs text-gray-400 mb-3">
                    Trabajos cotizados para esta orden
                  </p>
                  {order.services.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin servicios registrados.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {order.services.map((service, index) => (
                        <div
                          key={`${order.id}_service_${index}`}
                          className="flex items-center justify-between py-2 text-xs"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {service.name}
                          </span>
                          <span className="font-mono font-bold text-gray-900 dark:text-white">
                            ${service.priceUSD.toFixed(2)} USD
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inventory Items */}
                {order.inventoryItems && order.inventoryItems.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                      Repuestos de Inventario
                    </h5>
                    <p className="text-xs text-gray-400 mb-3">
                      Piezas provistas por el taller
                    </p>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {order.inventoryItems.map((item) => (
                        <div
                          key={`${order.id}_inv_${item.id}`}
                          className="flex items-center justify-between py-2 text-xs"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {item.name} <span className="text-gray-400">(x{item.quantity})</span>
                          </span>
                          <span className="font-mono font-bold text-gray-900 dark:text-white">
                            ${(item.priceUSD * item.quantity).toFixed(2)} USD
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Payment History Timeline (1 col) */}
              <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                <div className="flex items-center justify-between mb-1">
                  <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                    Historial de Pagos
                  </h5>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    ${paidUSD.toFixed(2)} USD
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Registro de abonos y cancelaciones
                </p>

                {paymentHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                    <DollarLineIcon className="size-8 text-gray-300 dark:text-gray-700" />
                    <p className="mt-2 text-xs">No hay pagos registrados aún.</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                    {paymentHistory.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-xs dark:border-gray-800 dark:bg-white/[0.01]"
                      >
                        <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white">
                          <span>{p.currency} {p.amount.toFixed(2)}</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            ${p.paidUSD.toFixed(2)} USD
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xxs text-gray-500 dark:text-gray-400">
                          <span>{new Date(p.paidAt).toLocaleDateString()}</span>
                          <span>{p.note || "Sin nota"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <CheckCircleIcon className="size-4 text-emerald-500" />
            <span>Detalle consolidado de orden • Rectificadora App</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

      </div>
    </div>
  );
}
