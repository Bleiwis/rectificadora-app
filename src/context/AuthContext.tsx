import { useEffect, useState } from "react";
import { AuthContext, type AuthUser } from "./AuthContextValue";

type Credentials = {
  username: string;
  password: string;
  rememberSession?: boolean;
};

type SetupMasterPayload = {
  username: string;
  displayName?: string;
  password: string;
};
const SESSION_STORAGE_KEY = "rectificadora.auth.userId";

function writeSessionUserId(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, userId);
}

function clearSessionUserId() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function getDesktopAuthApi() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.desktopAuth;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresMasterSetup, setRequiresMasterSetup] = useState(false);

  const isDesktopAuthAvailable = Boolean(getDesktopAuthApi());

  useEffect(() => {
    const bootstrapSession = async () => {
      const desktopAuth = getDesktopAuthApi();
      if (!desktopAuth) {
        setIsLoading(false);
        return;
      }

      const bootstrapState = await desktopAuth.getBootstrapState();
      if (!bootstrapState.ok) {
        throw new Error(
          bootstrapState.error ?? "No fue posible obtener el estado inicial.",
        );
      }

      const hasMasterUser = Boolean(bootstrapState.hasMasterUser);
      setRequiresMasterSetup(!hasMasterUser);

      if (!hasMasterUser) {
        clearSessionUserId();
        setUser(null);
        setIsLoading(false);
        return;
      }

      // For security and deterministic flow, app startup always requires login
      // once a master user already exists.
      clearSessionUserId();
      setUser(null);

      setIsLoading(false);
    };

    const runBootstrap = async () => {
      try {
        await bootstrapSession();
      } catch {
        setUser(null);
        setIsLoading(false);
      }
    };

    void runBootstrap();
  }, []);

  const signIn = async (credentials: Credentials) => {
    const desktopAuth = getDesktopAuthApi();
    if (!desktopAuth) {
      throw new Error(
        "La autenticacion local solo esta disponible en la app de escritorio.",
      );
    }

    if (requiresMasterSetup) {
      throw new Error("Primero debes crear el usuario maestro.");
    }

    const result = await desktopAuth.signIn({
      username: credentials.username,
      password: credentials.password,
    });
    if (!result.ok || !result.user) {
      throw new Error(result.error ?? "No fue posible iniciar sesion.");
    }

    if (credentials.rememberSession ?? true) {
      writeSessionUserId(result.user.id);
    } else {
      clearSessionUserId();
    }
    setUser(result.user);
    return result.user;
  };

  const checkUsername = async (username: string) => {
    const desktopAuth = getDesktopAuthApi();
    if (!desktopAuth) {
      throw new Error(
        "La autenticacion local solo esta disponible en la app de escritorio.",
      );
    }

    const result = await desktopAuth.checkUsername(username);
    if (!result.ok) {
      throw new Error(result.error ?? "No fue posible validar el usuario.");
    }

    return {
      exists: Boolean(result.exists),
      hasPassword: Boolean(result.hasPassword),
      isActive: Boolean(result.isActive),
      requiresPasswordReset: Boolean(result.requiresPasswordReset),
    };
  };

  const setInitialPassword = async (username: string, newPassword: string) => {
    const desktopAuth = getDesktopAuthApi();
    if (!desktopAuth) {
      throw new Error(
        "La autenticacion local solo esta disponible en la app de escritorio.",
      );
    }

    const result = await desktopAuth.setInitialPassword(username, newPassword);
    if (!result.ok || !result.user) {
      throw new Error(result.error ?? "No fue posible configurar la clave inicial.");
    }

    return result.user;
  };

  const setupMasterUser = async (payload: SetupMasterPayload) => {
    const desktopAuth = getDesktopAuthApi();
    if (!desktopAuth) {
      throw new Error(
        "La autenticacion local solo esta disponible en la app de escritorio.",
      );
    }

    const result = await desktopAuth.setupMasterUser(payload);
    if (!result.ok || !result.user) {
      throw new Error(result.error ?? "No fue posible crear el usuario maestro.");
    }

    writeSessionUserId(result.user.id);
    setUser(result.user);
    setRequiresMasterSetup(false);
    return result.user;
  };

  const signOut = () => {
    setUser(null);
    clearSessionUserId();
  };

  const changePassword = async (newPassword: string) => {
    if (!user) return;
    const desktopAuth = getDesktopAuthApi();
    if (!desktopAuth) return;

    const res = await desktopAuth.forceResetPassword(user.id, newPassword);
    if (!res.ok) {
      throw new Error(res.error || "No se pudo cambiar la contraseña.");
    }
    setUser((prev) => prev ? { ...prev, requiresPasswordReset: false } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isDesktopAuthAvailable,
        requiresMasterSetup,
        signIn,
        checkUsername,
        setInitialPassword,
        setupMasterUser,
        signOut,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
