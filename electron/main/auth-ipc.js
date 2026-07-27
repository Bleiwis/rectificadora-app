import { ipcMain } from "electron";
import { AUTH_CHANNELS } from "../shared/auth-channels.js";

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ha ocurrido un error inesperado.";
}

export function registerAuthIpcHandlers(authStore, onUserChanged) {
  ipcMain.removeHandler(AUTH_CHANNELS.setupMasterUser);
  ipcMain.removeHandler(AUTH_CHANNELS.signIn);
  ipcMain.removeHandler(AUTH_CHANNELS.checkUsername);
  ipcMain.removeHandler(AUTH_CHANNELS.setInitialPassword);
  ipcMain.removeHandler(AUTH_CHANNELS.getUserById);
  ipcMain.removeHandler(AUTH_CHANNELS.getBootstrapState);
  ipcMain.removeHandler(AUTH_CHANNELS.listUsers);
  ipcMain.removeHandler(AUTH_CHANNELS.createUser);
  ipcMain.removeHandler(AUTH_CHANNELS.deactivateUser);
  ipcMain.removeHandler(AUTH_CHANNELS.flagPasswordReset);
  ipcMain.removeHandler(AUTH_CHANNELS.forceResetPassword);
  ipcMain.removeHandler(AUTH_CHANNELS.restoreUser);

  const mirrorUser = (user) => {
    if (typeof onUserChanged === "function" && user) {
      onUserChanged(user);
    }
  };

  ipcMain.handle(AUTH_CHANNELS.setupMasterUser, async (_event, payload) => {
    try {
      const user = authStore.setupMasterUser(payload ?? {});
      mirrorUser(user);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.signIn, async (_event, payload) => {
    try {
      const user = authStore.signIn(payload ?? {});
      mirrorUser(user);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.checkUsername, async (_event, payload) => {
    try {
      const username = payload?.username;
      if (typeof username !== "string" || !username.trim()) {
        return { ok: false, error: "Usuario invalido." };
      }

      const status = authStore.getSignInState(username);
      return { ok: true, ...status };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.setInitialPassword, async (_event, payload) => {
    try {
      const username = payload?.username;
      const newPassword = payload?.newPassword;

      if (typeof username !== "string" || !username.trim()) {
        return { ok: false, error: "Usuario invalido." };
      }

      if (typeof newPassword !== "string" || !newPassword.trim()) {
        return { ok: false, error: "Nueva clave invalida." };
      }

      const user = authStore.setInitialPassword({ username, newPassword });
      mirrorUser(user);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.getUserById, async (_event, payload) => {
    try {
      const userId = payload?.userId;
      if (typeof userId !== "string" || !userId.trim()) {
        return { ok: false, error: "Usuario invalido." };
      }

      const user = authStore.getUserById(userId);
      if (!user) {
        return { ok: false, error: "Usuario no encontrado." };
      }

      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.getBootstrapState, async () => {
    try {
      const bootstrapState = authStore.getBootstrapState();
      return { ok: true, ...bootstrapState };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.listUsers, async () => {
    try {
      const users = authStore.listUsers();
      return { ok: true, users };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.createUser, async (_event, payload) => {
    try {
      const user = authStore.createUser(payload ?? {});
      mirrorUser(user);
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.deactivateUser, async (_event, payload) => {
    try {
      const userId = payload?.userId;
      if (typeof userId !== "string" || !userId.trim()) {
        return { ok: false, error: "Usuario invalido." };
      }
      authStore.deactivateUser(userId);
      const user = authStore.getUserById(userId);
      mirrorUser(user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.flagPasswordReset, async (_event, payload) => {
    try {
      const userId = payload?.userId;
      if (typeof userId !== "string" || !userId.trim()) {
        return { ok: false, error: "Usuario invalido." };
      }
      authStore.flagPasswordReset(userId);
      const user = authStore.getUserById(userId);
      mirrorUser(user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.forceResetPassword, async (_event, payload) => {
    try {
      const userId = payload?.userId;
      const newPassword = payload?.newPassword;
      if (typeof userId !== "string" || !userId.trim()) {
        return { ok: false, error: "Usuario invalido." };
      }
      if (typeof newPassword !== "string" || !newPassword.trim()) {
        return { ok: false, error: "Nueva clave invalida." };
      }
      authStore.forceResetPassword(userId, newPassword);
      const user = authStore.getUserById(userId);
      mirrorUser(user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle(AUTH_CHANNELS.restoreUser, async (_event, payload) => {
    try {
      const userId = payload?.userId;
      if (typeof userId !== "string" || !userId.trim()) {
        return { ok: false, error: "Usuario invalido." };
      }
      authStore.restoreUser(userId);
      const user = authStore.getUserById(userId);
      mirrorUser(user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });
}
