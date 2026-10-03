import { useState, useEffect, useMemo, useCallback } from "react";
import PageMeta from "../../components/common/PageMeta";
import {
  DeliveriesCard,
  InventoryAlertCard,
  AllDeliveriesModal,
  OrderQuickPreviewModal,
  ReceivablesCard,
  AllReceivablesModal,
  ReceivablesQuickPaymentModal,
} from "../../components/dashboard";
import type { OrderItem } from "../../components/pedidos/models/types";
import { getReceivablesStats } from "../../utils/receivablesSchedule";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  priceUSD: number;
  quantity: number;
  minStock: number;
  description: string;
}

export default function Home() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [kpiFilter, setKpiFilter] = useState<"Today" | "Week" | "Month" | "All">("Month");
  const [bcvRate, setBcvRate] = useState<number>(0);

  // Modals state
  const [isAllDeliveriesOpen, setIsAllDeliveriesOpen] = useState(false);
  const [isAllReceivablesOpen, setIsAllReceivablesOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<OrderItem | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OrderItem | null>(null);

  const loadData = useCallback(() => {
    window.database
      .getOrders()
      .then((list) => {
        if (Array.isArray(list)) setOrders(list as unknown as OrderItem[]);
      })
      .catch(console.error);

    window.database
      .getInventory()
      .then((list) => {
        if (Array.isArray(list)) setInventory(list as unknown as InventoryItem[]);
      })
      .catch(console.error);

    window.database
      .getBcvUsdRateStatus()
      .then((status) => {
        if (status?.latestRate?.valueUsd) {
          setBcvRate(Number(status.latestRate.valueUsd));
        }
      })
      .catch(console.error);
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Today reference
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Receivables stats
  const receivablesStats = useMemo(() => {
    return getReceivablesStats(orders, todayIso);
  }, [orders, todayIso]);

  // Filter orders based on the selected KPI range
  const filteredOrdersForKPI = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Compute dates
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().split("T")[0];

    const startOfMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`;

    return orders.filter((o) => {
      if (kpiFilter === "Today") {
        return o.entryDate === todayStr;
      }
      if (kpiFilter === "Week") {
        return o.entryDate >= startOfWeekStr;
      }
      if (kpiFilter === "Month") {
        return o.entryDate >= startOfMonthStr;
      }
      return true;
    });
  }, [orders, kpiFilter]);

  // Compute metrics
  const totalOrdersCount = filteredOrdersForKPI.length;
  const totalRevenueUSD = filteredOrdersForKPI.reduce((sum, o) => sum + (o.totalUSD || 0), 0);
  const totalRevenueVES = filteredOrdersForKPI.reduce((sum, o) => sum + (o.totalVES || 0), 0);

  // Inventory Stock alerts
  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => item.quantity <= item.minStock);
  }, [inventory]);

  return (
    <>
      <PageMeta
        title="Resumen General | Rectificadora App"
        description="Panel de KPIs, métricas de órdenes de servicio, cuentas por cobrar y alertas operativas."
      />

      <div className="space-y-6">
        {/* Encabezado del Dashboard */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Resumen General</h1>
            <p className="text-sm text-gray-500 mt-1">
              Control de KPIs, fechas de entrega, cuentas por cobrar y alertas operativas de la rectificadora.
            </p>
          </div>

          {/* Selector de Rango de KPI */}
          <div>
            <select
              value={kpiFilter}
              onChange={(e) => setKpiFilter(e.target.value as "Today" | "Week" | "Month" | "All")}
              className="rounded-lg border border-gray-300 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-white outline-none transition focus:border-brand-500 dark:border-gray-700 cursor-pointer"
            >
              <option value="Today">Hoy</option>
              <option value="Week">Esta Semana</option>
              <option value="Month">Este Mes</option>
              <option value="All">Histórico Completo</option>
            </select>
          </div>
        </div>

        {/* Tarjetas KPI principales */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {/* Card 1: Pedidos */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Pedidos Registrados</span>
              <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                Filtro Activo
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{totalOrdersCount}</span>
              <span className="text-sm text-gray-500">órdenes</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">Pedidos ingresados en el rango de tiempo seleccionado.</p>
          </div>

          {/* Card 2: Facturación */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Facturación Estimada</span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Acumulado</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                ${totalRevenueUSD.toFixed(2)} USD
              </div>
              <div className="text-xs text-brand-600 dark:text-brand-400 mt-1 font-semibold">
                Bs. {totalRevenueVES.toFixed(2)} VES
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Suma total de montos registrados en dólares y bolívares respectivamente.
            </p>
          </div>

          {/* Card 3: Cuentas Pendientes por Cobrar (Rediseñada con UI/UX Pro Max) */}
          <div
            onClick={() => setIsAllReceivablesOpen(true)}
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:border-brand-300 hover:shadow-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-700/60 cursor-pointer"
            title="Haga clic para ver el detalle de cuentas por cobrar"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                Capital por Cobrar
              </span>
              {receivablesStats.criticalCount > 0 ? (
                <span className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                  {receivablesStats.criticalCount} críticas
                </span>
              ) : (
                <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  Cartera al día
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="font-mono text-2xl font-bold text-gray-800 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                ${receivablesStats.totalBalanceUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
              {bcvRate > 0 && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                  Bs. {(receivablesStats.totalBalanceUSD * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-gray-400">
              {receivablesStats.totalOrdersWithBalance} órdenes pendientes ({receivablesStats.recoveryPercentage}% recaudado). Clic para auditar.
            </p>
          </div>
        </div>

        {/* Sección Operativa 1: Entregas Programadas y Alertas de Stock */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Tarjeta Principal de Entregas Programadas (2 columnas en XL) */}
          <div className="xl:col-span-2">
            <DeliveriesCard
              orders={orders}
              onOpenOrderPreview={(order) => setPreviewOrder(order)}
              onOpenAllDeliveries={() => setIsAllDeliveriesOpen(true)}
            />
          </div>

          {/* Tarjeta de Alerta de Stock de Inventario (1 columna en XL) */}
          <div className="xl:col-span-1">
            <InventoryAlertCard lowStockItems={lowStockItems} />
          </div>
        </div>

        {/* Sección Operativa 2: Gestión de Cuentas por Cobrar & Mora */}
        <div className="grid grid-cols-1 gap-6">
          <ReceivablesCard
            orders={orders}
            bcvRate={bcvRate}
            onOpenOrderPreview={(order) => setPreviewOrder(order)}
            onOpenPayment={(order) => setPaymentOrder(order)}
            onOpenAllReceivables={() => setIsAllReceivablesOpen(true)}
          />
        </div>

        {/* Modal con Cronograma Completo de Entregas */}
        <AllDeliveriesModal
          isOpen={isAllDeliveriesOpen}
          onClose={() => setIsAllDeliveriesOpen(false)}
          orders={orders}
          onSelectOrder={(order) => setPreviewOrder(order)}
        />

        {/* Modal con Consolidado Completo de Cartera y Cobranzas */}
        <AllReceivablesModal
          isOpen={isAllReceivablesOpen}
          onClose={() => setIsAllReceivablesOpen(false)}
          orders={orders}
          bcvRate={bcvRate}
          onSelectOrder={(order) => setPreviewOrder(order)}
          onOpenPayment={(order) => setPaymentOrder(order)}
        />

        {/* Modal de Cobro / Abono Rápido */}
        <ReceivablesQuickPaymentModal
          order={paymentOrder}
          isOpen={Boolean(paymentOrder)}
          onClose={() => setPaymentOrder(null)}
          onPaymentSuccess={loadData}
          bcvRate={bcvRate}
        />

        {/* Modal de Vista Rápida de Orden */}
        <OrderQuickPreviewModal
          order={previewOrder}
          onClose={() => setPreviewOrder(null)}
        />
      </div>
    </>
  );
}
