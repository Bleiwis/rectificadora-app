import { describe, it, expect, vi } from "vitest";
import { createAuthStore } from "../electron/main/auth-store";

vi.mock("better-sqlite3", () => {
  return {
    default: class MockDatabase {
      constructor() {
        this.store = {
          app_users: {},
        };
      }
      pragma() {}
      exec() {}
      prepare(query) {
        const compactQuery = String(query).replace(/\s+/g, " ").trim();

        return {
          all: () => {
            return Object.values(this.store.app_users);
          },
          get: (param) => {
            if (compactQuery.includes("COUNT")) {
              return { total: Object.keys(this.store.app_users).length };
            }
            // Simple match logic
            const values = Object.values(this.store.app_users);
            if (compactQuery.includes("username_hash")) {
              return values.find(u => u.username_hash === param) || null;
            }
            if (compactQuery.includes("id = ?")) {
              return values.find(u => u.id === param) || null;
            }
            return null;
          },
          run: (...args) => {
            if (compactQuery.includes("INSERT INTO app_users")) {
              const params = args[0];
              const u = {
                id: params.id,
                username_hash: params.usernameHash,
                username_encrypted: params.usernameEncrypted,
                display_name_encrypted: params.displayNameEncrypted,
                password_hash: params.passwordHash,
                password_set: params.passwordSet,
                role: params.role,
                status: "active",
                requires_password_reset: params.requiresPasswordReset || 0,
                created_at: params.createdAt,
                updated_at: params.updatedAt,
              };
              this.store.app_users[u.id] = u;
            } else if (compactQuery.includes("UPDATE app_users SET status = 'inactive'")) {
              const id = args[0];
              if (this.store.app_users[id]) {
                this.store.app_users[id].status = "inactive";
              }
            } else if (compactQuery.includes("UPDATE app_users SET status = 'active'")) {
              const id = args[0];
              if (this.store.app_users[id]) {
                this.store.app_users[id].status = "active";
              }
            } else if (compactQuery.includes("UPDATE app_users SET requires_password_reset")) {
              const id = args[0];
              if (this.store.app_users[id]) {
                this.store.app_users[id].requires_password_reset = 1;
              }
            } else if (compactQuery.includes("UPDATE app_users SET password_hash")) {
              const [passwordHash, updatedAt, id] = args;
              if (this.store.app_users[id]) {
                this.store.app_users[id].password_hash = passwordHash;
                this.store.app_users[id].password_set = 1;
                this.store.app_users[id].requires_password_reset = 0;
                this.store.app_users[id].updated_at = updatedAt;
              }
            }
            return { changes: 1 };
          }
        };
      }
    }
  };
});

describe("AuthStore User Management & Roles", () => {
  const store = createAuthStore("/tmp");

  it("should setup a master user and list it", () => {
    const master = store.setupMasterUser({
      username: "admin",
      password: "password123",
      displayName: "Master Admin"
    });

    expect(master).toBeDefined();
    expect(master.username).toBe("admin");
    expect(master.role).toBe("master");
    expect(master.status).toBe("active");
    expect(master.requiresPasswordReset).toBe(false);

    const users = store.listUsers();
    expect(users.length).toBe(1);
  });

  it("should create a cashier/caja user", () => {
    const cashier = store.createUser({
      username: "caja1",
      displayName: "Caja Principal",
      password: "cashierpassword",
      role: "caja"
    });

    expect(cashier).toBeDefined();
    expect(cashier.username).toBe("caja1");
    expect(cashier.role).toBe("caja");
    expect(cashier.status).toBe("active");
  });

  it("should deactivate user and fail sign in", () => {
    const cashier = store.createUser({
      username: "caja2",
      password: "somepassword",
      role: "caja"
    });

    store.deactivateUser(cashier.id);

    // Verify it throws error when attempting login
    expect(() => {
      store.signIn({ username: "caja2", password: "somepassword" });
    }).toThrow("Su cuenta ha sido dada de baja.");
  });

  it("should flag password reset for user", () => {
    const userToReset = store.createUser({
      username: "caja3",
      password: "initialpassword",
      role: "caja"
    });

    store.flagPasswordReset(userToReset.id);
    
    const users = store.listUsers();
    const updated = users.find(u => u.id === userToReset.id);
    expect(updated?.requiresPasswordReset).toBe(true);
  });

  it("should require initial password setup when user is created without password", () => {
    const operator = store.createUser({
      username: "caja4",
      password: "",
      role: "caja"
    });

    const state = store.getSignInState(operator.username);
    expect(state.exists).toBe(true);
    expect(state.hasPassword).toBe(false);
    expect(state.requiresPasswordReset).toBe(true);

    expect(() => {
      store.signIn({ username: "caja4", password: "any-pass" });
    }).toThrow("Debes configurar tu clave inicial desde la pantalla de acceso.");
  });

  it("should allow sign in after setting initial password", () => {
    store.setInitialPassword({
      username: "caja4",
      newPassword: "claveSegura123"
    });

    const signedIn = store.signIn({
      username: "caja4",
      password: "claveSegura123"
    });

    expect(signedIn.username).toBe("caja4");

    const state = store.getSignInState("caja4");
    expect(state.hasPassword).toBe(true);
    expect(state.requiresPasswordReset).toBe(false);
  });

  it("should reject invalid roles when creating users", () => {
    expect(() => {
      store.createUser({
        username: "qauser",
        password: "validpass123",
        role: "supervisor"
      });
    }).toThrow("Rol invalido.");
  });
});
