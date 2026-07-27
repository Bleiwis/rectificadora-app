import React, { useState, useEffect } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../hooks/useAuth";

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  priceUSD: number;
}



export default function GestionServicios() {
  const { user } = useAuth();
  const isCaja = user?.role === "caja";
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Tapa de Cilindros",
    description: "",
    priceUSD: "",
  });

  const loadServices = () => {
    window.database.getServices().then((list) => {
      if (list && list.length > 0) {
        setServices(list as unknown as ServiceItem[]);
      } else {
        setServices([]);
      }
    }).catch(console.error);
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: "",
      category: "Tapa de Cilindros",
      description: "",
      priceUSD: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.priceUSD) return;

    const serviceData: ServiceItem = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      category: formData.category,
      description: formData.description,
      priceUSD: parseFloat(formData.priceUSD),
    };

    window.database.saveService(serviceData)
      .then(() => {
        loadServices();
        handleCancelEdit();
      })
      .catch(console.error);
  };

  const handleEdit = (service: ServiceItem) => {
    setEditingId(service.id);
    setFormData({
      name: service.name,
      category: service.category,
      description: service.description,
      priceUSD: service.priceUSD.toString(),
    });
  };

  const handleDelete = (id: string) => {
    if (editingId === id) {
      handleCancelEdit();
    }
    if (window.confirm("¿Está seguro de que desea eliminar este servicio?")) {
      window.database.deleteService(id)
        .then(loadServices)
        .catch(console.error);
    }
  };

  return (
    <div>
      <PageMeta
        title="Gestión de Partes y Servicios | Rectificadora App"
        description="Panel de administración de partes, servicios y tarifas en dólares."
      />
      <PageBreadcrumb pageTitle="Gestión de Partes y Servicios" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulario de Alta / Edición */}
        {!isCaja && (
          <div className="xl:col-span-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
              <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
                {editingId ? "Editar Servicio o Parte" : "Crear Nuevo Servicio o Parte"}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre del Servicio o Parte
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej. Rectificado de biela, Baño químico"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Categoría
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                  >
                    <option value="Tapa de Cilindros">Tapa de Cilindros</option>
                    <option value="Block">Bloque de Motor / Block</option>
                    <option value="Cigüeñal">Cigüeñal</option>
                    <option value="Limpieza">Limpieza / Lavado</option>
                    <option value="Repuestos">Repuestos / Partes</option>
                    <option value="Otros">Otros Servicios</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Valor (USD)
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
                    Detalles / Descripción
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Detalle del trabajo, tolerancias o especificaciones..."
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>

                <div className="flex gap-3">
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-200 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition duration-200"
                  >
                    {editingId ? "Guardar" : "Crear Servicio"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Listado de Servicios */}
        <div className={isCaja ? "xl:col-span-3" : "xl:col-span-2"}>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Servicios Registrados
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Catálogo de servicios disponibles para los presupuestos e ingresos.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50/50 dark:bg-brand-950/30 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                {services.length} Servicios
              </span>
            </div>

            <div className="max-w-full overflow-x-auto">
              <table className="w-full table-auto text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Servicio / Parte
                    </th>
                    <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Categoría
                    </th>
                    <th className="pb-4.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Precio (USD)
                    </th>
                    {!isCaja && (
                      <th className="pb-4.5 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {services.map((service) => (
                    <tr key={service.id} className="group">
                      <td className="py-4 pr-3">
                        <div className="font-medium text-gray-800 dark:text-white">
                          {service.name}
                        </div>
                        {service.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[280px] truncate">
                            {service.description}
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-sm text-gray-500 dark:text-gray-400">
                        {service.category}
                      </td>
                      <td className="py-4 text-sm font-semibold text-gray-800 dark:text-white">
                        ${service.priceUSD.toFixed(2)}
                      </td>
                      {!isCaja && (
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleEdit(service)}
                            className="mr-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(service.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                          >
                            Eliminar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={isCaja ? 3 : 4} className="py-8 text-center text-sm text-gray-500">
                        No hay servicios creados.{!isCaja && " Usa el formulario para dar de alta uno."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
