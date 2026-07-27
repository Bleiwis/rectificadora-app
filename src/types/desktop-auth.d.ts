type DesktopAuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: "master" | "administrador" | "caja";
  status: string;
  requiresPasswordReset: boolean;
  createdAt: string;
};

type DesktopAuthResponse = {
  ok: boolean;
  user?: DesktopAuthUser;
  error?: string;
};

type DesktopUsernameStateResponse = {
  ok: boolean;
  exists?: boolean;
  hasPassword?: boolean;
  isActive?: boolean;
  requiresPasswordReset?: boolean;
  error?: string;
};

type DesktopAuthApi = {
  setupMasterUser: (payload: {
    username: string;
    displayName?: string;
    password: string;
  }) => Promise<DesktopAuthResponse>;
  signIn: (payload: {
    username: string;
    password: string;
  }) => Promise<DesktopAuthResponse>;
  checkUsername: (username: string) => Promise<DesktopUsernameStateResponse>;
  setInitialPassword: (username: string, newPassword: string) => Promise<DesktopAuthResponse>;
  getUserById: (userId: string) => Promise<DesktopAuthResponse>;
  getBootstrapState: () => Promise<{
    ok: boolean;
    hasMasterUser?: boolean;
    error?: string;
  }>;
  listUsers: () => Promise<{ ok: boolean; users?: DesktopAuthUser[]; error?: string }>;
  createUser: (payload: {
    username: string;
    displayName?: string;
    role: "administrador" | "caja";
  }) => Promise<DesktopAuthResponse>;
  deactivateUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  flagPasswordReset: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  forceResetPassword: (userId: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  restoreUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
};

declare global {
  interface Window {
    desktopAuth?: DesktopAuthApi;
  }
}

export {};
