import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth } from "../../hooks/useAuth";

type SignInStep = "server" | "username" | "password" | "setup-password";

type DiscoveryFeedback = {
  kind: "idle" | "searching" | "success" | "empty" | "error";
  message: string;
  updatedAt: string | null;
};

export default function SignInFormDesktop() {
  const navigate = useNavigate();
  const {
    signIn,
    checkUsername,
    setInitialPassword,
    isDesktopAuthAvailable,
    requiresMasterSetup,
  } = useAuth();

  const [step, setStep] = useState<SignInStep>("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [lanMode, setLanMode] = useState<LanMode>("standalone");
  const [serverHost, setServerHost] = useState("");
  const [serverToken, setServerToken] = useState("");
  const [serverPort, setServerPort] = useState(4510);
  const [isDiscoveringServers, setIsDiscoveringServers] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<LanDiscoveredServer[]>([]);
  const [discoveryFeedback, setDiscoveryFeedback] = useState<DiscoveryFeedback>({
    kind: "idle",
    message: "Todavía no se ha ejecutado una búsqueda de servidor.",
    updatedAt: null,
  });
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshLanPreLoginState = async () => {
    const [config, status] = await Promise.all([
      window.database.getLanConfig(),
      window.database.getLanStatus(),
    ]);

    setLanMode(config.mode);
    setServerHost(
      config.mode === "client" && config.host.toLowerCase() !== "auto"
        ? config.host
        : "",
    );
    setServerToken(config.token || "");
    setServerPort(config.port || 4510);
    setDiscoveredServers(status.discoveredServers || []);

    if ((status.discoveredServers || []).length > 0) {
      setDiscoveryFeedback({
        kind: "idle",
        message: `Último escaneo guardado: ${(status.discoveredServers || []).length} servidor(es) detectado(s) por broadcast.`,
        updatedAt: new Date().toISOString(),
      });
    }

    if (config.mode === "client") {
      if (status.remoteReachable) {
        setIsServerConnected(true);
        setStep("username");
      } else {
        setIsServerConnected(false);
        setStep("server");
      }
      return;
    }

    setIsServerConnected(true);
    setStep("username");
  };

  useEffect(() => {
    let isCancelled = false;

    void refreshLanPreLoginState().catch((error) => {
      if (isCancelled) return;
      console.error(error);
      setStep("server");
      setIsServerConnected(false);
      setErrorMessage("No fue posible validar la conexion LAN inicial.");
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleDiscoverServers = async () => {
    setErrorMessage(null);
    setDiscoveryFeedback({
      kind: "searching",
      message: "Buscando servidores LAN...",
      updatedAt: new Date().toISOString(),
    });
    setIsDiscoveringServers(true);
    try {
      const found = await window.database.discoverLanServers();
      const discovered = Array.isArray(found) ? found : [];
      const verified = await Promise.all(
        discovered.map(async (server) => {
          try {
            const probe = await window.database.probeLanServer({
              host: server.host,
              port: server.port,
              token: serverToken.trim(),
            });

            return {
              ...server,
              reachable: Boolean(probe.reachable),
              probeError: probe.error || null,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Error desconocido al validar servidor.";
            const probeUnavailable = message.includes("No handler registered for 'db:probe-lan-server'");

            return {
              ...server,
              reachable: probeUnavailable ? undefined : false,
              probeError: probeUnavailable ? "PROBE_UNAVAILABLE" : message,
            };
          }
        }),
      );

      setDiscoveredServers(verified);

      if (verified.length > 0) {
        const reachableCount = verified.filter((server) => server.reachable).length;
        const probeUnavailable = verified.some((server) => server.probeError === "PROBE_UNAVAILABLE");
        const preferred = verified.find((server) => server.reachable) || verified[0];
        setServerHost(preferred.host);
        setServerPort(preferred.port);

        if (reachableCount > 0) {
          setDiscoveryFeedback({
            kind: "success",
            message: `Escaneo completado: ${verified.length} detectado(s), ${reachableCount} conectable(s). Se seleccionó ${preferred.host}:${preferred.port}.`,
            updatedAt: new Date().toISOString(),
          });
        } else if (probeUnavailable) {
          setDiscoveryFeedback({
            kind: "empty",
            message:
              `Escaneo completado: ${verified.length} detectado(s) por broadcast, pero esta ejecución no puede validar conexión TCP. Reinicia la app de escritorio para cargar el handler nuevo.`,
            updatedAt: new Date().toISOString(),
          });
        } else {
          setDiscoveryFeedback({
            kind: "empty",
            message:
              `Escaneo completado: ${verified.length} detectado(s) por broadcast, pero ninguno respondió por conexión TCP.`,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        setDiscoveryFeedback({
          kind: "empty",
          message: "Escaneo completado: no se detectaron servidores LAN.",
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(error);
      setDiscoveredServers([]);
      const detail = error instanceof Error ? error.message : "Error desconocido";
      setDiscoveryFeedback({
        kind: "error",
        message: `Falló la búsqueda de servidor: ${detail}`,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsDiscoveringServers(false);
    }
  };

  const handleConnectServer = async () => {
    const host = serverHost.trim();
    if (!host) {
      setErrorMessage("Debes indicar la IP o hostname del servidor.");
      return;
    }

    setErrorMessage(null);
    try {
      await window.database.setLanConfig({
        mode: "client",
        host,
        port: serverPort,
        token: serverToken.trim(),
      });

      const status = await window.database.getLanStatus();
      if (!status.remoteReachable) {
        throw new Error(
          "No se pudo establecer conexion con el servidor LAN. Verifica IP, puerto o token.",
        );
      }

      setIsServerConnected(true);
      setStep("username");
    } catch (error) {
      setIsServerConnected(false);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No fue posible conectar con el servidor LAN.");
      }
    }
  };

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
    setStep(lanMode === "client" && !isServerConnected ? "server" : "username");
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
      if (step === "server") {
        await handleConnectServer();
      } else if (step === "username") {
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
            {step === "server" &&
              "Primero conecta este equipo al servidor LAN para habilitar el inicio de sesion."}
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
            {step === "server" && (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
                  Modo actual: <strong>{lanMode === "client" ? "Cliente LAN" : "Standalone/Servidor"}</strong>
                </div>

                <div>
                  <Label>
                    IP del servidor <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={serverHost}
                    onChange={(event) => setServerHost(event.target.value)}
                    placeholder="Ejemplo: 192.168.1.104"
                  />
                </div>

                <div>
                  <Label>Token (opcional)</Label>
                  <Input
                    type="text"
                    value={serverToken}
                    onChange={(event) => setServerToken(event.target.value)}
                    placeholder="Solo si el servidor exige token"
                  />
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleDiscoverServers}
                    disabled={isDiscoveringServers}
                    className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {isDiscoveringServers ? "Buscando servidor..." : "Buscar servidor en la red"}
                  </button>

                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      discoveryFeedback.kind === "error"
                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-300"
                        : discoveryFeedback.kind === "success"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
                          : discoveryFeedback.kind === "empty"
                            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300"
                            : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300"
                    }`}
                  >
                    <p>{discoveryFeedback.message}</p>
                    {discoveryFeedback.updatedAt ? (
                      <p className="mt-1 opacity-80">
                        Último escaneo: {new Date(discoveryFeedback.updatedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  {discoveredServers.length > 0 && (
                    <div className="max-h-28 space-y-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-800 dark:bg-white/[0.02]">
                      {discoveredServers.map((server) => (
                        <button
                          key={`${server.host}:${server.port}`}
                          type="button"
                          onClick={() => {
                            setServerHost(server.host);
                            setServerPort(server.port);
                          }}
                          className="w-full rounded px-2 py-1 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <div>{server.host}:{server.port}</div>
                          <div
                            className={`${
                              server.reachable
                                ? "text-emerald-700 dark:text-emerald-300"
                                : server.probeError === "PROBE_UNAVAILABLE"
                                  ? "text-blue-700 dark:text-blue-300"
                                : "text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {server.reachable
                              ? "Conectable"
                              : server.probeError === "PROBE_UNAVAILABLE"
                                ? "Detectado (sin validación TCP en esta ejecución)"
                                : "Detectado, pero no conectable"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {step !== "server" && (
              <div>
                <Label>
                  Usuario <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  disabled={step === "password" || step === "setup-password"}
                />
              </div>
            )}

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
                {isSubmitting && step === "server" && "Conectando..."}
                {isSubmitting && step === "username" && "Validando..."}
                {isSubmitting && step === "password" && "Ingresando..."}
                {isSubmitting && step === "setup-password" && "Configurando..."}
                {!isSubmitting && step === "server" && "Conectar servidor"}
                {!isSubmitting && step === "username" && "Continuar"}
                {!isSubmitting && step === "password" && "Iniciar sesion"}
                {!isSubmitting && step === "setup-password" && "Configurar clave e ingresar"}
              </Button>
              {step !== "username" && step !== "server" && (
                <button
                  type="button"
                  onClick={resetToUsernameStep}
                  className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cambiar usuario
                </button>
              )}
              {step !== "server" && lanMode === "client" && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("server");
                    setErrorMessage(null);
                  }}
                  className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cambiar servidor
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
