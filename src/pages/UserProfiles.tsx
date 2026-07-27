import { useState } from "react";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import { useAuth } from "../hooks/useAuth";

export default function UserProfiles() {
  const { user, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage("La clave debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Las claves no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Clave actualizada correctamente.");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No fue posible actualizar la clave.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Mi Cuenta | Rectificadora App"
        description="Datos de cuenta del usuario y cambio de clave."
      />
      <PageBreadcrumb pageTitle="Mi Cuenta" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
            Datos de Usuario
          </h3>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
              <span className="block text-xs text-gray-500 dark:text-gray-400">Nombre</span>
              <span className="font-medium text-gray-800 dark:text-white">
                {user?.displayName || "-"}
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
              <span className="block text-xs text-gray-500 dark:text-gray-400">Usuario</span>
              <span className="font-medium text-gray-800 dark:text-white">
                {user ? `@${user.username}` : "-"}
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
              <span className="block text-xs text-gray-500 dark:text-gray-400">Rol</span>
              <span className="font-medium capitalize text-gray-800 dark:text-white">
                {user?.role || "-"}
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
              <span className="block text-xs text-gray-500 dark:text-gray-400">Estado</span>
              <span className="font-medium capitalize text-gray-800 dark:text-white">
                {user?.status || "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
            Cambiar Clave
          </h3>

          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nueva clave
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimo 8 caracteres"
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirmar nueva clave
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva clave"
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
              />
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {isSubmitting ? "Actualizando..." : "Actualizar clave"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
