import "./runtime-env.js";
import { outboxRepo, getDb } from "./db.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://yggvesadklajxabddzkp.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

let isSyncing = false;
let credentialsWarningShown = false;
let syncIntervalId = null;

const DEFAULT_RESTORE_TABLES = [
  "services",
  "inventory",
  "clients",
  "orders",
  "order_payments",
  "order_part_deliveries",
  "app_users",
];

// Helper for exponential backoff delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if the Supabase instance is online and active (handles cold start wakeup)
 */
async function wakeUpSupabase(retries = 5, initialDelayMs = 2000) {
  let currentDelay = initialDelayMs;

  for (let i = 0; i < retries; i++) {
    try {
      // Lightweight request to check if database/API is active
      const response = await fetch(`${SUPABASE_URL}/rest/v1/services?limit=1`, {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });

      if (response.ok || response.status < 500) {
        // Success or standard API error (e.g. 404, 401) means the database is awake
        return true;
      }
      
      console.warn(`Supabase waking up... Status: ${response.status}. Retrying in ${currentDelay}ms`);
    } catch (err) {
      console.warn(`Connection to Supabase failed: ${err.message}. Retrying in ${currentDelay}ms`);
    }

    await delay(currentDelay);
    currentDelay *= 2; // Exponential backoff
  }

  return false;
}

async function fetchRemoteRows(table, pageSize = 500) {
  const rows = [];
  let offset = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const chunk = await response.json();
    if (!Array.isArray(chunk) || chunk.length === 0) {
      break;
    }

    rows.push(...chunk);

    if (chunk.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;
  if (typeof value !== "string") return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function applyServicesRestore(database, rows) {
  const upsert = database.prepare(`
    INSERT INTO services (id, name, category, description, priceUSD)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      description = excluded.description,
      priceUSD = excluded.priceUSD
  `);

  rows.forEach((row) => {
    if (!row?.id) return;
    upsert.run(
      row.id,
      row.name || "",
      row.category || "Otros",
      row.description || "",
      toNumber(row.priceUSD),
    );
  });
}

function applyInventoryRestore(database, rows) {
  const upsert = database.prepare(`
    INSERT INTO inventory (id, name, category, priceUSD, quantity, minStock, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      priceUSD = excluded.priceUSD,
      quantity = excluded.quantity,
      minStock = excluded.minStock,
      description = excluded.description
  `);

  rows.forEach((row) => {
    if (!row?.id) return;
    upsert.run(
      row.id,
      row.name || "",
      row.category || "Otros",
      toNumber(row.priceUSD),
      Math.max(0, Math.floor(toNumber(row.quantity))),
      Math.max(0, Math.floor(toNumber(row.minStock))),
      row.description || "",
    );
  });
}

function applyClientsRestore(database, rows) {
  const upsert = database.prepare(`
    INSERT INTO clients (id, docType, docNumber, docNormalized, firstName, lastName, phone, address, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(docNormalized) DO UPDATE SET
      firstName = excluded.firstName,
      lastName = excluded.lastName,
      phone = excluded.phone,
      address = excluded.address,
      updatedAt = excluded.updatedAt
  `);

  rows.forEach((row) => {
    if (!row?.id || !row?.docNormalized) return;
    upsert.run(
      row.id,
      row.docType || "V",
      row.docNumber || "",
      row.docNormalized,
      row.firstName || "",
      row.lastName || "",
      row.phone || "",
      row.address || "",
      row.createdAt || new Date().toISOString(),
      row.updatedAt || new Date().toISOString(),
    );
  });
}

function applyOrdersRestore(database, rows) {
  const upsert = database.prepare(`
    INSERT INTO orders (
      id, code, clientId, clientName, clientLastName, clientCI, clientPhone, clientAddress,
      engineModel, parts, services, inventoryItems, totalUSD, totalVES, paidUSD, balanceUSD,
      entryDate, deliveryDays, tentativeDeliveryDate, paymentStatus, orderStatus, cancelReason,
      canceledAt, canceledBy, canceledByUserId, priority, responsible, createdBy, createdByUserId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      clientId = excluded.clientId,
      clientName = excluded.clientName,
      clientLastName = excluded.clientLastName,
      clientCI = excluded.clientCI,
      clientPhone = excluded.clientPhone,
      clientAddress = excluded.clientAddress,
      engineModel = excluded.engineModel,
      parts = excluded.parts,
      services = excluded.services,
      inventoryItems = excluded.inventoryItems,
      totalUSD = excluded.totalUSD,
      totalVES = excluded.totalVES,
      paidUSD = excluded.paidUSD,
      balanceUSD = excluded.balanceUSD,
      entryDate = excluded.entryDate,
      deliveryDays = excluded.deliveryDays,
      tentativeDeliveryDate = excluded.tentativeDeliveryDate,
      paymentStatus = excluded.paymentStatus,
      orderStatus = excluded.orderStatus,
      cancelReason = excluded.cancelReason,
      canceledAt = excluded.canceledAt,
      canceledBy = excluded.canceledBy,
      canceledByUserId = excluded.canceledByUserId,
      priority = excluded.priority,
      responsible = excluded.responsible,
      createdBy = excluded.createdBy,
      createdByUserId = excluded.createdByUserId
  `);

  rows.forEach((row) => {
    if (!row?.id) return;

    const parts = parseJsonField(row.parts, []);
    const services = parseJsonField(row.services, []);
    const inventoryItems = parseJsonField(row.inventoryItems, []);

    upsert.run(
      row.id,
      row.code || "",
      row.clientId || null,
      row.clientName || "",
      row.clientLastName || "",
      row.clientCI || "",
      row.clientPhone || "",
      row.clientAddress || "",
      row.engineModel || "",
      JSON.stringify(parts),
      JSON.stringify(services),
      JSON.stringify(inventoryItems),
      toNumber(row.totalUSD),
      toNumber(row.totalVES),
      toNumber(row.paidUSD),
      toNumber(row.balanceUSD),
      row.entryDate || new Date().toISOString().slice(0, 10),
      Math.max(0, Math.floor(toNumber(row.deliveryDays))),
      row.tentativeDeliveryDate || row.entryDate || new Date().toISOString().slice(0, 10),
      row.paymentStatus || "Pendiente por cobrar",
      row.orderStatus || "Ingresado",
      row.cancelReason || null,
      row.canceledAt || null,
      row.canceledBy || null,
      row.canceledByUserId || null,
      row.priority || "Media",
      row.responsible || "",
      row.createdBy || "Sistema",
      row.createdByUserId || null,
    );
  });
}

function applyOrderPaymentsRestore(database, rows) {
  const upsert = database.prepare(`
    INSERT INTO order_payments (
      id, orderId, paidAt, currency, amount, paidUSD, paidVES, exchangeRate, note, createdBy, createdByUserId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      orderId = excluded.orderId,
      paidAt = excluded.paidAt,
      currency = excluded.currency,
      amount = excluded.amount,
      paidUSD = excluded.paidUSD,
      paidVES = excluded.paidVES,
      exchangeRate = excluded.exchangeRate,
      note = excluded.note,
      createdBy = excluded.createdBy,
      createdByUserId = excluded.createdByUserId
  `);

  rows.forEach((row) => {
    if (!row?.id || !row?.orderId) return;
    upsert.run(
      row.id,
      row.orderId,
      row.paidAt || new Date().toISOString(),
      row.currency || "USD",
      toNumber(row.amount),
      toNumber(row.paidUSD),
      row.paidVES == null ? null : toNumber(row.paidVES),
      row.exchangeRate == null ? null : toNumber(row.exchangeRate),
      row.note || "",
      row.createdBy || null,
      row.createdByUserId || null,
    );
  });
}

function applyOrderPartDeliveriesRestore(database, rows) {
  const upsert = database.prepare(`
    INSERT INTO order_part_deliveries (
      id, orderId, partIndex, quantity, note, deliveredAt, createdBy, createdByUserId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      orderId = excluded.orderId,
      partIndex = excluded.partIndex,
      quantity = excluded.quantity,
      note = excluded.note,
      deliveredAt = excluded.deliveredAt,
      createdBy = excluded.createdBy,
      createdByUserId = excluded.createdByUserId
  `);

  rows.forEach((row) => {
    if (!row?.id || !row?.orderId) return;
    upsert.run(
      row.id,
      row.orderId,
      Math.max(0, Math.floor(toNumber(row.partIndex))),
      Math.max(0, Math.floor(toNumber(row.quantity))),
      row.note || "",
      row.deliveredAt || new Date().toISOString(),
      row.createdBy || null,
      row.createdByUserId || null,
    );
  });
}

function applyUsersRestore(database, rows) {
  const upsert = database.prepare(`
    INSERT INTO app_users (id, username, displayName, role, status, requiresPasswordReset, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      displayName = excluded.displayName,
      role = excluded.role,
      status = excluded.status,
      requiresPasswordReset = excluded.requiresPasswordReset,
      updatedAt = excluded.updatedAt
  `);

  rows.forEach((row) => {
    if (!row?.id) return;
    upsert.run(
      row.id,
      row.username || "",
      row.displayName || row.username || "",
      row.role || "caja",
      row.status || "active",
      row.requiresPasswordReset ? 1 : 0,
      row.createdAt || new Date().toISOString(),
      row.updatedAt || new Date().toISOString(),
    );
  });
}

function applyRemoteRows(database, table, rows) {
  if (table === "services") return applyServicesRestore(database, rows);
  if (table === "inventory") return applyInventoryRestore(database, rows);
  if (table === "clients") return applyClientsRestore(database, rows);
  if (table === "orders") return applyOrdersRestore(database, rows);
  if (table === "order_payments") return applyOrderPaymentsRestore(database, rows);
  if (table === "order_part_deliveries") return applyOrderPartDeliveriesRestore(database, rows);
  if (table === "app_users") return applyUsersRestore(database, rows);

  throw new Error(`Tabla no soportada para restauración: ${table}`);
}

export async function restoreFromCloudBackup(options = {}) {
  const tables = Array.isArray(options?.tables) && options.tables.length > 0
    ? options.tables
    : DEFAULT_RESTORE_TABLES;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Credenciales de Supabase no configuradas para restauración.");
  }

  const isAwake = await wakeUpSupabase();
  if (!isAwake) {
    throw new Error("Supabase no responde para restauración.");
  }

  const database = getDb();
  const summary = {
    ok: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    tables: {},
  };

  for (const table of tables) {
    try {
      const remoteRows = await fetchRemoteRows(table);
      applyRemoteRows(database, table, remoteRows);
      summary.tables[table] = {
        restored: remoteRows.length,
        status: "ok",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Error desconocido");

      if (message.includes("PGRST205")) {
        summary.tables[table] = {
          restored: 0,
          status: "skipped",
          error: "Tabla remota no existe.",
        };
        continue;
      }

      summary.tables[table] = {
        restored: 0,
        status: "failed",
        error: message,
      };
      summary.ok = false;
    }
  }

  summary.finishedAt = new Date().toISOString();
  return summary;
}

/**
 * Sync a single outbox item to Supabase
 */
async function syncItem(item) {
  const table = item.entity;
  const id = item.entityId;
  const payload = JSON.parse(item.payload || "{}");

  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  let method = "POST";
  let headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  // Convert payload arrays/objects to strings if needed for simple column storage,
  // matching what we stored in SQLite
  const bodyData = { ...payload };
  if (bodyData.parts) bodyData.parts = JSON.stringify(bodyData.parts);
  if (bodyData.services && typeof bodyData.services === "object") {
    bodyData.services = JSON.stringify(bodyData.services);
  }

  if (item.action === "INSERT" || item.action === "UPDATE") {
    method = "POST";
    headers["Prefer"] = "resolution=merge-duplicates";
  } else if (item.action === "DELETE") {
    method = "DELETE";
    url = `${url}?id=eq.${id}`;
  }

  const doRequest = async (data) => {
    const response = await fetch(url, {
      method,
      headers,
      body: item.action !== "DELETE" ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return true;
  };

  try {
    await doRequest(bodyData);
  } catch (err) {
    const errorMsg = err.message || "";
    // If Supabase table is older and missing a column, drop that field and retry once.
    if (errorMsg.includes("PGRST204")) {
      const columnMatch = errorMsg.match(/'([^']+)' column of '([^']+)'/);
      const missingColumn = columnMatch?.[1];
      const tableName = columnMatch?.[2];

      if (missingColumn && tableName === table && Object.prototype.hasOwnProperty.call(bodyData, missingColumn)) {
        const retryData = { ...bodyData };
        delete retryData[missingColumn];
        await doRequest(retryData);
        return true;
      }
    }

    throw err;
  }

  return true;
}

/**
 * Process all pending items in the outbox
 */
export async function processOutbox() {
  if (isSyncing) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (!credentialsWarningShown) {
      console.warn("Supabase Sync: Credenciales no configuradas. El sync remoto está deshabilitado.");
      credentialsWarningShown = true;
    }
    return;
  }

  isSyncing = true;

  try {
    const pending = outboxRepo.getPending();
    if (pending.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`Supabase Sync: Procesando ${pending.length} cambios pendientes...`);

    // Verify/wake up Supabase before sending outbox modifications
    const isAwake = await wakeUpSupabase();
    if (!isAwake) {
      throw new Error("Supabase is not responding (could not wake up).");
    }

    for (const item of pending) {
      try {
        await syncItem(item);
        outboxRepo.markSynced(item.id);
        console.log(`Sync Exitoso: ${item.entity} [${item.action}] ID: ${item.entityId}`);
      } catch (err) {
        const errorMsg = err.message || "";
        // Schema cache errors (missing table/column): skip item and continue queue.
        if (errorMsg.includes("PGRST205") || errorMsg.includes("PGRST204")) {
          console.warn(`Sync: Esquema remoto incompatible para '${item.entity}' (${errorMsg.includes("PGRST205") ? "PGRST205" : "PGRST204"}). Omitiendo item ${item.id}.`);
          outboxRepo.markFailed(item.id, errorMsg);
          continue;
        }
        console.error(`Sync Fallido para item ${item.id}:`, errorMsg);
        outboxRepo.markFailed(item.id, errorMsg);
        // Stop processing further queue items only on connection errors
        break;
      }
    }
  } catch (err) {
    console.error("Error en proceso de sincronización outbox:", err.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Start background sync process (runs every 60 seconds)
 */
export function startSyncInterval(intervalMs = 60000) {
  if (syncIntervalId) return;

  // Run immediately
  processOutbox();

  syncIntervalId = setInterval(() => {
    processOutbox();
  }, intervalMs);
}

/**
 * Stop background sync
 */
export function stopSyncInterval() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
