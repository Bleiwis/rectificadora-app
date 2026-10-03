import React, { useState, useMemo, useEffect } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  inventoryFormSchema,
  type InventoryFormInputValues,
  type InventoryFormValues,
} from "../validation/forms";
import { Modal } from "../components/ui/modal";
import Button from "../components/ui/button/Button";
import Badge from "../components/ui/badge/Badge";
import {
  BoxIcon,
  CheckCircleIcon,
  PlusIcon,
} from "../icons";
import {
  sanitizeIntegerString,
  isInvalidIntegerKey,
  isInvalidDecimalKey,
  getInventoryStockStatus,
  getStockStatusMetadata,
} from "../utils/inventoryHelpers";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  priceUSD: number;
  quantity: number;
  minStock: number;
  description: string;
}

const initialCategories = ["Aros", "Pistones", "Válvulas", "Juntas", "Cojinetes", "Otros"];

export default function Inventario() {
  const { user } = useAuth();
  const isCaja = user?.role === "caja";
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bcvRate, setBcvRate] = useState<number>(0);

  const loadInventory = () => {
    window.database
      .getInventory()
      .then((list) => {
        if (list && list.length > 0) {
          setInventory(list as unknown as InventoryItem[]);
          const categories = new Set(initialCategories);
          list.forEach((item) => {
            if (item.category) categories.add(item.category);
          });
          setCategoriesList(Array.from(categories));
        } else {
          setInventory([]);
          setCategoriesList(initialCategories);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadInventory();

    window.database
      .getBcvUsdRateStatus()
      .then((status) => {
        if (status?.latestRate?.valueUsd) {
          setBcvRate(Number(status.latestRate.valueUsd));
        }
      })
      .catch(() => {});
  }, []);

  // Dynamic category state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InventoryFormInputValues, unknown, InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      name: "",
      category: "Aros",
      priceUSD: 0,
      quantity: 0,
      minStock: 5,
      description: "",
    },
  });

  const watchedQuantity = watch("quantity");
  const watchedMinStock = watch("minStock");
  const watchedPrice = watch("priceUSD");
  const watchedDescription = watch("description") || "";

  const currentStockStatus = getInventoryStockStatus(
    Number(watchedQuantity) || 0,
    Number(watchedMinStock) || 0,
  );
  const stockStatusMeta = getStockStatusMetadata(
    currentStockStatus,
    Number(watchedMinStock) || 5,
  );

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStockStatus, setFilterStockStatus] = useState("All");
  const [sortBy, setSortBy] = useState("default");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterStockStatus, sortBy, itemsPerPage]);

  const handleAddNewCategory = (e?: React.SyntheticEvent) => {
    if (e?.preventDefault) e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (!categoriesList.includes(trimmed)) {
      setCategoriesList((prev) => [...prev, trimmed]);
    }
    setValue("category", trimmed, { shouldDirty: true, shouldValidate: true });
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const onSubmit = (values: InventoryFormValues) => {
    const itemData: InventoryItem = {
      id: editingId || Date.now().toString(),
      name: values.name,
      category: values.category,
      priceUSD: Number(values.priceUSD),
      quantity: Number(values.quantity),
      minStock: Number(values.minStock),
      description: values.description || "",
    };

    window.database.saveInventory(itemData)
      .then(() => {
        loadInventory();
        closeModal();
      })
      .catch(console.error);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    reset({
      name: item.name,
      category: item.category,
      priceUSD: item.priceUSD,
      quantity: item.quantity,
      minStock: item.minStock,
      description: item.description,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingId(null);
    reset({
      name: "",
      category: categoriesList[0] || "Otros",
      priceUSD: 0,
      quantity: 0,
      minStock: 5,
      description: "",
    });
    setIsAddingCategory(false);
    setNewCategoryName("");
    setIsModalOpen(false);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (editingId === id) {
      closeModal();
    }
    setDeleteConfirmId(id);
  };

  const confirmDeleteAction = (id: string) => {
    window.database.deleteInventory(id)
      .then(() => {
        setDeleteConfirmId(null);
        loadInventory();
      })
      .catch(console.error);
  };

  // Filtered & Sorted Inventory Data
  const processedInventory = useMemo(() => {
    let result = [...inventory];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (filterCategory !== "All") {
      result = result.filter((item) => item.category === filterCategory);
    }

    // Stock Status filter
    if (filterStockStatus !== "All") {
      result = result.filter((item) => {
        if (filterStockStatus === "OutOfStock") return item.quantity === 0;
        if (filterStockStatus === "LowStock")
          return item.quantity > 0 && item.quantity <= item.minStock;
        if (filterStockStatus === "InStock") return item.quantity > item.minStock;
        return true;
      });
    }

    // Sorting
    if (sortBy === "price-desc") {
      result.sort((a, b) => b.priceUSD - a.priceUSD);
    } else if (sortBy === "price-asc") {
      result.sort((a, b) => a.priceUSD - b.priceUSD);
    } else if (sortBy === "qty-desc") {
      result.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === "qty-asc") {
      result.sort((a, b) => a.quantity - b.quantity);
    } else if (sortBy === "low-stock-first") {
      result.sort((a, b) => {
        const aStatus = a.quantity <= a.minStock ? 0 : 1;
        const bStatus = b.quantity <= b.minStock ? 0 : 1;
        if (aStatus !== bStatus) return aStatus - bStatus;
        return (a.quantity / (a.minStock || 1)) - (b.quantity / (b.minStock || 1));
      });
    }

    return result;
  }, [inventory, searchTerm, filterCategory, filterStockStatus, sortBy]);

  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedInventory.slice(startIndex, startIndex + itemsPerPage);
  }, [processedInventory, currentPage, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(processedInventory.length / itemsPerPage));

  return (
    <div>
      <PageMeta
        title="Inventario de Artículos | Rectificadora App"
        description="Gestión y control de existencia de repuestos y partes para la rectificadora."
      />
      <PageBreadcrumb pageTitle="Inventario de Artículos" />

      {/* Alertas y Totales */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Artículos</span>
          <h4 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">
            {inventory.length}
          </h4>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] border-l-4 border-l-yellow-500">
          <span className="text-sm text-gray-500 dark:text-gray-400">Artículos Bajo Stock</span>
          <h4 className="mt-2 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {inventory.filter((i) => i.quantity > 0 && i.quantity <= i.minStock).length}
          </h4>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] border-l-4 border-l-red-500">
          <span className="text-sm text-gray-500 dark:text-gray-400">Sin Existencias</span>
          <h4 className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {inventory.filter((i) => i.quantity === 0).length}
          </h4>
        </div>
      </div>

      {/* Contenedor Principal (Tabla Completa) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
        
        {/* Barra unificada de Búsqueda, Filtros y Acciones */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <input
                type="text"
                placeholder="Buscar artículo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
            >
              <option value="All">Todas las Categorías</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={filterStockStatus}
              onChange={(e) => setFilterStockStatus(e.target.value)}
              className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
            >
              <option value="All">Todos los Estados</option>
              <option value="InStock">Suficiente Existencia</option>
              <option value="LowStock">Próximo a Agotarse</option>
              <option value="OutOfStock">Sin Existencia (Agotado)</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
            >
              <option value="default">Orden por Defecto</option>
              <option value="low-stock-first">Próximos a agotarse</option>
              <option value="qty-desc">Cantidad: Mayor a Menor</option>
              <option value="qty-asc">Cantidad: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
            </select>
          </div>

          {!isCaja && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition shrink-0"
            >
              + Agregar Artículo
            </button>
          )}
        </div>

        {/* Tabla de Inventario */}
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="pb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Artículo / Repuesto
                </th>
                <th className="pb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Categoría
                </th>
                <th className="pb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Existencia
                </th>
                <th className="pb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Precio (USD)
                </th>
                {!isCaja && (
                  <th className="pb-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedInventory.map((item) => {
                const isOutOfStock = item.quantity === 0;
                const isLowStock = !isOutOfStock && item.quantity <= item.minStock;

                return (
                  <tr key={item.id} className="group">
                    <td className="py-4 pr-3">
                      <div className="font-medium text-gray-800 dark:text-white">
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[400px] truncate">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.category}
                    </td>
                    <td className="py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 dark:text-white">
                          {item.quantity} un.
                        </span>
                        {isOutOfStock ? (
                          <span className="inline-flex rounded-full bg-red-50 dark:bg-red-950/20 px-2 py-0.5 text-xxs font-medium text-red-600 dark:text-red-400 font-semibold">
                            Agotado
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex rounded-full bg-yellow-50 dark:bg-yellow-950/20 px-2 py-0.5 text-xxs font-medium text-yellow-600 dark:text-yellow-400 font-semibold">
                            Bajo Stock (Mín: {item.minStock})
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-50 dark:bg-green-950/20 px-2 py-0.5 text-xxs font-medium text-green-600 dark:text-green-400 font-semibold">
                            En Stock
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-sm font-semibold text-gray-800 dark:text-white">
                      ${item.priceUSD.toFixed(2)}
                    </td>
                    {!isCaja && (
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleEdit(item)}
                          className="mr-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                        >
                          Dar de Baja
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {processedInventory.length === 0 && (
                <tr>
                  <td colSpan={isCaja ? 4 : 5} className="py-8 text-center text-sm text-gray-500">
                    No se encontraron artículos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {processedInventory.length > 0 && (
          <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row">
            {/* Items por Página */}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Mostrar</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
                className="rounded-lg border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>por página</span>
            </div>

            {/* Texto de Rango */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {Math.min(processedInventory.length, (currentPage - 1) * itemsPerPage + 1)} a{" "}
              {Math.min(processedInventory.length, currentPage * itemsPerPage)} de{" "}
              {processedInventory.length} artículos
            </div>

            {/* Botones de Navegación */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    currentPage === page
                      ? "bg-brand-500 text-white"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Crear / Editar Artículo */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        className="max-w-[620px] p-6 sm:p-8"
        showCloseButton
      >
        <div className="flex flex-col space-y-5">
          {/* Header del Modal */}
          <div className="flex items-center gap-3.5 border-b border-gray-100 pb-4 dark:border-gray-800">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <BoxIcon className="size-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId ? "Editar Artículo de Inventario" : "Agregar Nuevo Artículo"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {editingId
                  ? "Actualiza existencias, precio y especificaciones del repuesto."
                  : "Registra repuestos, consumibles o partes mecánicas con alerta de stock mínimo."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4.5">
            {/* Nombre del Artículo */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Nombre del Artículo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register("name")}
                placeholder="Ej. Juego de Aros Std Hilux 2.7 2TR-FE"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>
              )}
            </div>

            {/* Categoría */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  Categoría <span className="text-red-500">*</span>
                </label>
                {!isAddingCategory && (
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer transition"
                  >
                    <PlusIcon className="size-3" />
                    <span>Nueva Categoría</span>
                  </button>
                )}
              </div>

              {!isAddingCategory ? (
                <div className="relative">
                  <select
                    {...register("category")}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500 cursor-pointer"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3.5 dark:border-brand-900/40 dark:bg-brand-950/20">
                  <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                    Escribe el nombre de la nueva categoría:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddNewCategory(e as unknown as React.MouseEvent);
                        }
                      }}
                      placeholder="Ej. Bielas, Pistones Especiales, Empacaduras"
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-350 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddNewCategory}
                      disabled={!newCategoryName.trim()}
                    >
                      Agregar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategoryName("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Grid 2 Columnas: Cantidad Inicial y Mínimo Alerta */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Cantidad Inicial */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  Cantidad en Stock <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(watch("quantity")) || 0;
                      setValue("quantity", Math.max(0, current - 1), {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 font-bold text-sm select-none transition cursor-pointer"
                    title="Disminuir 1"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    {...register("quantity", {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const sanitized = sanitizeIntegerString(e.target.value);
                        setValue("quantity", sanitized ? Number(sanitized) : 0, {
                          shouldValidate: true,
                        });
                      },
                    })}
                    onKeyDown={(e) => {
                      if (isInvalidIntegerKey(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    min="0"
                    step={1}
                    placeholder="0"
                    className="h-10 w-full text-center font-mono rounded-xl border border-gray-300 bg-white px-10 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(watch("quantity")) || 0;
                      setValue("quantity", current + 1, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 font-bold text-sm select-none transition cursor-pointer"
                    title="Aumentar 1"
                  >
                    +
                  </button>
                </div>
                {errors.quantity && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errors.quantity.message}
                  </p>
                )}
              </div>

              {/* Mínimo Alerta */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  Mínimo de Alerta <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(watch("minStock")) || 0;
                      setValue("minStock", Math.max(0, current - 1), {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 font-bold text-sm select-none transition cursor-pointer"
                    title="Disminuir 1"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    {...register("minStock", {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const sanitized = sanitizeIntegerString(e.target.value);
                        setValue("minStock", sanitized ? Number(sanitized) : 0, {
                          shouldValidate: true,
                        });
                      },
                    })}
                    onKeyDown={(e) => {
                      if (isInvalidIntegerKey(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    min="0"
                    step={1}
                    placeholder="5"
                    className="h-10 w-full text-center font-mono rounded-xl border border-gray-300 bg-white px-10 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(watch("minStock")) || 0;
                      setValue("minStock", current + 1, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 font-bold text-sm select-none transition cursor-pointer"
                    title="Aumentar 1"
                  >
                    +
                  </button>
                </div>
                {errors.minStock && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errors.minStock.message}
                  </p>
                )}
              </div>
            </div>

            {/* Live Stock Feedback Indicator */}
            <div className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition ${stockStatusMeta.bgColor} border-current/10`}>
              <Badge color={stockStatusMeta.badgeColor} variant="light" size="sm">
                {stockStatusMeta.label}
              </Badge>
              <span className={`text-xs ${stockStatusMeta.textColor} opacity-90`}>
                {stockStatusMeta.description}
              </span>
            </div>

            {/* Precio en USD con conversión automática en VES */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  Precio de Venta (USD) <span className="text-red-500">*</span>
                </label>
                {bcvRate > 0 && Number(watchedPrice) > 0 && (
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ≈ Bs. {(Number(watchedPrice) * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-gray-400 select-none">
                  $
                </span>
                <input
                  type="number"
                  {...register("priceUSD", { valueAsNumber: true })}
                  onKeyDown={(e) => {
                    if (isInvalidDecimalKey(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  step={0.01}
                  min="0"
                  placeholder="0.00"
                  className="h-10 w-full font-mono rounded-xl border border-gray-300 bg-white pl-9 pr-4 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                />
              </div>
              {bcvRate > 0 && (
                <p className="mt-1 text-xxs text-gray-400">
                  Calculado con la tasa oficial BCV: Bs. {bcvRate.toFixed(2)} por USD
                </p>
              )}
              {errors.priceUSD && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.priceUSD.message}
                </p>
              )}
            </div>

            {/* Descripción / Notas Técnicas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  Descripción / Notas Técnicas
                </label>
                <span className="text-xs text-gray-400 font-mono">
                  {watchedDescription.length} / 600
                </span>
              </div>
              <textarea
                {...register("description")}
                rows={2}
                maxLength={600}
                placeholder="Detalles sobre marca, medidas, fabricante o compatibilidad de motor..."
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Botones del Modal */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" size="sm" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                startIcon={<CheckCircleIcon className="size-4" />}
              >
                {editingId ? "Guardar Cambios" : "Agregar Artículo"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              ¿Eliminar artículo?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Esta acción no se puede deshacer y eliminará permanentemente el producto del inventario local.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteAction(deleteConfirmId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
