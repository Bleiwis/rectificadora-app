import React from "react";
import { useNavigate } from "react-router";
import { Modal } from "../ui/modal";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import type { OrderItem } from "../pedidos/models/types";
import {
  classifyDeliveryUrgency,
  formatDateSpanish,
  getDayDifference,
  getUrgencyMetadata,
} from "../../utils/deliverySchedule";
import {
  CalenderIcon,
  UserIcon,
  BoxIcon,
  DollarLineIcon,
  ArrowRightIcon,
} from "../../icons";

interface OrderQuickPreviewModalProps {
  order: OrderItem | null;
  onClose: () => void;
}

export const OrderQuickPreviewModal: React.FC<OrderQuickPreviewModalProps> = ({
  order,
  onClose,
}) => {
  const navigate = useNavigate();

  if (!order) return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const dayDiff = getDayDifference(order.tentativeDeliveryDate, todayIso);
  const urgency = classifyDeliveryUrgency(order.tentativeDeliveryDate, todayIso);
  const urgencyMeta = getUrgencyMetadata(urgency, dayDiff);

  const paymentBadgeColor: "success" | "info" | "warning" =
    order.paymentStatus === "Paga"
      ? "success"
      : order.paymentStatus === "Abonada"
      ? "info"
      : "warning";

  const priorityBadgeColor: "error" | "warning" | "light" =
    order.priority === "Alta"
      ? "error"
      : order.priority === "Media"
      ? "warning"
      : "light";

  const handleNavigateToOrders = () => {
    onClose();
    navigate(`/pedidos`);
  };

  return (
    <Modal
      isOpen={Boolean(order)}
      onClose={onClose}
      className="max-w-[650px] p-6 sm:p-8"
      showCloseButton
    >
      <div className="flex flex-col space-y-5">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                <CalenderIcon className="size-5" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Orden Nº {order.code}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ingreso: {order.entryDate || "N/D"} ({order.deliveryDays || 0} días hábiles)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={urgencyMeta.badgeVariant} color={urgencyMeta.badgeColor}>
                {urgencyMeta.label}
              </Badge>
              <Badge variant="light" color={paymentBadgeColor}>
                {order.paymentStatus}
              </Badge>
              <Badge variant="light" color={priorityBadgeColor}>
                Prioridad {order.priority || "Media"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tentative Delivery Alert Banner */}
        <div
          className={`flex items-center justify-between rounded-xl border p-3.5 text-xs ${urgencyMeta.borderClass} ${urgencyMeta.bgLightClass}`}
        >
          <div className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${urgencyMeta.dotColorClass} animate-pulse`} />
            <span className="font-semibold text-gray-900 dark:text-white">
              Fecha de Entrega Programada:
            </span>
            <span className={urgencyMeta.textColorClass}>
              {formatDateSpanish(order.tentativeDeliveryDate)} ({order.tentativeDeliveryDate})
            </span>
          </div>
          <span className="font-bold text-gray-700 dark:text-gray-300">
            {dayDiff < 0
              ? `Vencido hace ${Math.abs(dayDiff)} día(s)`
              : dayDiff === 0
              ? "Entrega Hoy"
              : dayDiff === 1
              ? "Entrega Mañana"
              : `En ${dayDiff} días`}
          </span>
        </div>

        {/* Client & Engine Info Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Client Card */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <UserIcon className="size-4" />
              <span>Datos del Cliente</span>
            </div>
            <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              {order.clientName} {order.clientLastName}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              C.I: {order.clientCI || "Sin registro"}
            </div>
            {order.clientPhone && (
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                📞 {order.clientPhone}
              </div>
            )}
            {order.clientAddress && (
              <div className="mt-1 text-xs text-gray-500 line-clamp-1 dark:text-gray-400">
                📍 {order.clientAddress}
              </div>
            )}
          </div>

          {/* Engine Card */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <BoxIcon className="size-4" />
              <span>Motor y Piezas</span>
            </div>
            <div className="mt-2 text-sm font-semibold text-brand-600 dark:text-brand-400">
              {order.engineModel}
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Piezas ingresadas: {order.parts?.length || 0} componente(s)
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Servicios: {order.services?.length || 0} trabajo(s) técnico(s)
            </div>
            {order.responsible && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Mecánico resp: <span className="font-medium text-gray-800 dark:text-gray-200">{order.responsible}</span>
              </div>
            )}
          </div>
        </div>

        {/* Services / Work List Preview */}
        {order.services && order.services.length > 0 && (
          <div className="rounded-xl border border-gray-200 p-3.5 dark:border-gray-800">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Trabajos / Rectificaciones contratadas:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {order.services.map((srv, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {srv.name} (${srv.priceUSD.toFixed(2)})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Financial Summary */}
        <div className="flex flex-wrap items-center justify-between rounded-xl bg-gray-100/70 p-4 dark:bg-white/[0.04]">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <DollarLineIcon className="size-5 text-gray-500" />
            <span>Monto Total Orden:</span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              ${(order.totalUSD || 0).toFixed(2)} USD
            </div>
            {order.totalVES ? (
              <div className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                Bs. {order.totalVES.toFixed(2)} VES
              </div>
            ) : null}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Cerrar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNavigateToOrders}
            endIcon={<ArrowRightIcon className="size-4" />}
            className="w-full sm:w-auto"
          >
            Abrir en Pedidos
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default OrderQuickPreviewModal;
