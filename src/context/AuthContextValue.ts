import { createContext } from "react";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: "master" | "administrador" | "caja";
  status: string;
  requiresPasswordReset: boolean;
  createdAt: string;
};

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

type UsernameStatus = {
  exists: boolean;
  hasPassword: boolean;
  isActive: boolean;
  requiresPasswordReset: boolean;
};

export type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isDesktopAuthAvailable: boolean;
  requiresMasterSetup: boolean;
  signIn: (credentials: Credentials) => Promise<AuthUser>;
  checkUsername: (username: string) => Promise<UsernameStatus>;
  setInitialPassword: (username: string, newPassword: string) => Promise<AuthUser>;
  setupMasterUser: (payload: SetupMasterPayload) => Promise<AuthUser>;
  signOut: () => void;
  changePassword: (newPassword: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
