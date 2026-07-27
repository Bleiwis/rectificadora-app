import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db;

const ORDER_CODE_MAX_VALUE = 9999;
const DEFAULT_LAN_CONFIG = {
  mode: "standalone",
  host: "127.0.0.1",
  port: 4510,
  token: "",
};

function sanitizeOrderCodePrefix(rawValue) {
  const sanitized = String(rawValue || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

  return sanitized || null;
}

function deriveOrderCodePrefixFromInstallationId(installationId) {
  const compact = String(installationId || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!compact) {
    return "PC0";
  }

  const suffix = compact.slice(-3);
  return suffix.padStart(3, "0");
}

function resolveOrderCodePrefix(database) {
  const fromEnv = sanitizeOrderCodePrefix(process.env.ORDER_CODE_PREFIX);
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const licenseRow = database
      .prepare("SELECT installationId FROM license_state WHERE id = 1")
      .get();
    return deriveOrderCodePrefixFromInstallationId(licenseRow?.installationId);
  } catch {
    return "PC0";
  }
}

function formatOrderCode(prefix, sequenceValue) {
  return String(sequenceValue).padStart(4, "0");
}

function parseClientDocument(rawValue) {
  const value = String(rawValue || "").trim().toUpperCase();
  if (!value) return null;

  const matched = value.match(/^([VJ])[-\s]?([0-9]+)$/);
  if (!matched) return null;

  const docType = matched[1];
  const docNumber = matched[2];
  return {
    docType,
    docNumber,
    docNormalized: `${docType}-${docNumber}`,
  };
}

function normalizeClientDocument(input) {
  if (input?.docNormalized) {
    return parseClientDocument(input.docNormalized);
  }

  const docType = String(input?.docType || "").toUpperCase();
  const docNumber = String(input?.docNumber || "").replace(/\D/g, "");
  if ((docType !== "V" && docType !== "J") || !docNumber) {
    return null;
  }

  return {
    docType,
    docNumber,
    docNormalized: `${docType}-${docNumber}`,
  };
}

function buildClientFromOrder(order) {
  const doc = parseClientDocument(order?.clientCI);
  if (!doc) return null;

  return {
    ...doc,
    firstName: order.clientName || "",
    lastName: order.clientLastName || "",
    phone: order.clientPhone || "",
    address: order.clientAddress || "",
  };
}

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function derivePaymentSummary(order) {
  const totalUSD = roundCurrency(order?.totalUSD);
  const explicitPaidUSD = Number(order?.paidUSD);
  const fallbackPaidUSD =
    order?.paymentStatus === "Paga"
      ? totalUSD
      : order?.paymentStatus === "Abonada"
        ? Math.max(0, Number(order?.paidUSD || 0))
        : 0;

  const boundedPaidUSD = Math.max(
    0,
    Math.min(totalUSD, roundCurrency(Number.isFinite(explicitPaidUSD) ? explicitPaidUSD : fallbackPaidUSD)),
  );
  const balanceUSD = roundCurrency(Math.max(0, totalUSD - boundedPaidUSD));

  const paymentStatus =
    balanceUSD <= 0
      ? "Paga"
      : boundedPaidUSD > 0
        ? "Abonada"
        : "Pendiente por cobrar";

  return {
    paidUSD: boundedPaidUSD,
    balanceUSD,
    paymentStatus,
  };
}

function normalizePartQuantity(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function getPartDisplayName(part) {
  const base = String(part?.partName || "").trim();
  if (base === "Otro (Escribir abajo)") {
    return String(part?.customName || "Otro").trim() || "Otro";
  }
  return base || "Parte";
}

function getDeliveredByPartIndex(database, orderId) {
  const rows = database
    .prepare(`
      SELECT partIndex, COALESCE(SUM(quantity), 0) AS deliveredQty
      FROM order_part_deliveries
      WHERE orderId = ?
      GROUP BY partIndex
    `)
    .all(orderId);

  const delivered = new Map();
  rows.forEach((row) => {
    delivered.set(Number(row.partIndex), normalizePartQuantity(row.deliveredQty));
  });
  return delivered;
}

function deriveOrderStatusFromParts(parts, deliveredByPartIndex) {
  let admittedTotal = 0;
  let deliveredTotal = 0;

  (Array.isArray(parts) ? parts : []).forEach((part, partIndex) => {
    const admitted = normalizePartQuantity(part?.quantity);
    const delivered = normalizePartQuantity(deliveredByPartIndex.get(partIndex) || 0);
    admittedTotal += admitted;
    deliveredTotal += Math.min(admitted, delivered);
  });

  if (admittedTotal <= 0 || deliveredTotal <= 0) {
    return "Ingresado";
  }
  if (deliveredTotal >= admittedTotal) {
    return "Retirado";
  }
  return "Parcialmente retirado";
}

export function initDatabase(dbPath) {
  if (db) return db;

  let finalPath = dbPath;

  if (!finalPath) {
    try {
      // Try to get Electron app context
      const { app } = require("electron");
      const userDataPath = app.getPath("userData");
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      finalPath = path.join(userDataPath, "rectificadora.db");
    } catch (err) {
      // Fallback for testing environment (Vitest)
      finalPath = path.join(process.cwd(), "rectificadora_test.db");
    }
  }

  db = new Database(finalPath);

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priceUSD REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      priceUSD REAL NOT NULL,
      quantity INTEGER NOT NULL,
      minStock INTEGER NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      docType TEXT NOT NULL,
      docNumber TEXT NOT NULL,
      docNormalized TEXT NOT NULL UNIQUE,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      address TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      displayName TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      requiresPasswordReset INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      clientId TEXT,
      clientName TEXT NOT NULL,
      clientLastName TEXT NOT NULL,
      clientCI TEXT NOT NULL,
      clientPhone TEXT NOT NULL,
      clientAddress TEXT,
      engineModel TEXT NOT NULL,
      parts TEXT NOT NULL, -- JSON Stringified array of PartRow
      services TEXT NOT NULL, -- JSON Stringified array of ServiceSelection
      inventoryItems TEXT, -- JSON Stringified array of InventoryItem selections
      totalUSD REAL NOT NULL,
      totalVES REAL NOT NULL,
      paidUSD REAL NOT NULL DEFAULT 0,
      balanceUSD REAL NOT NULL DEFAULT 0,
      entryDate TEXT NOT NULL,
      deliveryDays INTEGER NOT NULL,
      tentativeDeliveryDate TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      orderStatus TEXT NOT NULL DEFAULT 'Ingresado',
      cancelReason TEXT,
      canceledAt TEXT,
      canceledBy TEXT,
      canceledByUserId TEXT,
      priority TEXT NOT NULL,
      responsible TEXT,
      createdBy TEXT NOT NULL,
      createdByUserId TEXT,
      FOREIGN KEY (clientId) REFERENCES clients(id),
      FOREIGN KEY (createdByUserId) REFERENCES app_users(id)
    );

    CREATE TABLE IF NOT EXISTS order_payments (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      paidAt TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      paidUSD REAL NOT NULL,
      paidVES REAL,
      exchangeRate REAL,
      note TEXT,
      createdBy TEXT,
      createdByUserId TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (createdByUserId) REFERENCES app_users(id)
    );

    CREATE TABLE IF NOT EXISTS order_part_deliveries (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      partIndex INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      note TEXT,
      deliveredAt TEXT NOT NULL,
      createdBy TEXT,
      createdByUserId TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (createdByUserId) REFERENCES app_users(id)
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
      entity TEXT NOT NULL, -- 'orders', 'inventory', 'services'
      entityId TEXT NOT NULL,
      payload TEXT,         -- JSON Stringified payload
      attempts INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending', -- 'pending', 'failed', 'synced'
      error TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bcv_usd_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      valueUsdRaw TEXT NOT NULL,
      valueUsd REAL NOT NULL,
      valueDateLabel TEXT NOT NULL,
      valueDateISO TEXT NOT NULL,
      sourceUrl TEXT NOT NULL,
      isStale INTEGER NOT NULL DEFAULT 0,
      fetchedAt TEXT NOT NULL,
      rawPayload TEXT
    );

    CREATE TABLE IF NOT EXISTS order_sequence_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      prefix TEXT NOT NULL,
      nextValue INTEGER NOT NULL DEFAULT 1,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_runtime_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_client_ci ON orders(clientCI);
    CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(orderId);
    CREATE INDEX IF NOT EXISTS idx_order_payments_paid_at ON order_payments(paidAt);
    CREATE INDEX IF NOT EXISTS idx_order_part_deliveries_order_id ON order_part_deliveries(orderId);
    CREATE INDEX IF NOT EXISTS idx_order_part_deliveries_order_part ON order_part_deliveries(orderId, partIndex);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bcv_usd_rates_value_date_iso ON bcv_usd_rates(valueDateISO);
  `);

  // Migrate columns for older services tables if they don't exist
  try {
    db.exec("ALTER TABLE services ADD COLUMN category TEXT NOT NULL DEFAULT 'Otros'");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE services ADD COLUMN description TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN inventoryItems TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN clientId TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN createdByUserId TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN paidUSD REAL NOT NULL DEFAULT 0");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN balanceUSD REAL NOT NULL DEFAULT 0");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN orderStatus TEXT NOT NULL DEFAULT 'Ingresado'");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN cancelReason TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN canceledAt TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN canceledBy TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE orders ADD COLUMN canceledByUserId TEXT");
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec("UPDATE orders SET paidUSD = CASE WHEN paymentStatus = 'Paga' THEN totalUSD ELSE 0 END WHERE paidUSD IS NULL OR paidUSD < 0");
    db.exec("UPDATE orders SET balanceUSD = CASE WHEN paymentStatus = 'Paga' THEN 0 ELSE totalUSD END WHERE balanceUSD IS NULL OR balanceUSD < 0");
  } catch (e) {
    // Best effort normalization for legacy rows
  }

  // Create indexes that depend on migrated columns only after ALTER TABLE runs.
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(clientId)");
  } catch (e) {
    // Keep startup resilient on legacy/corrupted local dbs
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_created_by_user_id ON orders(createdByUserId)");
  } catch (e) {
    // Keep startup resilient on legacy/corrupted local dbs
  }

  try {
    const existingSequenceState = db
      .prepare("SELECT id FROM order_sequence_state WHERE id = 1")
      .get();
    if (!existingSequenceState) {
      const now = new Date().toISOString();
      const prefix = resolveOrderCodePrefix(db);
      db.prepare(
        "INSERT INTO order_sequence_state (id, prefix, nextValue, updatedAt) VALUES (1, ?, 1, ?)",
      ).run(prefix, now);
    }
  } catch (e) {
    // Best effort setup for order code sequence state
  }

  try {
    const now = new Date().toISOString();
    const defaults = [
      ["lan_mode", DEFAULT_LAN_CONFIG.mode],
      ["lan_host", DEFAULT_LAN_CONFIG.host],
      ["lan_port", String(DEFAULT_LAN_CONFIG.port)],
      ["lan_token", DEFAULT_LAN_CONFIG.token],
    ];
    const upsert = db.prepare(`
      INSERT INTO app_runtime_config (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO NOTHING
    `);
    defaults.forEach(([key, value]) => upsert.run(key, value, now));
  } catch (e) {
    // Best effort defaults for runtime config
  }

  try {
    const legacyOrders = db
      .prepare("SELECT id, clientId, clientCI, clientName, clientLastName, clientPhone, clientAddress FROM orders")
      .all();
    const setClientIdStmt = db.prepare("UPDATE orders SET clientId = ? WHERE id = ?");
    const upsertClientStmt = db.prepare(`
      INSERT INTO clients (id, docType, docNumber, docNormalized, firstName, lastName, phone, address, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(docNormalized) DO UPDATE SET
        firstName = excluded.firstName,
        lastName = excluded.lastName,
        phone = excluded.phone,
        address = excluded.address,
        updatedAt = excluded.updatedAt
    `);
    const findClientStmt = db.prepare("SELECT id FROM clients WHERE docNormalized = ?");

    for (const order of legacyOrders) {
      if (order.clientId) continue;

      const parsed = parseClientDocument(order.clientCI);
      if (!parsed) continue;

      const now = new Date().toISOString();
      const existing = findClientStmt.get(parsed.docNormalized);
      const clientId = existing?.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      upsertClientStmt.run(
        clientId,
        parsed.docType,
        parsed.docNumber,
        parsed.docNormalized,
        order.clientName || "",
        order.clientLastName || "",
        order.clientPhone || "",
        order.clientAddress || "",
        now,
        now,
      );

      setClientIdStmt.run(clientId, order.id);
    }
  } catch (e) {
    // Best effort backfill for legacy data
  }

  return db;
}

export function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// ----------------- CLIENTS REPOSITORY -----------------
export const clientsRepo = {
  getAll: () => {
    return getDb().prepare("SELECT * FROM clients ORDER BY updatedAt DESC").all();
  },
  findByDocument: (docNormalized) => {
    const parsed = parseClientDocument(docNormalized);
    if (!parsed) return null;
    return getDb().prepare("SELECT * FROM clients WHERE docNormalized = ?").get(parsed.docNormalized) || null;
  },
  upsert: (input) => {
    const normalized = normalizeClientDocument(input);
    if (!normalized) {
      throw new Error("Documento del cliente invalido. Usa formato V-12345678 o J-123456789.");
    }

    const database = getDb();
    const now = new Date().toISOString();
    const existing = database
      .prepare("SELECT id FROM clients WHERE docNormalized = ?")
      .get(normalized.docNormalized);

    const clientId = existing?.id || input.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    database.prepare(`
      INSERT INTO clients (id, docType, docNumber, docNormalized, firstName, lastName, phone, address, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(docNormalized) DO UPDATE SET
        firstName = excluded.firstName,
        lastName = excluded.lastName,
        phone = excluded.phone,
        address = excluded.address,
        updatedAt = excluded.updatedAt
    `).run(
      clientId,
      normalized.docType,
      normalized.docNumber,
      normalized.docNormalized,
      input.firstName || "",
      input.lastName || "",
      input.phone || "",
      input.address || "",
      now,
      now,
    );

    const updated = database.prepare("SELECT * FROM clients WHERE docNormalized = ?").get(normalized.docNormalized);
    outboxRepo.queue(existing ? "UPDATE" : "INSERT", "clients", updated.id, updated);
    return updated;
  },
};

// ----------------- USERS REPOSITORY (MIRROR FROM AUTH) -----------------
export const usersRepo = {
  getAll: () => {
    return getDb().prepare("SELECT * FROM app_users ORDER BY updatedAt DESC").all();
  },
  findById: (id) => {
    return getDb().prepare("SELECT * FROM app_users WHERE id = ?").get(id) || null;
  },
  upsertFromAuthUser: (authUser) => {
    if (!authUser?.id) {
      throw new Error("Usuario invalido para sincronizacion.");
    }

    const database = getDb();
    const existing = usersRepo.findById(authUser.id);
    const nextRow = {
      id: authUser.id,
      username: authUser.username || "",
      displayName: authUser.displayName || authUser.username || "",
      role: authUser.role || "caja",
      status: authUser.status || "active",
      requiresPasswordReset: authUser.requiresPasswordReset ? 1 : 0,
      createdAt: authUser.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      const changed =
        existing.username !== nextRow.username ||
        existing.displayName !== nextRow.displayName ||
        existing.role !== nextRow.role ||
        existing.status !== nextRow.status ||
        Number(existing.requiresPasswordReset) !== Number(nextRow.requiresPasswordReset);

      if (!changed) {
        return existing;
      }

      database.prepare(`
        UPDATE app_users
        SET username = ?, displayName = ?, role = ?, status = ?, requiresPasswordReset = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        nextRow.username,
        nextRow.displayName,
        nextRow.role,
        nextRow.status,
        nextRow.requiresPasswordReset,
        nextRow.updatedAt,
        nextRow.id,
      );

      const updated = usersRepo.findById(nextRow.id);
      outboxRepo.queue("UPDATE", "app_users", updated.id, updated);
      return updated;
    }

    database.prepare(`
      INSERT INTO app_users (id, username, displayName, role, status, requiresPasswordReset, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nextRow.id,
      nextRow.username,
      nextRow.displayName,
      nextRow.role,
      nextRow.status,
      nextRow.requiresPasswordReset,
      nextRow.createdAt,
      nextRow.updatedAt,
    );

    const inserted = usersRepo.findById(nextRow.id);
    outboxRepo.queue("INSERT", "app_users", inserted.id, inserted);
    return inserted;
  },
};

// ----------------- SERVICES REPOSITORY -----------------
export const servicesRepo = {
  getAll: () => {
    return getDb().prepare("SELECT * FROM services").all();
  },
  save: (service) => {
    const database = getDb();
    const existing = database.prepare("SELECT id FROM services WHERE id = ?").get(service.id);
    
    if (existing) {
      database.prepare("UPDATE services SET name = ?, category = ?, description = ?, priceUSD = ? WHERE id = ?").run(
        service.name,
        service.category,
        service.description || "",
        service.priceUSD,
        service.id
      );
      // Queue outbox operation
      outboxRepo.queue("UPDATE", "services", service.id, service);
    } else {
      database.prepare("INSERT INTO services (id, name, category, description, priceUSD) VALUES (?, ?, ?, ?, ?)").run(
        service.id,
        service.name,
        service.category,
        service.description || "",
        service.priceUSD
      );
      // Queue outbox operation
      outboxRepo.queue("INSERT", "services", service.id, service);
    }
  },
  delete: (id) => {
    getDb().prepare("DELETE FROM services WHERE id = ?").run(id);
    outboxRepo.queue("DELETE", "services", id, { id });
  }
};

// ----------------- INVENTORY REPOSITORY -----------------
export const inventoryRepo = {
  getAll: () => {
    return getDb().prepare("SELECT * FROM inventory").all();
  },
  save: (item) => {
    const database = getDb();
    const existing = database.prepare("SELECT id FROM inventory WHERE id = ?").get(item.id);
    
    if (existing) {
      database.prepare(`
        UPDATE inventory 
        SET name = ?, category = ?, priceUSD = ?, quantity = ?, minStock = ?, description = ? 
        WHERE id = ?
      `).run(
        item.name,
        item.category,
        item.priceUSD,
        item.quantity,
        item.minStock,
        item.description,
        item.id
      );
      outboxRepo.queue("UPDATE", "inventory", item.id, item);
    } else {
      database.prepare(`
        INSERT INTO inventory (id, name, category, priceUSD, quantity, minStock, description) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.name,
        item.category,
        item.priceUSD,
        item.quantity,
        item.minStock,
        item.description
      );
      outboxRepo.queue("INSERT", "inventory", item.id, item);
    }
  },
  delete: (id) => {
    getDb().prepare("DELETE FROM inventory WHERE id = ?").run(id);
    outboxRepo.queue("DELETE", "inventory", id, { id });
  }
};

// ----------------- APP RUNTIME CONFIG REPOSITORY -----------------
export const runtimeConfigRepo = {
  getLanConfig: () => {
    const rows = getDb()
      .prepare("SELECT key, value FROM app_runtime_config WHERE key IN ('lan_mode', 'lan_host', 'lan_port', 'lan_token')")
      .all();

    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const mode = String(byKey.get("lan_mode") || DEFAULT_LAN_CONFIG.mode);
    const host = String(byKey.get("lan_host") || DEFAULT_LAN_CONFIG.host);
    const port = Number(byKey.get("lan_port") || DEFAULT_LAN_CONFIG.port);
    const token = String(byKey.get("lan_token") || DEFAULT_LAN_CONFIG.token);

    return {
      mode: mode === "server" || mode === "client" ? mode : "standalone",
      host,
      port: Number.isFinite(port) && port > 0 ? port : DEFAULT_LAN_CONFIG.port,
      token,
    };
  },
  saveLanConfig: (input) => {
    const next = {
      mode:
        input?.mode === "server" || input?.mode === "client"
          ? input.mode
          : "standalone",
      host: String(input?.host || DEFAULT_LAN_CONFIG.host).trim() || DEFAULT_LAN_CONFIG.host,
      port:
        Number.isFinite(Number(input?.port)) && Number(input?.port) > 0
          ? Number(input.port)
          : DEFAULT_LAN_CONFIG.port,
      token: String(input?.token || "").trim(),
    };

    const now = new Date().toISOString();
    const upsert = getDb().prepare(`
      INSERT INTO app_runtime_config (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `);

    upsert.run("lan_mode", next.mode, now);
    upsert.run("lan_host", next.host, now);
    upsert.run("lan_port", String(next.port), now);
    upsert.run("lan_token", next.token, now);
    return next;
  },
};

// ----------------- ORDER CODE REPOSITORY -----------------
export const orderCodeRepo = {
  getNextCode: () => {
    const database = getDb();
    const row = database
      .prepare("SELECT prefix, nextValue FROM order_sequence_state WHERE id = 1")
      .get();

    if (!row) {
      const now = new Date().toISOString();
      const prefix = resolveOrderCodePrefix(database);
      database
        .prepare(
          "INSERT INTO order_sequence_state (id, prefix, nextValue, updatedAt) VALUES (1, ?, 1, ?)",
        )
        .run(prefix, now);
      return formatOrderCode(prefix, 1);
    }

    return formatOrderCode(row.prefix, Number(row.nextValue) || 1);
  },
  reserveNextCode: () => {
    const database = getDb();
    const reserveTx = database.transaction(() => {
      const row = database
        .prepare("SELECT prefix, nextValue FROM order_sequence_state WHERE id = 1")
        .get();

      if (!row) {
        const now = new Date().toISOString();
        const prefix = resolveOrderCodePrefix(database);
        database
          .prepare(
            "INSERT INTO order_sequence_state (id, prefix, nextValue, updatedAt) VALUES (1, ?, 2, ?)",
          )
          .run(prefix, now);
        return formatOrderCode(prefix, 1);
      }

      const nextValue = Number(row.nextValue) || 1;
      if (nextValue > ORDER_CODE_MAX_VALUE) {
        throw new Error(
          `Se alcanzo el limite de consecutivos (${ORDER_CODE_MAX_VALUE}) para este equipo.`,
        );
      }

      const code = formatOrderCode(row.prefix, nextValue);
      database
        .prepare("UPDATE order_sequence_state SET nextValue = ?, updatedAt = ? WHERE id = 1")
        .run(nextValue + 1, new Date().toISOString());

      return code;
    });

    return reserveTx();
  },
};

// ----------------- ORDERS REPOSITORY -----------------
export const ordersRepo = {
  getById: (id) => {
    const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!row) return null;
    const summary = derivePaymentSummary(row);
    return {
      ...row,
      parts: JSON.parse(row.parts),
      services: JSON.parse(row.services),
      inventoryItems: row.inventoryItems ? JSON.parse(row.inventoryItems) : [],
      paidUSD: summary.paidUSD,
      balanceUSD: summary.balanceUSD,
      paymentStatus: summary.paymentStatus,
      orderStatus: row.orderStatus || "Ingresado",
    };
  },
  getAll: () => {
    const raw = getDb().prepare("SELECT * FROM orders").all();
    return raw.map(o => ({
      ...o,
      parts: JSON.parse(o.parts),
      services: JSON.parse(o.services),
      inventoryItems: o.inventoryItems ? JSON.parse(o.inventoryItems) : [],
      paidUSD: derivePaymentSummary(o).paidUSD,
      balanceUSD: derivePaymentSummary(o).balanceUSD,
      paymentStatus: derivePaymentSummary(o).paymentStatus,
      orderStatus: o.orderStatus || "Ingresado",
    }));
  },
  save: (order) => {
    const database = getDb();
    const existing = database
      .prepare("SELECT id, code, orderStatus FROM orders WHERE id = ?")
      .get(order.id);
    if (existing?.orderStatus === "Cancelada") {
      throw new Error("La orden esta cancelada y no puede modificarse.");
    }
    const orderClient = buildClientFromOrder(order);
    const linkedClient = orderClient ? clientsRepo.upsert(orderClient) : null;
    
    const partsJson = JSON.stringify(order.parts);
    const servicesJson = JSON.stringify(order.services);
    const inventoryItemsJson = JSON.stringify(order.inventoryItems || []);
    const paymentSummary = derivePaymentSummary(order);
    const orderCode = order.code || existing?.code || orderCodeRepo.reserveNextCode();

    if (existing) {
      database.prepare(`
        UPDATE orders 
        SET code = ?, clientId = ?, clientName = ?, clientLastName = ?, clientCI = ?, clientPhone = ?, 
            clientAddress = ?, engineModel = ?, parts = ?, services = ?, inventoryItems = ?, totalUSD = ?, totalVES = ?, paidUSD = ?, balanceUSD = ?,
          entryDate = ?, deliveryDays = ?, tentativeDeliveryDate = ?, paymentStatus = ?, orderStatus = ?, cancelReason = ?, canceledAt = ?, canceledBy = ?, canceledByUserId = ?, priority = ?, 
            responsible = ?, createdBy = ?, createdByUserId = ?
        WHERE id = ?
      `).run(
        orderCode,
        order.clientId || linkedClient?.id || null,
        order.clientName,
        order.clientLastName,
        orderClient?.docNormalized || order.clientCI,
        order.clientPhone,
        order.clientAddress,
        order.engineModel,
        partsJson,
        servicesJson,
        inventoryItemsJson,
        order.totalUSD,
        order.totalVES,
        paymentSummary.paidUSD,
        paymentSummary.balanceUSD,
        order.entryDate,
        order.deliveryDays,
        order.tentativeDeliveryDate,
        paymentSummary.paymentStatus,
        order.orderStatus || "Ingresado",
        order.cancelReason || null,
        order.canceledAt || null,
        order.canceledBy || null,
        order.canceledByUserId || null,
        order.priority,
        order.responsible || "",
        order.createdBy,
        order.createdByUserId || null,
        order.id
      );
      outboxRepo.queue("UPDATE", "orders", order.id, order);
    } else {
      database.prepare(`
        INSERT INTO orders (
          id, code, clientId, clientName, clientLastName, clientCI, clientPhone, clientAddress, 
          engineModel, parts, services, inventoryItems, totalUSD, totalVES, paidUSD, balanceUSD, entryDate, deliveryDays, 
          tentativeDeliveryDate, paymentStatus, orderStatus, cancelReason, canceledAt, canceledBy, canceledByUserId, priority, responsible, createdBy, createdByUserId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id,
        orderCode,
        order.clientId || linkedClient?.id || null,
        order.clientName,
        order.clientLastName,
        orderClient?.docNormalized || order.clientCI,
        order.clientPhone,
        order.clientAddress || "",
        order.engineModel,
        partsJson,
        servicesJson,
        inventoryItemsJson,
        order.totalUSD,
        order.totalVES,
        paymentSummary.paidUSD,
        paymentSummary.balanceUSD,
        order.entryDate,
        order.deliveryDays,
        order.tentativeDeliveryDate,
        paymentSummary.paymentStatus,
        order.orderStatus || "Ingresado",
        order.cancelReason || null,
        order.canceledAt || null,
        order.canceledBy || null,
        order.canceledByUserId || null,
        order.priority,
        order.responsible || "",
        order.createdBy,
        order.createdByUserId || null
      );
      outboxRepo.queue("INSERT", "orders", order.id, order);

      if (paymentSummary.paidUSD > 0 && order.initialPayment) {
        orderPaymentsRepo.addPayment(order.id, {
          ...order.initialPayment,
          paidAt: order.initialPayment.paidAt || new Date().toISOString(),
          createdBy: order.initialPayment.createdBy || order.createdBy,
          createdByUserId:
            order.initialPayment.createdByUserId || order.createdByUserId || null,
        });
      }
    }
  },
  createWithInventoryDeduction: (order) => {
    const database = getDb();
    const tx = database.transaction(() => {
      const requestedItems = Array.isArray(order?.inventoryItems)
        ? order.inventoryItems
        : [];

      requestedItems.forEach((selectedItem) => {
        const quantity = Math.max(0, Math.floor(Number(selectedItem?.quantity) || 0));
        if (quantity <= 0) {
          return;
        }

        const item = database
          .prepare("SELECT * FROM inventory WHERE id = ?")
          .get(selectedItem.id);

        if (!item) {
          throw new Error(`El repuesto '${selectedItem.id}' no existe en inventario.`);
        }

        if (Number(item.quantity) < quantity) {
          throw new Error(
            `Inventario insuficiente para '${item.name}'. Disponible: ${item.quantity}.`,
          );
        }

        const nextQuantity = Number(item.quantity) - quantity;
        database
          .prepare("UPDATE inventory SET quantity = ? WHERE id = ?")
          .run(nextQuantity, item.id);

        outboxRepo.queue("UPDATE", "inventory", item.id, {
          ...item,
          quantity: nextQuantity,
        });
      });

      ordersRepo.save(order);
    });

    tx();
    return ordersRepo.getById(order.id);
  },
  delete: (id) => {
    getDb().prepare("DELETE FROM orders WHERE id = ?").run(id);
    outboxRepo.queue("DELETE", "orders", id, { id });
  },
  cancel: (id, payload) => {
    const database = getDb();
    const existing = ordersRepo.getById(id);
    if (!existing) {
      throw new Error("Pedido no encontrado.");
    }
    if ((existing.orderStatus || "Ingresado") === "Cancelada") {
      throw new Error("La orden ya fue cancelada.");
    }

    const reason = String(payload?.reason || "").trim();
    if (!reason) {
      throw new Error("Debes indicar el motivo de cancelacion.");
    }

    const canceledAt = payload?.canceledAt || new Date().toISOString();
    const canceledBy = payload?.canceledBy || null;
    const canceledByUserId = payload?.canceledByUserId || null;

    database.prepare(`
      UPDATE orders
      SET orderStatus = 'Cancelada',
          cancelReason = ?,
          canceledAt = ?,
          canceledBy = ?,
          canceledByUserId = ?
      WHERE id = ?
    `).run(reason, canceledAt, canceledBy, canceledByUserId, id);

    const updated = ordersRepo.getById(id);
    outboxRepo.queue("UPDATE", "orders", id, updated);
    return updated;
  }
};

// ----------------- ORDER PAYMENTS REPOSITORY -----------------
export const orderPaymentsRepo = {
  getByOrderId: (orderId) => {
    return getDb()
      .prepare("SELECT * FROM order_payments WHERE orderId = ? ORDER BY paidAt ASC")
      .all(orderId);
  },
  addPayment: (orderId, paymentInput) => {
    const database = getDb();
    const order = ordersRepo.getById(orderId);
    if (!order) {
      throw new Error("Pedido no encontrado para registrar pago.");
    }
    if ((order.orderStatus || "Ingresado") === "Cancelada") {
      throw new Error("La orden esta cancelada y no permite registrar pagos.");
    }

    const currency = String(paymentInput?.currency || "").toUpperCase();
    if (currency !== "USD" && currency !== "VES") {
      throw new Error("Moneda de pago inválida. Usa USD o VES.");
    }

    const amount = roundCurrency(paymentInput?.amount);
    if (amount <= 0) {
      throw new Error("El monto del pago debe ser mayor a cero.");
    }

    const exchangeRate = Number(paymentInput?.exchangeRate || 0);
    if (currency === "VES" && exchangeRate <= 0) {
      throw new Error("Debes indicar una tasa BCV válida para pagos en bolívares.");
    }

    const paidUSD =
      currency === "USD"
        ? amount
        : roundCurrency(amount / exchangeRate);
    const paidVES =
      currency === "VES"
        ? amount
        : paymentInput?.paidVES
          ? roundCurrency(paymentInput.paidVES)
          : null;

    if (paidUSD <= 0) {
      throw new Error("El pago no genera equivalencia válida en USD.");
    }

    const nextPaidUSD = roundCurrency(Math.min(order.totalUSD, Number(order.paidUSD || 0) + paidUSD));
    const nextBalanceUSD = roundCurrency(Math.max(0, order.totalUSD - nextPaidUSD));
    const nextStatus =
      nextBalanceUSD <= 0
        ? "Paga"
        : nextPaidUSD > 0
          ? "Abonada"
          : "Pendiente por cobrar";

    const paymentRow = {
      id: paymentInput?.id || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      orderId,
      paidAt: paymentInput?.paidAt || new Date().toISOString(),
      currency,
      amount,
      paidUSD,
      paidVES,
      exchangeRate: currency === "VES" ? exchangeRate : null,
      note: paymentInput?.note || "",
      createdBy: paymentInput?.createdBy || null,
      createdByUserId: paymentInput?.createdByUserId || null,
    };

    database.prepare(`
      INSERT INTO order_payments (
        id, orderId, paidAt, currency, amount, paidUSD, paidVES, exchangeRate, note, createdBy, createdByUserId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentRow.id,
      paymentRow.orderId,
      paymentRow.paidAt,
      paymentRow.currency,
      paymentRow.amount,
      paymentRow.paidUSD,
      paymentRow.paidVES,
      paymentRow.exchangeRate,
      paymentRow.note,
      paymentRow.createdBy,
      paymentRow.createdByUserId,
    );

    database.prepare(`
      UPDATE orders
      SET paidUSD = ?, balanceUSD = ?, paymentStatus = ?
      WHERE id = ?
    `).run(nextPaidUSD, nextBalanceUSD, nextStatus, orderId);

    outboxRepo.queue("INSERT", "order_payments", paymentRow.id, paymentRow);

    const updatedOrder = {
      ...order,
      paidUSD: nextPaidUSD,
      balanceUSD: nextBalanceUSD,
      paymentStatus: nextStatus,
    };
    outboxRepo.queue("UPDATE", "orders", orderId, updatedOrder);

    return {
      order: updatedOrder,
      payment: paymentRow,
    };
  },
};

// ----------------- ORDER PART DELIVERIES REPOSITORY -----------------
export const orderPartDeliveriesRepo = {
  getByOrderId: (orderId) => {
    return getDb()
      .prepare("SELECT * FROM order_part_deliveries WHERE orderId = ? ORDER BY deliveredAt ASC")
      .all(orderId);
  },
  addDeliveries: (orderId, payload) => {
    const database = getDb();
    const order = ordersRepo.getById(orderId);
    if (!order) {
      throw new Error("Pedido no encontrado para registrar retiro.");
    }
    if ((order.orderStatus || "Ingresado") === "Cancelada") {
      throw new Error("La orden esta cancelada y no permite registrar retiros.");
    }

    const requestedDeliveries = Array.isArray(payload?.deliveries)
      ? payload.deliveries
      : [];
    if (requestedDeliveries.length === 0) {
      throw new Error("Debes indicar al menos una parte para retirar.");
    }

    const initialDeliveredMap = getDeliveredByPartIndex(database, orderId);
    const inBatchMap = new Map();
    const insertedRows = [];
    const insertStmt = database.prepare(`
      INSERT INTO order_part_deliveries (
        id, orderId, partIndex, quantity, note, deliveredAt, createdBy, createdByUserId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    requestedDeliveries.forEach((deliveryInput) => {
      const partIndex = Math.floor(Number(deliveryInput?.partIndex));
      const quantity = normalizePartQuantity(deliveryInput?.quantity);

      if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= order.parts.length) {
        throw new Error("La parte seleccionada no existe en el pedido.");
      }
      if (quantity <= 0) {
        throw new Error("La cantidad a retirar debe ser mayor a cero.");
      }

      const part = order.parts[partIndex];
      const admittedQty = normalizePartQuantity(part?.quantity);
      const alreadyDeliveredQty = normalizePartQuantity(initialDeliveredMap.get(partIndex) || 0);
      const inBatchQty = normalizePartQuantity(inBatchMap.get(partIndex) || 0);
      const pendingQty = Math.max(0, admittedQty - alreadyDeliveredQty - inBatchQty);

      if (pendingQty <= 0) {
        throw new Error(`La parte '${getPartDisplayName(part)}' ya fue retirada completamente.`);
      }
      if (quantity > pendingQty) {
        throw new Error(
          `No puedes retirar ${quantity} de '${getPartDisplayName(part)}'. Pendiente disponible: ${pendingQty}.`,
        );
      }

      const deliveryRow = {
        id: deliveryInput?.id || `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        orderId,
        partIndex,
        quantity,
        note: deliveryInput?.note || payload?.note || "",
        deliveredAt: deliveryInput?.deliveredAt || new Date().toISOString(),
        createdBy: deliveryInput?.createdBy || payload?.createdBy || null,
        createdByUserId: deliveryInput?.createdByUserId || payload?.createdByUserId || null,
      };

      insertStmt.run(
        deliveryRow.id,
        deliveryRow.orderId,
        deliveryRow.partIndex,
        deliveryRow.quantity,
        deliveryRow.note,
        deliveryRow.deliveredAt,
        deliveryRow.createdBy,
        deliveryRow.createdByUserId,
      );

      inBatchMap.set(partIndex, inBatchQty + quantity);
      insertedRows.push(deliveryRow);
      outboxRepo.queue("INSERT", "order_part_deliveries", deliveryRow.id, deliveryRow);
    });

    const refreshedDeliveredMap = getDeliveredByPartIndex(database, orderId);
    const nextOrderStatus = deriveOrderStatusFromParts(order.parts, refreshedDeliveredMap);

    database
      .prepare("UPDATE orders SET orderStatus = ? WHERE id = ?")
      .run(nextOrderStatus, orderId);

    const updatedOrder = {
      ...order,
      orderStatus: nextOrderStatus,
    };
    outboxRepo.queue("UPDATE", "orders", orderId, updatedOrder);

    return {
      order: updatedOrder,
      deliveries: insertedRows,
    };
  },
};

// ----------------- SYNC OUTBOX REPOSITORY -----------------
export const outboxRepo = {
  queue: (action, entity, entityId, payload) => {
    getDb().prepare(`
      INSERT INTO sync_outbox (action, entity, entityId, payload) 
      VALUES (?, ?, ?, ?)
    `).run(action, entity, entityId, JSON.stringify(payload));
  },
  getPending: () => {
    return getDb().prepare("SELECT * FROM sync_outbox WHERE status = 'pending' OR status = 'failed' ORDER BY id ASC").all();
  },
  markSynced: (id) => {
    getDb().prepare("UPDATE sync_outbox SET status = 'synced', attempts = attempts + 1, error = NULL WHERE id = ?").run(id);
  },
  markFailed: (id, errorMsg) => {
    getDb().prepare("UPDATE sync_outbox SET status = 'failed', attempts = attempts + 1, error = ? WHERE id = ?").run(errorMsg, id);
  }
};

// ----------------- BCV USD RATE REPOSITORY -----------------
export const bcvRateRepo = {
  getLatest: () => {
    return getDb().prepare(`
      SELECT *
      FROM bcv_usd_rates
      ORDER BY valueDateISO DESC, fetchedAt DESC
      LIMIT 1
    `).get() || null;
  },
  upsertDaily: (rate) => {
    const database = getDb();
    const nowIso = new Date().toISOString();

    database.prepare(`
      INSERT INTO bcv_usd_rates (
        valueUsdRaw,
        valueUsd,
        valueDateLabel,
        valueDateISO,
        sourceUrl,
        isStale,
        fetchedAt,
        rawPayload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(valueDateISO) DO UPDATE SET
        valueUsdRaw = excluded.valueUsdRaw,
        valueUsd = excluded.valueUsd,
        valueDateLabel = excluded.valueDateLabel,
        sourceUrl = excluded.sourceUrl,
        isStale = excluded.isStale,
        fetchedAt = excluded.fetchedAt,
        rawPayload = excluded.rawPayload
    `).run(
      rate.valueUsdRaw,
      Number(rate.valueUsd),
      rate.valueDateLabel,
      rate.valueDateISO,
      rate.sourceUrl,
      rate.isStale ? 1 : 0,
      rate.fetchedAt || nowIso,
      rate.rawPayload ? JSON.stringify(rate.rawPayload) : null,
    );

    return database.prepare(`
      SELECT *
      FROM bcv_usd_rates
      WHERE valueDateISO = ?
      LIMIT 1
    `).get(rate.valueDateISO);
  },
};
