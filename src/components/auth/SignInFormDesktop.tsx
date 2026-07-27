import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth } from "../../hooks/useAuth";

export default function SignInFormDesktop() {
  const navigate = useNavigate();
  const {
    signIn,
    checkUsername,
    setInitialPassword,
    isDesktopAuthAvailable,
    requiresMasterSetup,
  } = useAuth();

  const [step, setStep] = useState<"username" | "password" | "setup-password">(
    "username",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleValidateUsername = async () => {
    const usernameValue = username.trim();
    if (!usernameValue) {
      setErrorMessage("Debes ingresar un usuario.");
      return;
    }

    const result = await checkUsername(usernameValue);
    if (!result.exists) {
      setErrorMessage("No existe una cuenta con ese usuario.");
      return;
    }

    if (!result.isActive) {
      setErrorMessage("Su cuenta ha sido dada de baja.");
      return;
    }

    if (result.hasPassword) {
      setStep("password");
      return;
    }

    setStep("setup-password");
  };

  const handleSignInWithPassword = async () => {
    await signIn({ username: username.trim(), password, rememberSession: isChecked });
    navigate("/");
  };

  const handleSetupInitialPassword = async () => {
    if (newPassword.length < 8) {
      setErrorMessage("La contrasena debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage("Las contrasenas no coinciden.");
      return;
    }

    await setInitialPassword(username.trim(), newPassword);
    await signIn({
      username: username.trim(),
      password: newPassword,
      rememberSession: isChecked,
    });
    navigate("/");
  };

  const resetToUsernameStep = () => {
    setStep("username");
    setPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setErrorMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (step === "username") {
        await handleValidateUsername();
      } else if (step === "password") {
        await handleSignInWithPassword();
      } else {
        await handleSetupInitialPassword();
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No fue posible iniciar sesion.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-md pt-10 mx-auto">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Volver al panel
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Iniciar Sesion
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {step === "username" && "Escribe tu usuario para continuar."}
            {step === "password" && "Usuario detectado. Ahora ingresa tu clave."}
            {step === "setup-password" &&
              "Tu cuenta no tiene clave asignada. Configurala para entrar."}
          </p>
        </div>

        {!isDesktopAuthAvailable && (
          <div className="mb-4 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-700/40 dark:bg-warning-500/10 dark:text-warning-400">
            La autenticacion de escritorio solo esta disponible dentro de Electron. Usa npm run dev:desktop.
          </div>
        )}

        {requiresMasterSetup && (
          <div className="mb-4 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-700/40 dark:bg-warning-500/10 dark:text-warning-400">
            Primer inicio detectado. Debes crear primero un usuario maestro.
            <div className="mt-2">
              <Link
                to="/setup-master"
                className="font-medium text-brand-500 hover:text-brand-600"
              >
                Ir a configuracion de maestro
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <Label>
                Usuario <span className="text-error-500">*</span>
              </Label>
              <Input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                disabled={step !== "username"}
              />
            </div>

            {step === "password" && (
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
            )}

            {step === "setup-password" && (
              <>
                <div>
                  <Label>
                    Nueva clave <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Minimo 8 caracteres"
                    />
                    <span
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showNewPassword ? (
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
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      placeholder="Repite la clave"
                    />
                    <span
                      onClick={() =>
                        setShowConfirmNewPassword(!showConfirmNewPassword)
                      }
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showConfirmNewPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox checked={isChecked} onChange={setIsChecked} />
                <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                  Mantener sesion mientras la app este abierta
                </span>
              </div>
            </div>

            {errorMessage && (
              <p className="text-sm text-error-500" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="space-y-3">
              <Button className="w-full" size="sm" type="submit" disabled={isSubmitting}>
                {isSubmitting && step === "username" && "Validando..."}
                {isSubmitting && step === "password" && "Ingresando..."}
                {isSubmitting && step === "setup-password" && "Configurando..."}
                {!isSubmitting && step === "username" && "Continuar"}
                {!isSubmitting && step === "password" && "Iniciar sesion"}
                {!isSubmitting && step === "setup-password" && "Configurar clave e ingresar"}
              </Button>
              {step !== "username" && (
                <button
                  type="button"
                  onClick={resetToUsernameStep}
                  className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cambiar usuario
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
