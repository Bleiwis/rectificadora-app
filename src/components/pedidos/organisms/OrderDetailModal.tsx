import Button from "../../ui/button/Button";
import { OrderItem, OrderPartDeliveryRow, OrderPaymentRow, PartRow } from "../models/types";

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
  if (!order) return null;

  const isCanceled = (order.orderStatus || "Ingresado") === "Cancelada";

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-[980px] max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">Orden #{order.code}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Vista de detalle en modo solo lectura</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => !isCanceled && onAssignResponsible(order)} variant="outline" size="sm" disabled={isCanceled}>Asignar responsable</Button>
            <Button onClick={() => onOpenPayment(order)} size="sm" disabled={isCanceled}>Registrar pago</Button>
            <Button onClick={() => onOpenWithdrawal(order)} size="sm" disabled={isCanceled}>Registrar retiro</Button>
            <Button onClick={() => !isCanceled && onOpenCancel(order)} size="sm" disabled={isCanceled}>{isCanceled ? "Orden cancelada" : "Cancelar orden"}</Button>
            <Button onClick={() => onOpenPrint(order)} size="sm">Ver comprobante</Button>
            <Button onClick={onClose} variant="outline" size="sm">Cerrar</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-xs font-semibold uppercase text-gray-500">Cliente</p>
            <p className="mt-2 font-semibold text-gray-900 dark:text-white">{order.clientName} {order.clientLastName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">CI: {order.clientCI}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Tel: {order.clientPhone}</p>
            {order.clientAddress ? <p className="text-sm text-gray-600 dark:text-gray-300">Dir: {order.clientAddress}</p> : null}
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-xs font-semibold uppercase text-gray-500">Orden</p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Motor: {order.engineModel}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Ingreso: {order.entryDate}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Entrega estimada: {order.tentativeDeliveryDate}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Creado por: {order.createdBy}</p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-xs font-semibold uppercase text-gray-500">Estado y cobro</p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Estado pedido: {order.orderStatus || "Ingresado"}</p>
            {order.orderStatus === "Cancelada" && order.cancelReason ? (
              <>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">Motivo: {order.cancelReason}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cancelada el {order.canceledAt ? new Date(order.canceledAt).toLocaleString() : "-"}
                  {order.canceledBy ? ` por ${order.canceledBy}` : ""}
                </p>
              </>
            ) : null}
            <p className="text-sm text-gray-700 dark:text-gray-300">Responsable: {order.responsible || "Sin asignar"}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Pago: {order.paymentStatus}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Total: ${order.totalUSD.toFixed(2)} USD</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Abonado: ${getOrderPaidUSD(order).toFixed(2)} USD</p>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Saldo: ${getOrderBalanceUSD(order).toFixed(2)} USD</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Partes admitidas y tracking de retiro</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 text-left">Parte</th>
                    <th className="py-2 text-center">Admitido</th>
                    <th className="py-2 text-center">Retirado</th>
                    <th className="py-2 text-center">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {order.parts.map((part, partIndex) => {
                    const deliveredMap = buildDeliveredByPartMap(withdrawalHistory);
                    const admitted = getPartAdmittedQty(part);
                    const delivered = deliveredMap.get(partIndex) || 0;
                    const pending = Math.max(0, admitted - delivered);
                    return (
                      <tr key={`${order.id}_detail_part_${partIndex}`} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2">{getPartDisplayName(part)}</td>
                        <td className="py-2 text-center">{admitted}</td>
                        <td className="py-2 text-center">{delivered}</td>
                        <td className="py-2 text-center font-semibold text-amber-700 dark:text-amber-300">{pending}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Historial de pagos</h5>
            {paymentHistory.length === 0 ? (
              <p className="text-xs text-gray-500">Sin pagos registrados.</p>
            ) : (
              <ul className="max-h-40 overflow-y-auto space-y-1 text-xs">
                {paymentHistory.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 text-gray-600 dark:text-gray-300">
                    <span>{new Date(p.paidAt).toLocaleDateString()} - {p.currency} {p.amount.toFixed(2)}</span>
                    <span>${p.paidUSD.toFixed(2)} USD</span>
                  </li>
                ))}
              </ul>
            )}

            <h5 className="mt-5 mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Historial de retiros</h5>
            {withdrawalHistory.length === 0 ? (
              <p className="text-xs text-gray-500">Sin retiros registrados.</p>
            ) : (
              <ul className="max-h-40 overflow-y-auto space-y-1 text-xs">
                {withdrawalHistory.map((delivery) => {
                  const part = order.parts[delivery.partIndex];
                  return (
                    <li key={delivery.id} className="flex justify-between gap-2 text-gray-600 dark:text-gray-300">
                      <span>{new Date(delivery.deliveredAt).toLocaleDateString()} - {getPartDisplayName(part)} (x{delivery.quantity})</span>
                      <span>{delivery.note || "Sin nota"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {(order.services.length > 0 || (order.inventoryItems && order.inventoryItems.length > 0)) && (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {order.services.length > 0 && (
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Servicios</h5>
                <ul className="space-y-1 text-xs">
                  {order.services.map((service, index) => (
                    <li key={`${order.id}_service_${index}`} className="flex justify-between">
                      <span>{service.name}</span>
                      <span>${service.priceUSD.toFixed(2)} USD</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {order.inventoryItems && order.inventoryItems.length > 0 && (
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Repuestos</h5>
                <ul className="space-y-1 text-xs">
                  {order.inventoryItems.map((item) => (
                    <li key={`${order.id}_inv_${item.id}`} className="flex justify-between">
                      <span>{item.name} (x{item.quantity})</span>
                      <span>${(item.priceUSD * item.quantity).toFixed(2)} USD</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
