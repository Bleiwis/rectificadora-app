import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";

interface PartRow {
  partName: string;
  customName?: string;
  quantity: number;
  measurement: string;
}

interface OrderItem {
  id: string;
  code: string;
  clientId?: string | null;
  clientName: string;
  clientLastName: string;
  clientCI: string;
  clientPhone: string;
  clientAddress: string;
  engineModel: string;
  parts: PartRow[];
  services: { name: string; priceUSD: number }[];
  inventoryItems?: { id: string; name: string; priceUSD: number; quantity: number }[];
  totalUSD: number;
  totalVES: number;
  paidUSD?: number;
  balanceUSD?: number;
  entryDate: string;
  deliveryDays: number;
  tentativeDeliveryDate: string;
  paymentStatus: "Paga" | "Abonada" | "Pendiente por cobrar";
  orderStatus?: "Ingresado" | "Parcialmente retirado" | "Retirado" | "Cancelada";
  priority: "Baja" | "Media" | "Alta";
  responsible?: string;
  createdBy: string;
  createdByUserId?: string;
}

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

  // Load data from SQLite database on mount
  useEffect(() => {
    window.database.getOrders().then((list) => {
      if (list) setOrders(list as unknown as OrderItem[]);
    }).catch(console.error);

    window.database.getInventory().then((list) => {
      if (list) setInventory(list as unknown as InventoryItem[]);
    }).catch(console.error);
  }, []);

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
  const totalRevenueUSD = filteredOrdersForKPI.reduce((sum, o) => sum + o.totalUSD, 0);
  const totalRevenueVES = filteredOrdersForKPI.reduce((sum, o) => sum + (o.totalVES || 0), 0);

  // Active (Pending payment or pending work) orders count
  const activeOrdersCount = orders.filter(
    (o) =>
      o.paymentStatus !== "Paga" &&
      (o.orderStatus || "Ingresado") !== "Retirado" &&
      (o.orderStatus || "Ingresado") !== "Cancelada",
  ).length;

  // Inventory Stock alerts
  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => item.quantity <= item.minStock);
  }, [inventory]);

  // Near due date orders (due in <= 3 days, only pending ones)
  const nearDueOrders = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limitDate = new Date();
    limitDate.setDate(now.getDate() + 3);
    limitDate.setHours(23, 59, 59, 999);

    return orders
      .filter((o) => {
        if ((o.orderStatus || "Ingresado") === "Retirado") return false;
        if ((o.orderStatus || "Ingresado") === "Cancelada") return false;
        if (o.paymentStatus === "Paga") return false; // ignore fully completed/paid ones for critical pending alert
        const dueDate = new Date(o.tentativeDeliveryDate);
        return dueDate >= now && dueDate <= limitDate;
      })
      .sort((a, b) => a.tentativeDeliveryDate.localeCompare(b.tentativeDeliveryDate));
  }, [orders]);

  return (
    <>
      <PageMeta
        title="Resumen General | Rectificadora App"
        description="Panel de KPIs, métricas de órdenes de servicio y alertas de entrega o stock."
      />

      <div className="space-y-6">
        
        {/* Encabezado del Dashboard */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Resumen General</h1>
            <p className="text-sm text-gray-500 mt-1">Control de KPIs y alertas operativas de la rectificadora.</p>
          </div>

          {/* Selector de Rango de KPI */}
          <div>
            <select
              value={kpiFilter}
              onChange={(e) => setKpiFilter(e.target.value as "Today" | "Week" | "Month" | "All")}
              className="rounded-lg border border-gray-300 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-white outline-none transition focus:border-brand-500 dark:border-gray-700"
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
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
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
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Facturación Estimada</span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Acumulado</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-gray-800 dark:text-white">${totalRevenueUSD.toFixed(2)} USD</div>
              <div className="text-xs text-brand-600 dark:text-brand-400 mt-1 font-semibold">
                Bs. {totalRevenueVES.toFixed(2)} VES
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">Suma total de montos registrados en dólares y bolívares respectivamente.</p>
          </div>

          {/* Card 3: Trabajos Activos */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Trabajos Pendientes de Pago</span>
              <span className="rounded-lg bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-400">
                Total
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{activeOrdersCount}</span>
              <span className="text-sm text-gray-500">pendientes</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">Órdenes de servicio activas con estatus "Pendiente por cobrar".</p>
          </div>

        </div>

        {/* Tarjetas de Alertas Operativas */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          
          {/* Alerta de Inventario (Bajo Stock) */}
          <Link
            to="/inventario"
            className="group rounded-2xl border border-red-100 bg-red-50/20 p-6 dark:border-red-950/20 dark:bg-red-950/5 hover:border-red-300 dark:hover:border-red-800 transition block text-left"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                  ⚠️ Alerta de Stock de Inventario
                </h3>
                <p className="text-sm text-red-600/80 dark:text-red-300/70 mt-1">
                  Artículos que están en nivel crítico o próximos a quedarse sin existencias.
                </p>
              </div>
              <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300 group-hover:scale-105 transition">
                {lowStockItems.length} críticas
              </span>
            </div>

            {/* Listado Rápido */}
            <div className="mt-5 space-y-2.5">
              {lowStockItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-white/70 dark:bg-gray-900/60 p-2.5 rounded-lg text-xs">
                  <span className="font-semibold text-gray-800 dark:text-white">{item.name}</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    item.quantity === 0 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    Cant: {item.quantity} (Mín: {item.minStock})
                  </span>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400">
                  ✅ Todo en orden. No hay artículos con stock bajo.
                </div>
              )}
              {lowStockItems.length > 3 && (
                <div className="text-right text-xxs font-semibold text-red-600 dark:text-red-400">
                  + ver {lowStockItems.length - 3} más en el Inventario →
                </div>
              )}
            </div>
          </Link>

          {/* Alertas de pedidos próximos a vencer */}
          <Link
            to="/pedidos"
            className="group rounded-2xl border border-orange-100 bg-orange-50/20 p-6 dark:border-orange-950/20 dark:bg-orange-950/5 hover:border-orange-300 dark:hover:border-orange-800 transition block text-left"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                  ⏰ Entregas Próximas (Urgentes)
                </h3>
                <p className="text-sm text-orange-600/80 dark:text-orange-300/70 mt-1">
                  Pedidos pendientes cuya fecha estimada de entrega vence en los próximos 3 días.
                </p>
              </div>
              <span className="rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-xs font-bold text-orange-700 dark:text-orange-300 group-hover:scale-105 transition">
                {nearDueOrders.length} próximas
              </span>
            </div>

            {/* Listado Rápido */}
            <div className="mt-5 space-y-2.5">
              {nearDueOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex justify-between items-center bg-white/70 dark:bg-gray-900/60 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="font-semibold text-gray-800 dark:text-white">Nº {order.code}</span>
                    <span className="text-gray-500 mx-1">|</span>
                    <span className="text-gray-600 dark:text-gray-400">{order.clientName} ({order.engineModel})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded font-semibold bg-orange-100 text-orange-700">
                    Vence: {order.tentativeDeliveryDate}
                  </span>
                </div>
              ))}
              {nearDueOrders.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400">
                  ✅ No hay entregas pendientes urgentes en los próximos 3 días.
                </div>
              )}
              {nearDueOrders.length > 3 && (
                <div className="text-right text-xxs font-semibold text-orange-600 dark:text-orange-400">
                  + ver {nearDueOrders.length - 3} más en Pedidos →
                </div>
              )}
            </div>
          </Link>

        </div>

      </div>
    </>
  );
}
