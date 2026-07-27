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
        return {
          all: () => {
            return Object.values(this.store.app_users);
          },
          get: (param) => {
            if (query.includes("COUNT")) {
              return { total: Object.keys(this.store.app_users).length };
            }
            // Simple match logic
            const values = Object.values(this.store.app_users);
            if (query.includes("username_hash")) {
              return values.find(u => u.username_hash === param) || null;
            }
            if (query.includes("id = ?")) {
              return values.find(u => u.id === param) || null;
            }
            return null;
          },
          run: (params) => {
            if (query.includes("INSERT INTO app_users")) {
              const u = {
                id: params.id,
                username_hash: params.usernameHash,
                username_encrypted: params.usernameEncrypted,
                display_name_encrypted: params.displayNameEncrypted,
                password_hash: params.passwordHash,
                role: params.role,
                status: "active",
                requires_password_reset: 0,
                created_at: params.createdAt,
                updated_at: params.updatedAt,
              };
              this.store.app_users[u.id] = u;
            } else if (query.includes("UPDATE app_users SET status")) {
              const id = params; // direct param
              if (this.store.app_users[id]) {
                this.store.app_users[id].status = "inactive";
              }
            } else if (query.includes("UPDATE app_users SET requires_password_reset")) {
              const id = params; // direct param
              if (this.store.app_users[id]) {
                this.store.app_users[id].requires_password_reset = 1;
              }
            } else if (query.includes("UPDATE app_users SET password_hash")) {
              // Simulating key/val updates
              const values = Object.values(this.store.app_users);
              if (values.length > 0) {
                values[0].requires_password_reset = 0;
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
});
