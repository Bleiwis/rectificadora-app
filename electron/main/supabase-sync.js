import { outboxRepo } from "./db.js";
import fs from "fs";
import path from "path";

// Load environment variables manually from .env file
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join("=").trim();
        }
      }
    });
  }
} catch (err) {
  console.error("Failed to load .env manually:", err.message);
}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://yggvesadklajxabddzkp.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

let isSyncing = false;
let credentialsWarningShown = false;
let syncIntervalId = null;

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
