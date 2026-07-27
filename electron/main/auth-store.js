import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const PASSWORD_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 32;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function hashUsername(username) {
  return createHash("sha256").update(normalizeUsername(username)).digest("hex");
}

function isValidUsername(username) {
  return (
    username.length >= MIN_USERNAME_LENGTH &&
    username.length <= MAX_USERNAME_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}

function assertPasswordStrength(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }
}

function createPasswordHash(password) {
  assertPasswordStrength(password);

  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * 1024 * 1024,
  });

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64"),
    derivedKey.toString("base64"),
  ].join("$");
}

function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, saltBase64, hashBase64] = storedHash.split("$");

  if (
    !algorithm ||
    !n ||
    !r ||
    !p ||
    !saltBase64 ||
    !hashBase64 ||
    algorithm !== "scrypt"
  ) {
    return false;
  }

  const salt = Buffer.from(saltBase64, "base64");
  const expectedHash = Buffer.from(hashBase64, "base64");
  const computedHash = scryptSync(password, salt, expectedHash.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * 1024 * 1024,
  });

  if (computedHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(computedHash, expectedHash);
}

function getOrCreateEncryptionKey(filePath) {
  if (fs.existsSync(filePath)) {
    const encodedKey = fs.readFileSync(filePath, "utf8").trim();
    const key = Buffer.from(encodedKey, "base64");
    if (key.length === 32) {
      return key;
    }
  }

  const key = randomBytes(32);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, key.toString("base64"), { mode: 0o600 });
  return key;
}

function encryptText(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decryptText(value, key) {
  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

function toPublicUser(row, encryptionKey) {
  return {
    id: row.id,
    username: decryptText(row.username_encrypted, encryptionKey),
    displayName: decryptText(row.display_name_encrypted, encryptionKey),
    role: row.role,
    status: row.status,
    requiresPasswordReset: Boolean(row.requires_password_reset),
    createdAt: row.created_at,
  };
}

function validateSetupInput(input) {
  const username = input.username?.trim() ?? "";
  const displayNameRaw = input.displayName?.trim() ?? "";
  const password = input.password ?? "";

  if (!isValidUsername(username)) {
    throw new Error(
      "El usuario debe ser alfanumerico y puede incluir . _ - (3 a 32 caracteres).",
    );
  }

  const displayName = displayNameRaw || username;

  assertPasswordStrength(password);

  return {
    username,
    displayName,
    password,
  };
}

function validateSignInInput(input) {
  const username = input.username?.trim() ?? "";
  const password = input.password ?? "";

  if (!isValidUsername(username)) {
    throw new Error("Debes ingresar un usuario valido.");
  }

  if (!password) {
    throw new Error("Debes ingresar una contrasena.");
  }

  return {
    username,
    password,
  };
}

export function createAuthStore(userDataPath) {
  const dbPath = path.join(userDataPath, "rectificadora-app.sqlite");
  const keyPath = path.join(userDataPath, "rectificadora-app.key");
  const encryptionKey = getOrCreateEncryptionKey(keyPath);

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      username_hash TEXT NOT NULL UNIQUE,
      username_encrypted TEXT NOT NULL,
      display_name_encrypted TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_set INTEGER NOT NULL DEFAULT 1,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      requires_password_reset INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  try {
    db.exec("ALTER TABLE app_users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE app_users ADD COLUMN requires_password_reset INTEGER NOT NULL DEFAULT 0");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE app_users ADD COLUMN password_set INTEGER NOT NULL DEFAULT 1");
  } catch (e) {}

  const countUsersStmt = db.prepare("SELECT COUNT(1) AS total FROM app_users");

  const insertUserStmt = db.prepare(`
    INSERT INTO app_users (
      id,
      username_hash,
      username_encrypted,
      display_name_encrypted,
      password_hash,
      password_set,
      role,
      requires_password_reset,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @usernameHash,
      @usernameEncrypted,
      @displayNameEncrypted,
      @passwordHash,
      @passwordSet,
      @role,
      @requiresPasswordReset,
      @createdAt,
      @updatedAt
    )
  `);

  const findByUsernameHashStmt = db.prepare(
    "SELECT * FROM app_users WHERE username_hash = ?",
  );

  const findByIdStmt = db.prepare("SELECT * FROM app_users WHERE id = ?");

  return {
    getBootstrapState() {
      const row = countUsersStmt.get();
      const total = Number(row?.total ?? 0);
      return {
        hasMasterUser: total > 0,
      };
    },

    setupMasterUser(payload) {
      const row = countUsersStmt.get();
      const total = Number(row?.total ?? 0);
      if (total > 0) {
        throw new Error("Ya existe un usuario maestro configurado.");
      }

      const input = validateSetupInput(payload);
      const normalizedUsername = normalizeUsername(input.username);
      const usernameHash = hashUsername(normalizedUsername);

      const existingUser = findByUsernameHashStmt.get(usernameHash);
      if (existingUser) {
        throw new Error("Ya existe una cuenta con ese usuario.");
      }

      const now = new Date().toISOString();
      const userId = randomUUID();

      insertUserStmt.run({
        id: userId,
        usernameHash,
        usernameEncrypted: encryptText(normalizedUsername, encryptionKey),
        displayNameEncrypted: encryptText(input.displayName, encryptionKey),
        passwordHash: createPasswordHash(input.password),
        passwordSet: 1,
        role: "master",
        requiresPasswordReset: 0,
        createdAt: now,
        updatedAt: now,
      });

      const createdUser = findByIdStmt.get(userId);
      return toPublicUser(createdUser, encryptionKey);
    },

    signIn(payload) {
      const input = validateSignInInput(payload);
      const row = findByUsernameHashStmt.get(hashUsername(input.username));

      if (!row) {
        throw new Error("Credenciales invalidas.");
      }

      if (row.status === "inactive") {
        throw new Error("Su cuenta ha sido dada de baja.");
      }

      if (!row.password_set) {
        throw new Error("Debes configurar tu clave inicial desde la pantalla de acceso.");
      }

      const isPasswordValid = verifyPassword(input.password, row.password_hash);
      if (!isPasswordValid) {
        throw new Error("Credenciales invalidas.");
      }

      return toPublicUser(row, encryptionKey);
    },

    getUserById(userId) {
      const row = findByIdStmt.get(userId);
      if (!row) {
        return null;
      }

      return toPublicUser(row, encryptionKey);
    },

    listUsers() {
      const rows = db.prepare("SELECT * FROM app_users").all();
      return rows.map((r) => toPublicUser(r, encryptionKey));
    },

    getSignInState(username) {
      const normalizedUsername = normalizeUsername(username);
      const row = findByUsernameHashStmt.get(hashUsername(normalizedUsername));

      if (!row) {
        return {
          exists: false,
          hasPassword: false,
          isActive: false,
          requiresPasswordReset: false,
        };
      }

      return {
        exists: true,
        hasPassword: Boolean(row.password_set),
        isActive: row.status !== "inactive",
        requiresPasswordReset: Boolean(row.requires_password_reset),
      };
    },

    setInitialPassword(payload) {
      const username = payload.username?.trim() ?? "";
      const newPassword = payload.newPassword ?? "";

      if (!isValidUsername(username)) {
        throw new Error("Debes ingresar un usuario valido.");
      }

      assertPasswordStrength(newPassword);

      const usernameHash = hashUsername(username);
      const row = findByUsernameHashStmt.get(usernameHash);

      if (!row) {
        throw new Error("Usuario no encontrado.");
      }

      if (row.status === "inactive") {
        throw new Error("Su cuenta ha sido dada de baja.");
      }

      if (row.password_set) {
        throw new Error("Este usuario ya tiene una clave configurada.");
      }

      const passwordHash = createPasswordHash(newPassword);
      db.prepare(
        "UPDATE app_users SET password_hash = ?, password_set = 1, requires_password_reset = 0, updated_at = ? WHERE id = ?",
      ).run(passwordHash, new Date().toISOString(), row.id);

      const updated = findByIdStmt.get(row.id);
      return toPublicUser(updated, encryptionKey);
    },

    createUser(payload) {
      const username = payload.username?.trim() ?? "";
      const displayName = payload.displayName?.trim() ?? "";
      const password = payload.password ?? "";
      const role = payload.role ?? "caja";

      if (!isValidUsername(username)) {
        throw new Error("El usuario debe ser alfanumérico y tener entre 3 y 32 caracteres.");
      }

      if (role !== "administrador" && role !== "caja") {
        throw new Error("Rol invalido.");
      }

      const normalizedUsername = normalizeUsername(username);
      const usernameHash = hashUsername(normalizedUsername);

      const existingUser = findByUsernameHashStmt.get(usernameHash);
      if (existingUser) {
        throw new Error("Ya existe una cuenta con ese usuario.");
      }

      const now = new Date().toISOString();
      const userId = randomUUID();
      const hasInitialPassword = typeof password === "string" && password.trim().length > 0;
      const passwordHash = hasInitialPassword
        ? createPasswordHash(password)
        : createPasswordHash(`${randomUUID()}-${randomBytes(16).toString("hex")}`);

      insertUserStmt.run({
        id: userId,
        usernameHash,
        usernameEncrypted: encryptText(normalizedUsername, encryptionKey),
        displayNameEncrypted: encryptText(displayName || normalizedUsername, encryptionKey),
        passwordHash,
        passwordSet: hasInitialPassword ? 1 : 0,
        role,
        requiresPasswordReset: hasInitialPassword ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      });

      const created = findByIdStmt.get(userId);
      return toPublicUser(created, encryptionKey);
    },

    deactivateUser(userId) {
      db.prepare("UPDATE app_users SET status = 'inactive' WHERE id = ?").run(userId);
      return true;
    },

    flagPasswordReset(userId) {
      db.prepare("UPDATE app_users SET requires_password_reset = 1 WHERE id = ?").run(userId);
      return true;
    },

    forceResetPassword(userId, newPassword) {
      assertPasswordStrength(newPassword);
      const newHash = createPasswordHash(newPassword);
      db.prepare("UPDATE app_users SET password_hash = ?, password_set = 1, requires_password_reset = 0, updated_at = ? WHERE id = ?").run(newHash, new Date().toISOString(), userId);
      return true;
    },

    restoreUser(userId) {
      db.prepare("UPDATE app_users SET status = 'active' WHERE id = ?").run(userId);
      return true;
    },
  };
}
