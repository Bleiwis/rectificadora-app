import { useState, useEffect, useMemo } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/button/Button";
import Input from "../components/form/input/InputField";
import Select from "../components/form/Select";
import Label from "../components/form/Label";
import TextArea from "../components/form/input/TextArea";
import {
  OrderDetailModal,
  OrderItem,
  PedidosFilters,
  PedidosPagination,
  PedidosTable,
  OrderPartDeliveryRow,
  OrderPaymentRow,
  PartRow,
} from "../components/pedidos";

const defaultEmployees: string[] = [];

export default function Pedidos() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPayment, setFilterPayment] = useState("All");
  const [filterOrderStatus, setFilterOrderStatus] = useState("All");
  const [sortBy, setSortBy] = useState("DateDesc"); // DateDesc, DateAsc
  const [selectedOrderForPrint, setSelectedOrderForPrint] =
    useState<OrderItem | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] =
    useState<OrderItem | null>(null);
  const [detailPaymentHistory, setDetailPaymentHistory] = useState<OrderPaymentRow[]>([]);
  const [detailWithdrawalHistory, setDetailWithdrawalHistory] = useState<OrderPartDeliveryRow[]>([]);

  // Assignment Modal State
  const [editingResponsibleOrder, setEditingResponsibleOrder] =
    useState<OrderItem | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [customEmployeeName, setCustomEmployeeName] = useState("");
  const [paymentOrder, setPaymentOrder] = useState<OrderItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRate, setPaymentRate] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentHistory, setPaymentHistory] = useState<OrderPaymentRow[]>([]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [withdrawalOrder, setWithdrawalOrder] = useState<OrderItem | null>(null);
  const [withdrawalDraft, setWithdrawalDraft] = useState<Record<number, string>>({});
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalHistory, setWithdrawalHistory] = useState<OrderPartDeliveryRow[]>([]);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [isSavingWithdrawal, setIsSavingWithdrawal] = useState(false);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<OrderItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelingOrder, setIsCancelingOrder] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadOrders = () => {
    window.database
      .getOrders()
      .then((list) => {
        if (list) {
          setOrders(list as unknown as OrderItem[]);
        }
      })
      .catch(console.error);
  };

  const refreshOrderDetailHistory = async (orderId: string) => {
    try {
      const [payments, withdrawals] = await Promise.all([
        window.database.getOrderPayments(orderId),
        window.database.getOrderPartDeliveries(orderId),
      ]);
      setDetailPaymentHistory(payments || []);
      setDetailWithdrawalHistory(withdrawals || []);
    } catch {
      setDetailPaymentHistory([]);
      setDetailWithdrawalHistory([]);
    }
  };

  const openOrderDetail = async (order: OrderItem) => {
    setSelectedOrderForDetail(order);
    await refreshOrderDetailHistory(order.id);
  };

  const closeOrderDetail = () => {
    setSelectedOrderForDetail(null);
    setDetailPaymentHistory([]);
    setDetailWithdrawalHistory([]);
  };

  const openCancelOrderModal = (order: OrderItem) => {
    setCancelOrderTarget(order);
    setCancelReason("");
    setCancelError(null);
    setIsCancelingOrder(false);
  };

  const closeCancelOrderModal = () => {
    setCancelOrderTarget(null);
    setCancelReason("");
    setCancelError(null);
    setIsCancelingOrder(false);
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrderTarget) return;

    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError("Debes indicar el motivo de cancelación.");
      return;
    }

    setIsCancelingOrder(true);
    setCancelError(null);
    try {
      await window.database.cancelOrder({
        id: cancelOrderTarget.id,
        reason,
        canceledBy: user?.displayName || user?.username || "",
        canceledByUserId: user?.id || null,
      });
      loadOrders();
      if (selectedOrderForDetail?.id === cancelOrderTarget.id) {
        closeOrderDetail();
      }
      closeCancelOrderModal();
    } catch (error) {
      setCancelError(
        error instanceof Error
          ? error.message
          : "No fue posible cancelar la orden.",
      );
    } finally {
      setIsCancelingOrder(false);
    }
  };

  const getOrderBalanceUSD = (order: OrderItem) => {
    const explicit = Number(order.balanceUSD);
    if (Number.isFinite(explicit) && explicit >= 0) {
      return explicit;
    }
    return Math.max(0, Number(order.totalUSD || 0) - Number(order.paidUSD || 0));
  };

  const getOrderPaidUSD = (order: OrderItem) => {
    const explicit = Number(order.paidUSD);
    if (Number.isFinite(explicit) && explicit >= 0) {
      return explicit;
    }
    return order.paymentStatus === "Paga" ? Number(order.totalUSD || 0) : 0;
  };

  const openPaymentModal = async (order: OrderItem) => {
    setPaymentOrder(order);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentError(null);

    try {
      const status = await window.database.getBcvUsdRateStatus();
      setPaymentRate(
        status.latestRate?.valueUsd
          ? String(status.latestRate.valueUsd)
          : "",
      );
    } catch {
      setPaymentRate("");
    }

    try {
      const history = await window.database.getOrderPayments(order.id);
      setPaymentHistory(history || []);
    } catch {
      setPaymentHistory([]);
    }
  };

  const closePaymentModal = () => {
    setPaymentOrder(null);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentHistory([]);
    setPaymentError(null);
    setIsSavingPayment(false);
  };

  const getPartDisplayName = (part?: PartRow) => {
    if (!part) return "Parte";
    if (part.partName === "Otro (Escribir abajo)") {
      return part.customName || "Otro";
    }
    return part.partName;
  };

  const getPartAdmittedQty = (part: PartRow) => {
    return Math.max(0, Math.floor(Number(part.quantity) || 0));
  };

  const buildDeliveredByPartMap = (deliveries: OrderPartDeliveryRow[]) => {
    const deliveredByPart = new Map<number, number>();
    deliveries.forEach((delivery) => {
      const current = deliveredByPart.get(delivery.partIndex) || 0;
      deliveredByPart.set(delivery.partIndex, current + Math.max(0, Math.floor(Number(delivery.quantity) || 0)));
    });
    return deliveredByPart;
  };

  const openWithdrawalModal = async (order: OrderItem) => {
    setWithdrawalOrder(order);
    setWithdrawalDraft({});
    setWithdrawalNote("");
    setWithdrawalError(null);
    setIsSavingWithdrawal(false);

    try {
      const history = await window.database.getOrderPartDeliveries(order.id);
      setWithdrawalHistory(history || []);
    } catch {
      setWithdrawalHistory([]);
    }
  };

  const closeWithdrawalModal = () => {
    setWithdrawalOrder(null);
    setWithdrawalDraft({});
    setWithdrawalNote("");
    setWithdrawalHistory([]);
    setWithdrawalError(null);
    setIsSavingWithdrawal(false);
  };

  const handleWithdrawalQtyChange = (partIndex: number, value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    setWithdrawalDraft((prev) => ({
      ...prev,
      [partIndex]: sanitized,
    }));
  };

  const handleRegisterWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalOrder) return;

    const deliveredByPart = buildDeliveredByPartMap(withdrawalHistory);
    const deliveries = withdrawalOrder.parts
      .map((part, partIndex) => {
        const admittedQty = getPartAdmittedQty(part);
        const deliveredQty = deliveredByPart.get(partIndex) || 0;
        const pendingQty = Math.max(0, admittedQty - deliveredQty);
        const qtyRequested = Math.max(0, Math.floor(Number(withdrawalDraft[partIndex] || 0)));
        return {
          partIndex,
          partName: getPartDisplayName(part),
          pendingQty,
          qtyRequested,
        };
      })
      .filter((entry) => entry.qtyRequested > 0);

    if (deliveries.length === 0) {
      setWithdrawalError("Indica al menos una parte con cantidad a retirar.");
      return;
    }

    const exceeded = deliveries.find((entry) => entry.qtyRequested > entry.pendingQty);
    if (exceeded) {
      setWithdrawalError(
        `La cantidad para '${exceeded.partName}' excede el pendiente (${exceeded.pendingQty}).`,
      );
      return;
    }

    setIsSavingWithdrawal(true);
    setWithdrawalError(null);
    try {
      await window.database.addOrderPartDeliveries({
        orderId: withdrawalOrder.id,
        note: withdrawalNote,
        deliveries: deliveries.map((entry) => ({
          partIndex: entry.partIndex,
          quantity: entry.qtyRequested,
        })),
      });
      loadOrders();
      if (selectedOrderForDetail?.id === withdrawalOrder.id) {
        refreshOrderDetailHistory(withdrawalOrder.id);
      }
      closeWithdrawalModal();
    } catch (error) {
      setWithdrawalError(
        error instanceof Error
          ? error.message
          : "No fue posible registrar el retiro parcial.",
      );
    } finally {
      setIsSavingWithdrawal(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentOrder) return;

    const amount = Number(paymentAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Ingresa un monto de pago válido.");
      return;
    }

    const balanceUSD = getOrderBalanceUSD(paymentOrder);
    const paymentUsdEquivalent = amount;

    if (paymentUsdEquivalent - balanceUSD > 0.0001) {
      setPaymentError(
        `El pago excede el saldo pendiente (${balanceUSD.toFixed(2)} USD).`,
      );
      return;
    }

    setIsSavingPayment(true);
    setPaymentError(null);
    try {
      await window.database.addOrderPayment({
        orderId: paymentOrder.id,
        payment: {
          currency: "USD",
          amount,
          note: paymentNote,
        },
      });
      loadOrders();
      if (selectedOrderForDetail?.id === paymentOrder.id) {
        refreshOrderDetailHistory(paymentOrder.id);
      }
      closePaymentModal();
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "No fue posible registrar el pago.",
      );
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Load orders from SQLite database
  useEffect(() => {
    loadOrders();
  }, []);

  const handleAssignResponsible = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResponsibleOrder) return;
    if ((editingResponsibleOrder.orderStatus || "Ingresado") === "Cancelada") {
      return;
    }
    if (selectedEmployee === "custom" && !customEmployeeName.trim()) {
      return;
    }

    const finalName =
      selectedEmployee === "custom" ? customEmployeeName : selectedEmployee;

    const updatedOrder: OrderItem = {
      ...editingResponsibleOrder,
      responsible: finalName,
    };

    window.database
      .saveOrder(updatedOrder)
      .then(() => {
        loadOrders();
        if (selectedOrderForDetail?.id === editingResponsibleOrder.id) {
          setSelectedOrderForDetail(updatedOrder);
        }
        setEditingResponsibleOrder(null);
        setSelectedEmployee("");
        setCustomEmployeeName("");
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (!selectedOrderForDetail) return;
    const refreshed = orders.find((o) => o.id === selectedOrderForDetail.id);
    if (refreshed) {
      setSelectedOrderForDetail(refreshed);
    }
  }, [orders, selectedOrderForDetail]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPayment, filterOrderStatus, sortBy, itemsPerPage]);

  // Processed Orders
  const processedOrders = useMemo(() => {
    let result = [...orders];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.code.includes(term) ||
          o.clientName.toLowerCase().includes(term) ||
          o.clientLastName.toLowerCase().includes(term) ||
          o.clientCI.toLowerCase().includes(term) ||
          o.engineModel.toLowerCase().includes(term),
      );
    }

    // Payment filter
    if (filterPayment !== "All") {
      result = result.filter((o) => o.paymentStatus === filterPayment);
    }

    // Internal order status filter
    if (filterOrderStatus !== "All") {
      result = result.filter(
        (o) => (o.orderStatus || "Ingresado") === filterOrderStatus,
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "DateDesc") {
        return b.id.localeCompare(a.id);
      }
      if (sortBy === "DateAsc") {
        return a.id.localeCompare(b.id);
      }
      return 0;
    });

    return result;
  }, [orders, searchTerm, filterPayment, filterOrderStatus, sortBy]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [processedOrders, currentPage, itemsPerPage]);

  const totalPages = Math.max(
    1,
    Math.ceil(processedOrders.length / itemsPerPage),
  );

  return (
    <div className="relative">
      <PageMeta
        title="Historial de Pedidos | Rectificadora App"
        description="Listado y control de órdenes de trabajo, facturación y entrega."
      />
      <PageBreadcrumb pageTitle="Pedidos y Órdenes" />

      {/* Tarjeta de Contenedor */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
        <PedidosFilters
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          filterPayment={filterPayment}
          onFilterPaymentChange={setFilterPayment}
          filterOrderStatus={filterOrderStatus}
          onFilterOrderStatusChange={setFilterOrderStatus}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          processedCount={processedOrders.length}
        />

        <PedidosTable
          orders={paginatedOrders}
          onOpenOrderDetail={openOrderDetail}
          onOpenPrint={(order) => setSelectedOrderForPrint(order)}
          onOpenCancel={openCancelOrderModal}
          getOrderPaidUSD={getOrderPaidUSD}
          getOrderBalanceUSD={getOrderBalanceUSD}
        />

        <PedidosPagination
          processedCount={processedOrders.length}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      <OrderDetailModal
        order={selectedOrderForDetail}
        paymentHistory={detailPaymentHistory}
        withdrawalHistory={detailWithdrawalHistory}
        onClose={closeOrderDetail}
        onAssignResponsible={(order) => {
          if ((order.orderStatus || "Ingresado") === "Cancelada") return;
          setEditingResponsibleOrder(order);
          setSelectedEmployee(
            order.responsible
              ? defaultEmployees.includes(order.responsible)
                ? order.responsible
                : "custom"
              : "",
          );
          setCustomEmployeeName(
            order.responsible && !defaultEmployees.includes(order.responsible)
              ? order.responsible
              : "",
          );
        }}
        onOpenPayment={openPaymentModal}
        onOpenWithdrawal={openWithdrawalModal}
        onOpenCancel={openCancelOrderModal}
        onOpenPrint={(order) => setSelectedOrderForPrint(order)}
        getOrderPaidUSD={getOrderPaidUSD}
        getOrderBalanceUSD={getOrderBalanceUSD}
        getPartDisplayName={getPartDisplayName}
        getPartAdmittedQty={getPartAdmittedQty}
        buildDeliveredByPartMap={buildDeliveredByPartMap}
      />

      {/* Modal / Nota de Entrega Imprimible */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm print:p-0 print:bg-white">
          <div className="relative w-full max-w-[650px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white sm:p-8 print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none print:p-0">
            {/* Cabecera del modal para interactuar (se oculta al imprimir) */}
            <div className="mb-6 flex justify-between items-center print:hidden">
              <h4 className="text-lg font-bold text-gray-850 dark:text-white">
                Nota de Entrega / Comprobante
              </h4>
              <button
                onClick={() => setSelectedOrderForPrint(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            {/* Bloque de Impresión Principal */}
            <div className="space-y-6 text-gray-800 print:text-black">
              {/* Encabezado Factura */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-5 gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-md border border-dashed border-gray-300 text-[10px] text-gray-500 flex items-center justify-center text-center px-1">
                    Espacio
                    para logo
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-600 leading-tight">
                      Rectificadora Bruno Aponte C.A
                    </h2>
                    <p className="text-xs text-gray-600 mt-1 font-semibold">
                      RIF: J-507200914
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Cuidado y precision para su motor
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-500">
                    NOTA DE ENTREGA
                  </div>
                  <div className="text-xl font-bold text-brand-600">
                    Nº {selectedOrderForPrint.code}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Ingreso: {selectedOrderForPrint.entryDate}
                  </div>
                </div>
              </div>

              {/* Información del Cliente y Motor */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-bold text-gray-500 uppercase tracking-wide text-xs">
                    CLIENTE:
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {selectedOrderForPrint.clientName}{" "}
                    {selectedOrderForPrint.clientLastName}
                  </div>
                  <div>Cédula: {selectedOrderForPrint.clientCI}</div>
                  <div>Teléfono: {selectedOrderForPrint.clientPhone}</div>
                  {selectedOrderForPrint.clientAddress && (
                    <div>Dirección: {selectedOrderForPrint.clientAddress}</div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-gray-500 uppercase tracking-wide text-xs">
                    DETALLES MOTOR:
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {selectedOrderForPrint.engineModel}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Recibido por: {selectedOrderForPrint.createdBy}
                  </div>
                </div>
              </div>

              {/* Tabla de Partes Recibidas */}
              <div>
                <div className="font-bold text-gray-500 uppercase tracking-wide text-xs mb-2">
                  PARTES DE MOTOR RECIBIDAS:
                </div>
                <table className="w-full text-left text-xs border border-gray-200 divide-y divide-gray-255">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 font-semibold">
                        Descripción de Parte
                      </th>
                      <th className="px-3 py-2 font-semibold text-center">
                        Cant.
                      </th>
                      <th className="px-3 py-2 font-semibold">Medida Salida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {selectedOrderForPrint.parts.map((part, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 font-medium">
                          {part.partName === "Otro (Escribir abajo)"
                            ? part.customName
                            : part.partName}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2">{part.measurement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detalles de Servicios */}
              {selectedOrderForPrint.services.length > 0 && (
                <div>
                  <div className="font-bold text-gray-500 uppercase tracking-wide text-xs mb-2">
                    SERVICIOS REALIZADOS:
                  </div>
                  <ul className="text-xs space-y-1.5 list-disc pl-4 text-gray-600 dark:text-gray-300">
                    {selectedOrderForPrint.services.map((s, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center max-w-sm"
                      >
                        <span>{s.name}</span>
                        <span className="font-semibold text-gray-800 dark:text-white">
                          ${s.priceUSD.toFixed(2)} USD
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Repuestos e Insumos Adicionales */}
              {selectedOrderForPrint.inventoryItems &&
                selectedOrderForPrint.inventoryItems.length > 0 && (
                  <div>
                    <div className="font-bold text-gray-500 uppercase tracking-wide text-xs mb-2">
                      REPUESTOS E INSUMOS ADICIONALES:
                    </div>
                    <ul className="text-xs space-y-1.5 list-disc pl-4 text-gray-600 dark:text-gray-300">
                      {selectedOrderForPrint.inventoryItems.map(
                        (
                          item: {
                            id: string;
                            name: string;
                            priceUSD: number;
                            quantity: number;
                          },
                          index: number,
                        ) => (
                          <li
                            key={index}
                            className="flex justify-between items-center max-w-sm"
                          >
                            <span>
                              {item.name} (x{item.quantity})
                            </span>
                            <span className="font-semibold text-gray-800 dark:text-white">
                              ${(item.priceUSD * item.quantity).toFixed(2)} USD
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              {/* Lógica de Pago e Impresión */}
              <div className="border-t border-gray-200 pt-5 flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase">
                    ESTADO DE NOTA:
                  </div>
                  <div
                    className={`text-sm font-bold uppercase mt-1 ${
                      selectedOrderForPrint.paymentStatus === "Paga"
                        ? "text-green-600"
                        : selectedOrderForPrint.paymentStatus === "Abonada"
                          ? "text-blue-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {selectedOrderForPrint.paymentStatus}
                  </div>
                </div>

                {/* Visualización de Precio a Tasa Dolar o BCV */}
                <div className="text-right">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase">
                      TOTAL ORDEN:
                    </div>
                    <div className="text-xl font-bold text-gray-800 dark:text-white">
                      ${selectedOrderForPrint.totalUSD.toFixed(2)} USD
                    </div>
                    <div className="text-xxs text-gray-500 mt-0.5">
                      Abonado: ${getOrderPaidUSD(selectedOrderForPrint).toFixed(2)} USD
                    </div>
                    <div className="text-xxs text-yellow-700 mt-0.5 font-semibold">
                      Saldo pendiente: ${getOrderBalanceUSD(selectedOrderForPrint).toFixed(2)} USD
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-8 flex justify-end gap-3 print:hidden">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOrderForPrint(null)}>
                Cerrar
              </Button>
              <Button type="button" size="sm" onClick={() => window.print()}>
                Imprimir Nota
              </Button>
            </div>
          </div>
        </div>
      )}

      {paymentOrder && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-[520px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white">
            <div className="mb-4 flex justify-between items-center">
              <h4 className="text-lg font-bold text-gray-850 dark:text-white">
                Registrar Pago - Pedido #{paymentOrder.code}
              </h4>
              <button
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
              <div className="text-gray-700 dark:text-gray-300">
                Total: <span className="font-semibold">${paymentOrder.totalUSD.toFixed(2)} USD</span>
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                Abonado: <span className="font-semibold">${getOrderPaidUSD(paymentOrder).toFixed(2)} USD</span>
              </div>
              <div className="text-yellow-700 dark:text-yellow-400 font-semibold">
                Saldo: ${getOrderBalanceUSD(paymentOrder).toFixed(2)} USD
              </div>
            </div>

            {paymentError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <Label htmlFor="payment-amount">Monto abonado (USD)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0"
                  step={0.01}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-10"
                />
              </div>

              {paymentRate && paymentAmount ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Referencia del día: Bs. {(Number(paymentAmount || 0) * Number(paymentRate || 0)).toFixed(2)} VES
                </p>
              ) : null}

              <div>
                <Label htmlFor="payment-note">Nota (opcional)</Label>
                <Input
                  id="payment-note"
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Referencia de pago"
                  className="h-10"
                />
              </div>

              {paymentHistory.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <h5 className="mb-2 text-xs font-semibold uppercase text-gray-500">Historial de pagos</h5>
                  <ul className="max-h-28 overflow-y-auto space-y-1 text-xs">
                    {paymentHistory.map((p) => (
                      <li key={p.id} className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>{new Date(p.paidAt).toLocaleDateString()} - {p.currency} {p.amount.toFixed(2)}</span>
                        <span>${p.paidUSD.toFixed(2)} USD</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={closePaymentModal}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isSavingPayment}>
                  {isSavingPayment ? "Guardando..." : "Guardar pago"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelOrderTarget && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-[520px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white">
            <div className="mb-4 flex justify-between items-center">
              <h4 className="text-lg font-bold text-gray-850 dark:text-white">
                Cancelar orden #{cancelOrderTarget.code}
              </h4>
              <button
                onClick={closeCancelOrderModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Esta acción bloquea permanentemente la orden: no podrá registrar pagos, retiros ni cambios de responsable.
            </p>

            {cancelError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelOrder} className="space-y-4">
              <div>
                <Label htmlFor="cancel-reason">Motivo de cancelación</Label>
                <TextArea
                  value={cancelReason}
                  onChange={setCancelReason}
                  rows={4}
                  placeholder="Ej. Cliente desistió del servicio"
                  className="text-sm"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={closeCancelOrderModal}>
                  Volver
                </Button>
                <Button type="submit" size="sm" disabled={isCancelingOrder}>
                  {isCancelingOrder ? "Cancelando..." : "Confirmar cancelación"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {withdrawalOrder && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-[680px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white">
            <div className="mb-4 flex justify-between items-center">
              <h4 className="text-lg font-bold text-gray-850 dark:text-white">
                Retiro parcial - Pedido #{withdrawalOrder.code}
              </h4>
              <button
                onClick={closeWithdrawalModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            {withdrawalError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {withdrawalError}
              </div>
            )}

            <form onSubmit={handleRegisterWithdrawal} className="space-y-4">
              <div className="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full table-auto text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">
                        Parte
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">
                        Admitido
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">
                        Retirado
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">
                        Pendiente
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">
                        Retirar ahora
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {withdrawalOrder.parts.map((part, partIndex) => {
                      const deliveredByPart = buildDeliveredByPartMap(withdrawalHistory);
                      const admittedQty = getPartAdmittedQty(part);
                      const deliveredQty = deliveredByPart.get(partIndex) || 0;
                      const pendingQty = Math.max(0, admittedQty - deliveredQty);
                      return (
                        <tr key={`${withdrawalOrder.id}_${partIndex}`}>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                            {getPartDisplayName(part)}
                          </td>
                          <td className="px-3 py-2 text-center">{admittedQty}</td>
                          <td className="px-3 py-2 text-center">{deliveredQty}</td>
                          <td className="px-3 py-2 text-center font-medium text-amber-700 dark:text-amber-300">
                            {pendingQty}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="text"
                              value={withdrawalDraft[partIndex] || ""}
                              onChange={(e) => handleWithdrawalQtyChange(partIndex, e.target.value)}
                              disabled={pendingQty <= 0}
                              placeholder={pendingQty > 0 ? `Max ${pendingQty}` : "Completado"}
                              className="h-9"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <Label htmlFor="withdrawal-note">Nota de retiro (opcional)</Label>
                <Input
                  id="withdrawal-note"
                  type="text"
                  value={withdrawalNote}
                  onChange={(e) => setWithdrawalNote(e.target.value)}
                  placeholder="Ej. Retirado por cliente titular"
                  className="h-10"
                />
              </div>

              {withdrawalHistory.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <h5 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                    Historial de retiros
                  </h5>
                  <ul className="max-h-28 overflow-y-auto space-y-1 text-xs">
                    {withdrawalHistory.map((delivery) => {
                      const part = withdrawalOrder.parts[delivery.partIndex];
                      return (
                        <li key={delivery.id} className="flex justify-between text-gray-600 dark:text-gray-300 gap-2">
                          <span>
                            {new Date(delivery.deliveredAt).toLocaleDateString()} - {getPartDisplayName(part)} (x{delivery.quantity})
                          </span>
                          <span className="text-gray-500">
                            {delivery.note || "Sin nota"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={closeWithdrawalModal}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isSavingWithdrawal}>
                  {isSavingWithdrawal ? "Guardando..." : "Guardar retiro"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Asignar Responsable */}
      {editingResponsibleOrder && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-[450px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white">
            <div className="mb-4 flex justify-between items-center">
              <h4 className="text-lg font-bold text-gray-850 dark:text-white">
                Asignar Responsable
              </h4>
              <button
                onClick={() => setEditingResponsibleOrder(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignResponsible} className="space-y-4">
              <div>
                <Label>Seleccionar Responsable / Empleado</Label>
                <Select
                  options={[
                    { value: "", label: "Sin Asignar" },
                    ...defaultEmployees.map((emp) => ({ value: emp, label: emp })),
                    { value: "custom", label: "Otro (Ingresar nombre personalizado)..." },
                  ]}
                  value={selectedEmployee}
                  onChange={setSelectedEmployee}
                  className="h-10"
                />
              </div>

              {selectedEmployee === "custom" && (
                <div>
                  <Label htmlFor="custom-responsible">Nombre del Responsable</Label>
                  <Input
                    id="custom-responsible"
                    type="text"
                    value={customEmployeeName}
                    onChange={(e) => setCustomEmployeeName(e.target.value)}
                    placeholder="Ej. Roberto Gómez"
                    className="h-10"
                  />
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingResponsibleOrder(null)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm">
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estilos adicionales para ocultar elementos al imprimir */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          div[class*="fixed"] {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          div[class*="fixed"] * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
