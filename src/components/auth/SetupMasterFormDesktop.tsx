import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import { useAuth } from "../../hooks/useAuth";

export default function SetupMasterFormDesktop() {
  const navigate = useNavigate();
  const { setupMasterUser, isDesktopAuthAvailable } = useAuth();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Las contrasenas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      await setupMasterUser({
        username,
        displayName,
        password,
      });
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No fue posible crear el usuario maestro.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <Link
          to="/signin"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Volver a iniciar sesion
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Configuracion de Usuario Maestro
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Primer inicio detectado. Crea tu usuario maestro para inicializar la app.
          </p>
        </div>

        {!isDesktopAuthAvailable && (
          <div className="mb-4 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-700/40 dark:bg-warning-500/10 dark:text-warning-400">
            La autenticacion de escritorio solo esta disponible dentro de Electron. Usa npm run dev:desktop.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <Label>
                Usuario Maestro <span className="text-error-500">*</span>
              </Label>
              <Input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Usa 3-32 caracteres. Permitidos: letras, numeros, punto, guion bajo y guion.
              </p>
            </div>

            <div>
              <Label>Nombre a mostrar (opcional)</Label>
              <Input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Administrador"
              />
            </div>

            <div>
              <Label>
                Clave <span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Ingresa tu clave"
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  )}
                </span>
              </div>
            </div>

            <div>
              <Label>
                Confirmar clave <span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirma tu clave"
                />
                <span
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showConfirmPassword ? (
                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  )}
                </span>
              </div>
            </div>

            {errorMessage && (
              <p className="text-sm text-error-500" role="alert">
                {errorMessage}
              </p>
            )}

            <div>
              <Button
                className="w-full"
                size="sm"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creando usuario maestro..." : "Crear Usuario Maestro"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
