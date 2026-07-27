import { createPublicKey, randomUUID, verify as verifySignature } from "node:crypto";
import { getDb } from "./db.js";

const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const LICENSE_TABLE = process.env.LICENSE_TABLE || "app_licenses";
const LICENSE_PUBLIC_KEY = process.env.LICENSE_PUBLIC_KEY || "";
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const LICENSE_ENFORCEMENT =
  process.env.LICENSE_ENFORCEMENT === "true"
    ? true
    : process.env.LICENSE_ENFORCEMENT === "false"
      ? false
      : !isDevelopment;

let refreshIntervalId = null;

function ensureSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      installationId TEXT NOT NULL,
      licensePayload TEXT,
      licenseSignature TEXT,
      lastServerTimeMs INTEGER NOT NULL DEFAULT 0,
      maxSeenTimeMs INTEGER NOT NULL DEFAULT 0,
      lastSyncAt TEXT,
      lastError TEXT,
      updatedAt TEXT NOT NULL
    );
  `);

  const row = db.prepare("SELECT id FROM license_state WHERE id = 1").get();
  if (!row) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO license_state (
        id, installationId, licensePayload, licenseSignature, lastServerTimeMs,
        maxSeenTimeMs, lastSyncAt, lastError, updatedAt
      ) VALUES (1, ?, NULL, NULL, 0, ?, NULL, NULL, ?)
    `).run(`inst_${randomUUID()}`, now, new Date(now).toISOString());
  }
}

function getState() {
  ensureSchema();
  return getDb().prepare("SELECT * FROM license_state WHERE id = 1").get();
}

function updateState(partial) {
  const current = getState();
  const next = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  getDb().prepare(`
    UPDATE license_state
    SET installationId = ?,
        licensePayload = ?,
        licenseSignature = ?,
        lastServerTimeMs = ?,
        maxSeenTimeMs = ?,
        lastSyncAt = ?,
        lastError = ?,
        updatedAt = ?
    WHERE id = 1
  `).run(
    next.installationId,
    next.licensePayload,
    next.licenseSignature,
    Number(next.lastServerTimeMs || 0),
    Number(next.maxSeenTimeMs || 0),
    next.lastSyncAt || null,
    next.lastError || null,
    next.updatedAt,
  );
}

function parseLicensePayload(rawPayload) {
  if (!rawPayload) return null;
  try {
    const parsed = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseDateMs(value) {
  if (!value) return 0;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeTimeAndPersist(state) {
  const nowMs = Date.now();
  const maxSeenTimeMs = Math.max(nowMs, Number(state.maxSeenTimeMs || 0), Number(state.lastServerTimeMs || 0));

  if (maxSeenTimeMs > Number(state.maxSeenTimeMs || 0)) {
    updateState({ maxSeenTimeMs });
  }

  return maxSeenTimeMs;
}

function verifyPayloadSignature(payloadObject, signatureBase64) {
  if (!LICENSE_PUBLIC_KEY) {
    return { ok: true, insecureMode: true };
  }

  if (!signatureBase64) {
    return { ok: false, insecureMode: false, error: "Firma de licencia faltante." };
  }

  let key;
  try {
    const trimmed = LICENSE_PUBLIC_KEY.trim();
    if (trimmed.includes("BEGIN PUBLIC KEY")) {
      key = createPublicKey(trimmed);
    } else {
      key = createPublicKey({
        key: Buffer.from(trimmed, "base64"),
        type: "spki",
        format: "der",
      });
    }
  } catch {
    return { ok: false, insecureMode: false, error: "Clave publica de licencia invalida." };
  }

  const canonicalPayload = JSON.stringify(payloadObject);
  const isValid = verifySignature(
    null,
    Buffer.from(canonicalPayload, "utf8"),
    key,
    Buffer.from(signatureBase64, "base64"),
  );

  if (!isValid) {
    return { ok: false, insecureMode: false, error: "Firma de licencia invalida." };
  }

  return { ok: true, insecureMode: false };
}

function buildLicenseStatus() {
  const state = getState();
  const effectiveNowMs = normalizeTimeAndPersist(state);
  const payload = parseLicensePayload(state.licensePayload);

  if (!LICENSE_ENFORCEMENT) {
    return {
      status: "active",
      reason: "license-enforcement-disabled",
      installationId: state.installationId,
      nowIso: new Date(effectiveNowMs).toISOString(),
      warningStartAt: null,
      blockAt: null,
      daysUntilBlock: 0,
      periodLabel: payload?.periodLabel || null,
      lastSyncAt: state.lastSyncAt || null,
      lastError: null,
      insecureMode: !LICENSE_PUBLIC_KEY,
    };
  }

  if (!payload) {
    return {
      status: "blocked",
      reason: "missing-license",
      installationId: state.installationId,
      nowIso: new Date(effectiveNowMs).toISOString(),
      warningStartAt: null,
      blockAt: null,
      daysUntilBlock: 0,
      periodLabel: null,
      lastSyncAt: state.lastSyncAt || null,
      lastError: state.lastError || "Sin licencia local registrada.",
      insecureMode: !LICENSE_PUBLIC_KEY,
    };
  }

  const warningStartMs = parseDateMs(payload.warningStartAt);
  const blockAtMs = parseDateMs(payload.blockAt);
  const hasCutoffDates = warningStartMs > 0 && blockAtMs > 0;

  if (!hasCutoffDates) {
    return {
      status: "blocked",
      reason: "invalid-license-payload",
      installationId: state.installationId,
      nowIso: new Date(effectiveNowMs).toISOString(),
      warningStartAt: payload.warningStartAt || null,
      blockAt: payload.blockAt || null,
      daysUntilBlock: 0,
      periodLabel: payload.periodLabel || null,
      lastSyncAt: state.lastSyncAt || null,
      lastError: "Licencia incompleta: faltan warningStartAt o blockAt.",
      insecureMode: !LICENSE_PUBLIC_KEY,
    };
  }

  let status = "active";
  let reason = "ok";
  if (effectiveNowMs >= blockAtMs) {
    status = "blocked";
    reason = "past-block-date";
  } else if (effectiveNowMs >= warningStartMs) {
    status = "warning";
    reason = "payment-warning-window";
  }

  const daysUntilBlock = Math.max(0, Math.ceil((blockAtMs - effectiveNowMs) / (24 * 60 * 60 * 1000)));

  return {
    status,
    reason,
    installationId: state.installationId,
    nowIso: new Date(effectiveNowMs).toISOString(),
    warningStartAt: new Date(warningStartMs).toISOString(),
    blockAt: new Date(blockAtMs).toISOString(),
    daysUntilBlock,
    periodLabel: payload.periodLabel || null,
    lastSyncAt: state.lastSyncAt || null,
    lastError: state.lastError || null,
    insecureMode: !LICENSE_PUBLIC_KEY,
  };
}

async function fetchRemoteLicense(installationId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Credenciales de Supabase no configuradas para licencia.");
  }

  const url = `${SUPABASE_URL}/rest/v1/${LICENSE_TABLE}?installation_id=eq.${encodeURIComponent(
    installationId,
  )}&select=installation_id,payload,signature,updated_at,server_time&limit=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No existe licencia remota para installation_id=${installationId}`);
  }

  return rows[0];
}

export async function refreshLicense(_reason = "manual") {
  ensureSchema();
  const state = getState();

  try {
    const remote = await fetchRemoteLicense(state.installationId);
    const payload = parseLicensePayload(remote.payload);

    if (!payload) {
      throw new Error("Payload remoto de licencia invalido.");
    }

    if (payload.installationId && payload.installationId !== state.installationId) {
      throw new Error("La licencia remota no coincide con la instalacion local.");
    }

    const signatureCheck = verifyPayloadSignature(payload, remote.signature || "");
    if (!signatureCheck.ok) {
      throw new Error(signatureCheck.error || "Firma no valida.");
    }

    const serverTimeMs = Math.max(
      parseDateMs(remote.server_time),
      parseDateMs(remote.updated_at),
      Date.now(),
    );

    updateState({
      licensePayload: JSON.stringify(payload),
      licenseSignature: remote.signature || null,
      lastServerTimeMs: serverTimeMs,
      maxSeenTimeMs: Math.max(serverTimeMs, Number(state.maxSeenTimeMs || 0), Date.now()),
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    });

    const status = buildLicenseStatus();
    return {
      ...status,
      insecureMode: signatureCheck.insecureMode,
    };
  } catch (error) {
    updateState({
      lastError: error instanceof Error ? error.message : "Error desconocido al sincronizar licencia.",
      maxSeenTimeMs: Math.max(Number(state.maxSeenTimeMs || 0), Date.now()),
    });
    return buildLicenseStatus();
  }
}

export function getLicenseStatus() {
  ensureSchema();
  return buildLicenseStatus();
}

export function initializeLicenseService({ refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = {}) {
  ensureSchema();
  void refreshLicense("startup");

  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
  }

  refreshIntervalId = setInterval(() => {
    void refreshLicense("interval");
  }, refreshIntervalMs);
}

export function stopLicenseService() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}
