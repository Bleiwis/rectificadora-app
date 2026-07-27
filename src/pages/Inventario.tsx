import React, { useState, useMemo } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../hooks/useAuth";

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

  const loadInventory = () => {
    window.database.getInventory().then((list) => {
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
    }).catch(console.error);
  };

  React.useEffect(() => {
    loadInventory();
  }, []);

  // Dynamic category state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "Aros",
    priceUSD: "",
    quantity: "",
    minStock: "5",
    description: "",
  });

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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddNewCategory = (e: React.MouseEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (!categoriesList.includes(trimmed)) {
      setCategoriesList((prev) => [...prev, trimmed]);
    }
    setFormData((prev) => ({ ...prev, category: trimmed }));
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.priceUSD || !formData.quantity) return;

    const itemData: InventoryItem = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      category: formData.category,
      priceUSD: parseFloat(formData.priceUSD),
      quantity: parseInt(formData.quantity, 10),
      minStock: parseInt(formData.minStock, 10),
      description: formData.description,
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
    setFormData({
      name: item.name,
      category: item.category,
      priceUSD: item.priceUSD.toString(),
      quantity: item.quantity.toString(),
      minStock: item.minStock.toString(),
      description: item.description,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      category: categoriesList[0] || "Otros",
      priceUSD: "",
      quantity: "",
      minStock: "5",
      description: "",
    });
    setIsAddingCategory(false);
    setNewCategoryName("");
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (editingId === id) {
      closeModal();
    }
    if (window.confirm("¿Está seguro de que desea eliminar este artículo del inventario?")) {
      window.database.deleteInventory(id)
        .then(loadInventory)
        .catch(console.error);
    }
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
        
        {/* Fila superior con buscador y botón de Agregar */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="max-w-[400px] w-full relative">
            <input
              type="text"
              placeholder="Buscar artículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
            />
          </div>

          {!isCaja && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition"
            >
              + Agregar Artículo
            </button>
          )}
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Filtrar Categoría */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Categoría
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
            >
              <option value="All">Todas las Categorías</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filtrar por Alerta de Stock */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Estado de Stock
            </label>
            <select
              value={filterStockStatus}
              onChange={(e) => setFilterStockStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
            >
              <option value="All">Todos los Estados</option>
              <option value="InStock">Suficiente Existencia</option>
              <option value="LowStock">Próximo a Agotarse (Bajo Stock)</option>
              <option value="OutOfStock">Sin Existencia (Agotado)</option>
            </select>
          </div>

          {/* Criterio de Ordenamiento */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Ordenar por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
            >
              <option value="default">Orden por Defecto</option>
              <option value="low-stock-first">Próximos a quedarse sin existencia</option>
              <option value="qty-desc">Cantidad: Mayor a Menor</option>
              <option value="qty-asc">Cantidad: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
            </select>
          </div>
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

      {/* Modal Overlay para Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-[550px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-white sm:p-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-850 dark:text-white">
                {editingId ? "Editar Artículo de Inventario" : "Agregar Nuevo Artículo"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre del Artículo
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ej. Juego de Aros Std Hilux"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* Categoría con funcionalidad de agregado dinámico */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoría
                </label>
                {!isAddingCategory ? (
                  <div className="flex gap-2">
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(true)}
                      className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-350 transition"
                      title="Agregar Categoría"
                    >
                      + Nueva
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50/20 p-3 dark:border-brand-900/30 dark:bg-brand-950/10">
                    <label className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                      Escribe el nombre de la nueva categoría:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Ej. Bielas, Filtros"
                        className="w-full rounded-lg border border-gray-350 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewCategory}
                        className="rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCategory(false);
                          setNewCategoryName("");
                        }}
                        className="rounded-lg border border-gray-350 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    min="0"
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="0"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mínimo Alerta
                  </label>
                  <input
                    type="number"
                    name="minStock"
                    min="0"
                    value={formData.minStock}
                    onChange={handleChange}
                    placeholder="5"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Precio (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-sm text-gray-500 dark:text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    name="priceUSD"
                    step="0.01"
                    min="0"
                    value={formData.priceUSD}
                    onChange={handleChange}
                    placeholder="0.00"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-transparent pl-8 pr-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Detalles sobre marca, medidas o compatibilidad..."
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* Botones del Modal */}
              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-200 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition duration-200"
                >
                  {editingId ? "Guardar Cambios" : "Agregar Artículo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
