import ActionIconButton from "../atoms/ActionIconButton";
import { OrderItem } from "../models/types";

interface PedidosTableProps {
  orders: OrderItem[];
  onOpenOrderDetail: (order: OrderItem) => void;
  onOpenPrint: (order: OrderItem) => void;
  onOpenCancel: (order: OrderItem) => void;
  getOrderPaidUSD: (order: OrderItem) => number;
  getOrderBalanceUSD: (order: OrderItem) => number;
}

export default function PedidosTable({
  orders,
  onOpenOrderDetail,
  onOpenPrint,
  onOpenCancel,
  getOrderPaidUSD,
  getOrderBalanceUSD,
}: PedidosTableProps) {
  return (
    <div className="max-w-full overflow-x-auto">
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Haz click en una fila para ver el detalle de la orden y gestionar pago/retiro/responsable.
      </p>
      <table className="w-full table-auto text-left">
        <thead>
          <tr className="border-b border-gray-150 dark:border-gray-800">
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">N Pedido</th>
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">Cliente</th>
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">Motor</th>
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">Fechas</th>
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">Monto</th>
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">Pago</th>
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">Estado Pedido</th>
            <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">Responsable</th>
            <th className="pb-4.5 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
              onClick={() => onOpenOrderDetail(order)}
            >
              <td className="py-4 font-semibold text-gray-800 dark:text-white">{order.code}</td>
              <td className="py-4">
                <div className="font-medium text-gray-800 dark:text-white">{order.clientName} {order.clientLastName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">CI: {order.clientCI} | {order.clientPhone}</div>
              </td>
              <td className="py-4 text-sm text-gray-700 dark:text-gray-300">{order.engineModel}</td>
              <td className="py-4 text-sm">
                <div className="text-gray-850 dark:text-white">Ingreso: {order.entryDate}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Entrega Est.: {order.tentativeDeliveryDate} ({order.deliveryDays}d)</div>
              </td>
              <td className="py-4 text-sm">
                <div className="font-semibold text-gray-850 dark:text-white">${order.totalUSD.toFixed(2)} USD</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bs. {order.totalVES.toFixed(2)}</div>
              </td>
              <td className="py-4 text-sm">
                <div className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  order.paymentStatus === "Paga"
                    ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                    : order.paymentStatus === "Abonada"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                      : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400"
                }`}>
                  {order.paymentStatus}
                </div>
                <div className="mt-1 text-xxs text-gray-500 dark:text-gray-400">Abonado: ${getOrderPaidUSD(order).toFixed(2)} | Saldo: ${getOrderBalanceUSD(order).toFixed(2)}</div>
              </td>
              <td className="py-4 text-sm">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  (order.orderStatus || "Ingresado") === "Retirado"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300"
                    : (order.orderStatus || "Ingresado") === "Cancelada"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
                      : (order.orderStatus || "Ingresado") === "Parcialmente retirado"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}>
                  {order.orderStatus || "Ingresado"}
                </span>
              </td>
              <td className="py-4 text-sm">
                {order.responsible ? (
                  <span className="text-gray-800 dark:text-white font-medium">{order.responsible}</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">Sin asignar</span>
                )}
              </td>
              <td className="py-4 text-right">
                <div className="flex justify-end gap-1.5">
                  <ActionIconButton
                    tooltip="Ver detalle"
                    onClick={() => onOpenOrderDetail(order)}
                    className="bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </ActionIconButton>

                  <ActionIconButton
                    tooltip="Ver comprobante"
                    onClick={() => onOpenPrint(order)}
                    className="bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-950/30 dark:text-brand-400"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9V4h12v5" />
                      <rect x="6" y="14" width="12" height="6" rx="1" />
                      <path d="M6 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2" />
                    </svg>
                  </ActionIconButton>

                  <ActionIconButton
                    tooltip={(order.orderStatus || "Ingresado") === "Cancelada" ? "Orden cancelada" : "Cancelar orden"}
                    onClick={() => {
                      if ((order.orderStatus || "Ingresado") === "Cancelada") return;
                      onOpenCancel(order);
                    }}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 8l8 8" />
                      <path d="M16 8l-8 8" />
                    </svg>
                  </ActionIconButton>
                </div>
              </td>
            </tr>
          ))}

          {orders.length === 0 && (
            <tr>
              <td colSpan={10} className="py-8 text-center text-sm text-gray-500">
                No se encontraron pedidos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
