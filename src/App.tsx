import { useEffect, useRef, useState, type ReactNode } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SetupMaster from "./pages/AuthPages/SetupMaster";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import Ingreso from "./pages/Ingreso";
import Pedidos from "./pages/Pedidos";
import GestionServicios from "./pages/GestionServicios";
import Inventario from "./pages/Inventario";
import Usuarios from "./pages/Usuarios";
import Ajustes from "./pages/Ajustes";
import { ResetPasswordScreen } from "./components/auth/ResetPasswordScreen";
import { useAuth } from "./hooks/useAuth";

const AuthLoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center px-4 text-sm text-gray-500 dark:text-gray-400">
    Cargando sesion...
  </div>
);

const AuthUnavailableScreen = () => (
  <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-gray-500 dark:text-gray-400">
    <div>
      <p>Desktop auth bridge is not available.</p>
      <p className="mt-1">Run this app with npm run dev:desktop.</p>
    </div>
  </div>
);

const LicenseBlockedScreen = ({
  license: initialLicense,
  onRefreshSuccess,
}: {
  license: LicenseStatusPayload;
  onRefreshSuccess?: (newStatus: LicenseStatusPayload) => void;
}) => {
  const [license, setLicense] = useState(initialLicense);
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const isTrialExpired = license.reason === "trial-expired-missing-license";

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(license.installationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleVerifyNow = async () => {
    const licenseApi = typeof window !== "undefined" ? window.license : undefined;
    if (!licenseApi || isChecking) return;
    setIsChecking(true);
    setFeedbackMessage(null);
    try {
      const refreshed = await licenseApi.refresh();
      setLicense(refreshed);
      if (refreshed.status !== "blocked") {
        onRefreshSuccess?.(refreshed);
      } else {
        setFeedbackMessage(
          "El sistema verificó con el servidor pero la licencia continúa sin pago registrado.",
        );
      }
    } catch {
      setFeedbackMessage(
        "No se pudo contactar al servidor de licencias. Verifica la conexión a internet de este equipo.",
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-7 text-center shadow-lg dark:border-red-900/40 dark:bg-gray-900 sm:p-9">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
          <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acceso Bloqueado por Licencia</h1>
        <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {isTrialExpired
            ? "El período de prueba ha finalizado. Registra un pago para reactivar el acceso completo al sistema."
            : "El período de uso venció y la aplicación se encuentra en pausa hasta registrar un nuevo pago de suscripción."}
        </p>

        {/* Tarjeta de identificación para soporte */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-left dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">ID de Instalación:</span>
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-brand-600 shadow-xs border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400 dark:hover:bg-gray-700 transition cursor-pointer"
            >
              {copied ? "✓ Copiado" : "📋 Copiar ID"}
            </button>
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-gray-800 dark:text-gray-200 select-all break-all">
            {license.installationId}
          </p>

          <div className="mt-3 flex items-center justify-between border-t border-gray-200/60 pt-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <span>Fecha de corte:</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {license.blockAt ? new Date(license.blockAt).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : "No disponible"}
            </span>
          </div>
        </div>

        {/* Mensaje de feedback si la verificación falló */}
        {feedbackMessage && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-left border border-amber-200 dark:border-amber-900/40">
            {feedbackMessage}
          </div>
        )}

        {/* Pasos y botón de acción */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleVerifyNow}
            disabled={isChecking}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-70 transition cursor-pointer"
          >
            {isChecking ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Verificando pago con el servidor...</span>
              </>
            ) : (
              <span>🔄 Comprobar Pago Ahora</span>
            )}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Conecta el equipo a internet antes de pulsar comprobar pago.
          </p>
        </div>
      </div>
    </div>
  );
};

const LicenseWarningBanner = ({
  license,
  onClose,
}: {
  license: LicenseStatusPayload;
  onClose: () => void;
}) => {
  const isTrial = license.reason === "trial-active-missing-license";

  return (
    <div className="fixed left-1/2 top-20 z-[100000] w-[min(92vw,920px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 lg:top-24">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {isTrial
              ? `Modo prueba activo: restan ${license.daysUntilBlock} dia(s) para el bloqueo automatico.`
              : `Aviso de licencia: restan ${license.daysUntilBlock} dia(s) para el bloqueo automatico por pago pendiente.`}
          </p>
          <p className="mt-1 text-xs opacity-90">
            Corte: {license.blockAt || "No disponible"} | Instalacion: {license.installationId}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, isLoading, isDesktopAuthAvailable, requiresMasterSetup } =
    useAuth();
  const [licenseState, setLicenseState] = useState<LicenseStatusPayload | null>(
    null,
  );
  const [isLicenseLoading, setIsLicenseLoading] = useState(true);
  const [showLicenseWarningBanner, setShowLicenseWarningBanner] = useState(false);
  const hasInitializedWarningRef = useRef(false);

  useEffect(() => {
    const licenseApi = typeof window !== "undefined" ? window.license : undefined;

    if (!isDesktopAuthAvailable || !user || !licenseApi) {
      setIsLicenseLoading(false);
      setLicenseState(null);
      return;
    }

    let isCancelled = false;
    let intervalId: number | null = null;

    const isMissingHandlerError = (error: unknown) => {
      if (!(error instanceof Error)) return false;
      return error.message.includes("No handler registered for 'license:get-status'");
    };

    const loadLicense = async () => {
      try {
        const localStatus = await licenseApi.getStatus();
        if (!isCancelled) {
          setLicenseState(localStatus);
        }

        const refreshedStatus = await licenseApi.refresh();
        if (!isCancelled) {
          setLicenseState(refreshedStatus);
          if (!hasInitializedWarningRef.current) {
            setShowLicenseWarningBanner(refreshedStatus?.status === "warning");
            hasInitializedWarningRef.current = true;
          }
        }

        intervalId = window.setInterval(() => {
          void licenseApi
            .getStatus()
            .then((status) => {
              if (!isCancelled) {
                setLicenseState(status);
              }
            })
            .catch((error) => {
              if (!isCancelled && isMissingHandlerError(error)) {
                setLicenseState(null);
              }
            });
        }, 60 * 1000);
      } catch {
        if (!isCancelled) {
          setLicenseState(null);
          if (!hasInitializedWarningRef.current) {
            setShowLicenseWarningBanner(false);
            hasInitializedWarningRef.current = true;
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLicenseLoading(false);
        }
      }
    };

    void loadLicense();

    return () => {
      isCancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      hasInitializedWarningRef.current = false;
    };
  }, [isDesktopAuthAvailable, user]);

  if (!isDesktopAuthAvailable) {
    return <AuthUnavailableScreen />;
  }

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (requiresMasterSetup) {
    return <Navigate to="/setup-master" replace />;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (user.requiresPasswordReset) {
    return <ResetPasswordScreen />;
  }

  if (isLicenseLoading) {
    return <AuthLoadingScreen />;
  }

  if (licenseState?.status === "blocked") {
    return (
      <LicenseBlockedScreen
        license={licenseState}
        onRefreshSuccess={(newStatus) => {
          setLicenseState(newStatus);
          setShowLicenseWarningBanner(newStatus.status === "warning");
        }}
      />
    );
  }

  return (
    <>
      {licenseState?.status === "warning" && showLicenseWarningBanner ? (
        <LicenseWarningBanner
          license={licenseState}
          onClose={() => setShowLicenseWarningBanner(false)}
        />
      ) : null}
      {children}
    </>
  );
};

const GuestOnly = ({ children }: { children: ReactNode }) => {
  const { user, isLoading, isDesktopAuthAvailable, requiresMasterSetup } =
    useAuth();

  if (!isDesktopAuthAvailable) {
    return <AuthUnavailableScreen />;
  }

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (requiresMasterSetup) {
    return <Navigate to="/setup-master" replace />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const SetupOnly = ({ children }: { children: ReactNode }) => {
  const { user, isLoading, isDesktopAuthAvailable, requiresMasterSetup } =
    useAuth();

  if (!isDesktopAuthAvailable) {
    return <AuthUnavailableScreen />;
  }

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!requiresMasterSetup) {
    if (user) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/signin" replace />;
  }

  return children;
};

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index path="/" element={<Home />} />
            <Route path="/ingreso" element={<Ingreso />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/gestion-servicios" element={<GestionServicios />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/ajustes" element={<Ajustes />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="/basic-tables" element={<BasicTables />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>

          {/* Auth Layout */}
          <Route
            path="/setup-master"
            element={
              <SetupOnly>
                <SetupMaster />
              </SetupOnly>
            }
          />
          <Route
            path="/signin"
            element={
              <GuestOnly>
                <SignIn />
              </GuestOnly>
            }
          />
          <Route path="/signup" element={<Navigate to="/setup-master" replace />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
