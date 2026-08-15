import { useState, useEffect } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  type CreateUserFormValues,
} from "../validation/forms";

interface UserListItem {
  id: string;
  username: string;
  displayName: string;
  role: "master" | "administrador" | "caja";
  status: string;
  requiresPasswordReset: boolean;
  createdAt: string;
}

export default function Usuarios() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      displayName: "",
      role: "caja",
    },
  });

  const isAdmin = user?.role === "master" || user?.role === "administrador";

  const loadUsers = () => {
    setIsLoading(true);
    window.desktopAuth?.listUsers()
      .then((res) => {
        if (res.ok && res.users) {
          setUsersList(res.users as UserListItem[]);
        } else {
          setErrorMessage(res.error || "No se pudieron cargar los usuarios.");
        }
      })
      .catch((err) => {
        console.error(err);
        setErrorMessage("Error al cargar los usuarios.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreateUser = (values: CreateUserFormValues) => {
    setErrorMessage(null);

    window.desktopAuth?.createUser({
      username: values.username,
      displayName: values.displayName || "",
      role: values.role,
    })
      .then((res) => {
        if (res.ok) {
          reset();
          loadUsers();
        } else {
          setErrorMessage(res.error || "No se pudo crear el usuario.");
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || "Error al crear el usuario.");
      });
  };

  const handleDeactivate = (userId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    window.desktopAuth?.deactivateUser(userId)
      .then((res) => {
        if (res.ok) {
          setSuccessMessage("Usuario dado de baja exitosamente.");
          loadUsers();
        } else {
          setErrorMessage(res.error || "No se pudo dar de baja al usuario.");
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || "Error al dar de baja al usuario.");
      });
  };

  const handleRequestPasswordReset = (userId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    window.desktopAuth?.flagPasswordReset(userId)
      .then((res) => {
        if (res.ok) {
          setSuccessMessage("El usuario deberá cambiar su contraseña al ingresar.");
          loadUsers();
        } else {
          setErrorMessage(res.error || "No se pudo marcar para cambio de clave.");
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || "Error al solicitar reseteo de clave.");
      });
  };

  const handleRestore = (userId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    window.desktopAuth?.restoreUser(userId)
      .then((res) => {
        if (res.ok) {
          setSuccessMessage("Cuenta de usuario reactivada exitosamente.");
          loadUsers();
        } else {
          setErrorMessage(res.error || "No se pudo reactivar al usuario.");
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || "Error al reactivar al usuario.");
      });
  };

  return (
    <div>
      <PageMeta
        title="Gestión de Usuarios | Rectificadora App"
        description="Panel de administración de roles, contraseñas y permisos."
      />
      <PageBreadcrumb pageTitle="Gestión de Usuarios" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Registro de Usuario */}
        <div className="xl:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
            <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              Registrar Nuevo Operario
            </h3>

            {errorMessage && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-600 dark:bg-green-950/20 dark:text-green-400">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit(handleCreateUser)} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Usuario <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("username")}
                  placeholder="Ej. pedro.caja"
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                />
                {errors.username && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre a Mostrar (Opcional)
                </label>
                <input
                  type="text"
                  {...register("displayName")}
                  placeholder="Ej. Pedro Gómez"
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                />
                {errors.displayName && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.displayName.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rol / Permisos
                </label>
                <select
                  {...register("role")}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-500"
                >
                  <option value="caja">Caja / Vendedor (Acceso restringido)</option>
                  <option value="administrador">Administrador (Acceso total)</option>
                </select>
                {errors.role && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.role.message}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 transition"
              >
                Crear Operario
              </button>
            </form>
          </div>
        </div>

        {/* Listado de Usuarios */}
        <div className="xl:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
            <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              Operarios y Cuentas Activas
            </h3>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-gray-500">Cargando operarios...</div>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="w-full table-auto text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="pb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Usuario</th>
                      <th className="pb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Rol</th>
                      <th className="pb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                      <th className="pb-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {usersList.map((u) => {
                      const isSelf = u.id === user?.id;
                      const isMaster = u.role === "master";

                      return (
                        <tr key={u.id} className="group">
                          <td className="py-4">
                            <div className="font-semibold text-gray-800 dark:text-white">
                              {u.displayName || u.username}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              @{u.username}
                            </div>
                          </td>
                          <td className="py-4 text-sm text-gray-800 dark:text-white capitalize">
                            {u.role === "master" ? "Super Admin" : u.role}
                          </td>
                          <td className="py-4 text-sm">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xxs font-semibold ${
                              u.status === "active"
                                ? "bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400"
                                : "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"
                            }`}>
                              {u.status === "active" ? "Activo" : "Dado de baja"}
                            </span>
                            {u.requiresPasswordReset && (
                              <span className="ml-1.5 inline-flex rounded-full bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20 dark:text-yellow-400 px-2 py-0.5 text-xxs font-semibold">
                                Clave Pendiente
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            {!isSelf && !isMaster && u.status === "active" && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleRequestPasswordReset(u.id)}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition"
                                >
                                  Forzar Clave
                                </button>
                                <button
                                  onClick={() => handleDeactivate(u.id)}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                                >
                                  Dar de Baja
                                </button>
                              </div>
                            )}
                            {!isSelf && !isMaster && u.status === "inactive" && (
                              <button
                                onClick={() => handleRestore(u.id)}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition"
                              >
                                Reactivar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
