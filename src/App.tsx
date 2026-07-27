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

const LicenseBlockedScreen = ({ license }: { license: LicenseStatusPayload }) => {
  const isTrialExpired = license.reason === "trial-expired-missing-license";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900/50 dark:bg-gray-900">
        <h1 className="text-2xl font-semibold text-red-700 dark:text-red-400">Licencia Bloqueada</h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {isTrialExpired
            ? "El periodo de prueba finalizo y la aplicacion se encuentra bloqueada hasta registrar una licencia valida."
            : "El periodo de uso vencio y la aplicacion se encuentra bloqueada hasta registrar un nuevo pago."}
        </p>
      <div className="mt-6 rounded-xl bg-red-50 p-4 text-left text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
        <p>
          <strong>Instalacion:</strong> {license.installationId}
        </p>
        <p className="mt-1">
          <strong>Fecha de bloqueo:</strong> {license.blockAt || "No disponible"}
        </p>
        {license.lastError && (
          <p className="mt-1">
            <strong>Detalle:</strong> {license.lastError}
          </p>
        )}
      </div>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Conecta el equipo a internet y solicita la actualizacion de licencia para continuar.
      </p>
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
    return <LicenseBlockedScreen license={licenseState} />;
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
