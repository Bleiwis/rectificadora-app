import { net } from "electron";
import { bcvRateRepo } from "./db.js";

const BCV_RATE_URLS = [
  "https://www.bcv.org.ve/estadisticas/tipo-cambio-de-referencia-smc",
  "https://www.bcv.org.ve/tasas-informativas-sistema-bancario",
];
const DEFAULT_SYNC_INTERVAL_MS = 60 * 1000;

let syncIntervalId = null;
let isRefreshing = false;
let lastConnectivity = null;
let lastSyncError = null;
let lastSuccessfulSyncAt = null;

const MONTHS_ES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function normalizeSpaces(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function getTodayISOInCaracas() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function getCaracasDateParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const byType = (type) => parts.find((part) => part.type === type)?.value;

  return {
    weekday: byType("weekday") || "",
    year: Number(byType("year")),
    month: Number(byType("month")),
    day: Number(byType("day")),
  };
}

function getEffectiveBusinessDateISOInCaracas() {
  const { weekday, year, month, day } = getCaracasDateParts();
  const baseDateUtc = new Date(Date.UTC(year, month - 1, day));

  let addDays = 0;
  if (weekday === "Saturday") {
    addDays = 2;
  } else if (weekday === "Sunday") {
    addDays = 1;
  }

  if (addDays > 0) {
    baseDateUtc.setUTCDate(baseDateUtc.getUTCDate() + addDays);
  }

  return baseDateUtc.toISOString().slice(0, 10);
}

function getDateLabelFromISO(isoDate) {
  const [year, month, day] = String(isoDate)
    .split("-")
    .map((part) => Number(part));

  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function parseSpanishDateLabelToISO(dateLabel) {
  const normalized = normalizeSpaces(dateLabel)
    .replace(/^[A-Za-zÁÉÍÓÚáéíóúÑñ]+,\s*/u, "")
    .replace(/\./g, "")
    .toLowerCase();

  const matched = normalized.match(/(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})/u);
  if (!matched) return null;

  const day = Number(matched[1]);
  const monthKey = matched[2]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const year = Number(matched[3]);
  const month = MONTHS_ES[monthKey];

  if (!month || day < 1 || day > 31 || year < 2000) return null;

  const dayPart = String(day).padStart(2, "0");
  const monthPart = String(month).padStart(2, "0");
  return `${year}-${monthPart}-${dayPart}`;
}

function parseUsdRawToNumber(usdRaw) {
  const normalized = String(usdRaw || "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function extractRateFromHtml(html, sourceUrl) {
  const usdMatch = html.match(/id="dolar"[\s\S]*?<strong class="strong-tb">\s*([0-9.,]+)\s*<\/strong>/i);
  const dateMatch = html.match(/Fecha\s*Valor:\s*<span[^>]*>\s*([^<]+?)\s*<\/span>/i);

  if (!usdMatch || !dateMatch) {
    throw new Error(`No se pudo extraer USD o Fecha Valor desde ${sourceUrl}`);
  }

  const valueUsdRaw = normalizeSpaces(usdMatch[1]);
  const valueDateLabel = normalizeSpaces(dateMatch[1]);
  const valueDateISO = parseSpanishDateLabelToISO(valueDateLabel);
  const valueUsd = parseUsdRawToNumber(valueUsdRaw);

  if (!valueDateISO) {
    throw new Error(`Fecha Valor invalida en ${sourceUrl}: ${valueDateLabel}`);
  }

  if (!Number.isFinite(valueUsd)) {
    throw new Error(`USD invalido en ${sourceUrl}: ${valueUsdRaw}`);
  }

  return {
    valueUsdRaw,
    valueUsd,
    valueDateLabel,
    valueDateISO,
    sourceUrl,
  };
}

async function fetchHtml(url) {
  const response = await net.fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "rectificadora-app/1.0 (+bcv-rate-sync)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al consultar ${url}`);
  }

  return response.text();
}

async function fetchBestBcvRate() {
  const attempts = [];

  for (const url of BCV_RATE_URLS) {
    try {
      const html = await fetchHtml(url);
      const parsed = extractRateFromHtml(html, url);
      attempts.push({ ok: true, url, parsed });
    } catch (error) {
      attempts.push({ ok: false, url, error: error.message || String(error) });
    }
  }

  const successful = attempts.filter((attempt) => attempt.ok).map((attempt) => attempt.parsed);
  if (successful.length === 0) {
    const detail = attempts.map((attempt) => `${attempt.url}: ${attempt.error || "sin detalle"}`).join(" | ");
    throw new Error(`No se pudo obtener tasa BCV. ${detail}`);
  }

  successful.sort((a, b) => {
    if (a.valueDateISO !== b.valueDateISO) {
      return a.valueDateISO > b.valueDateISO ? -1 : 1;
    }
    return a.sourceUrl.localeCompare(b.sourceUrl);
  });

  return successful[0];
}

export function getLatestBcvUsdRate() {
  return bcvRateRepo.getLatest();
}

function isConnectivityError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("net::") ||
    message.includes("timed out") ||
    message.includes("enotfound") ||
    message.includes("econn") ||
    message.includes("network")
  );
}

async function probeConnectivity() {
  try {
    const headResponse = await net.fetch(BCV_RATE_URLS[0], {
      method: "HEAD",
      headers: {
        "user-agent": "rectificadora-app/1.0 (+bcv-connectivity-probe)",
      },
    });

    if (headResponse.ok) {
      return true;
    }

    if (headResponse.status !== 405) {
      return false;
    }

    const getResponse = await net.fetch(BCV_RATE_URLS[0], {
      method: "GET",
      headers: {
        "user-agent": "rectificadora-app/1.0 (+bcv-connectivity-probe)",
      },
    });
    return getResponse.ok;
  } catch {
    return false;
  }
}

export async function refreshBcvUsdRate(options = {}) {
  const { force = false, reason = "manual" } = options;

  const latestLocal = bcvRateRepo.getLatest();
  const effectiveDateISO = getEffectiveBusinessDateISOInCaracas();

  if (
    !force &&
    latestLocal?.valueDateISO &&
    latestLocal.valueDateISO >= effectiveDateISO
  ) {
    return {
      ok: true,
      updated: false,
      skipped: true,
      reason: "already-updated-for-today",
      source: "local",
      rate: latestLocal,
    };
  }

  const remoteRate = await fetchBestBcvRate();
  const isStale = remoteRate.valueDateISO < effectiveDateISO;

  const shouldPersist =
    force ||
    !latestLocal ||
    latestLocal.valueDateISO < remoteRate.valueDateISO ||
    latestLocal.valueDateISO === remoteRate.valueDateISO;

  if (!shouldPersist) {
    return {
      ok: true,
      updated: false,
      skipped: true,
      reason: "local-date-is-newer",
      source: "local",
      rate: latestLocal,
    };
  }

  const persisted = bcvRateRepo.upsertDaily({
    ...remoteRate,
    isStale,
    fetchedAt: new Date().toISOString(),
    rawPayload: {
      reason,
      fetchedFrom: remoteRate.sourceUrl,
      valueUsdRaw: remoteRate.valueUsdRaw,
      valueDateLabel: remoteRate.valueDateLabel,
      valueDateISO: remoteRate.valueDateISO,
    },
  });

  return {
    ok: true,
    updated: true,
    skipped: false,
    reason: isStale ? "remote-date-is-stale" : "updated",
    source: "remote",
    rate: persisted,
  };
}

export async function setManualBcvUsdRate(valueUsdInput) {
  const valueUsd = Number(valueUsdInput);
  if (!Number.isFinite(valueUsd) || valueUsd <= 0) {
    throw new Error("La tasa manual debe ser un numero mayor a cero.");
  }

  const effectiveDateISO = getEffectiveBusinessDateISOInCaracas();
  const effectiveDateLabel = getDateLabelFromISO(effectiveDateISO);
  const valueUsdRaw = valueUsd.toFixed(8).replace(/\./g, ",");

  const persisted = bcvRateRepo.upsertDaily({
    valueUsdRaw,
    valueUsd,
    valueDateLabel: effectiveDateLabel,
    valueDateISO: effectiveDateISO,
    sourceUrl: "manual://local",
    isStale: 1,
    fetchedAt: new Date().toISOString(),
    rawPayload: {
      reason: "manual-offline-entry",
      valueUsd,
      valueDateISO: effectiveDateISO,
    },
  });

  return {
    ok: true,
    updated: true,
    skipped: false,
    reason: "manual-rate-set",
    source: "local",
    rate: persisted,
  };
}

export async function getBcvUsdRateStatus() {
  const todayISO = getTodayISOInCaracas();
  const effectiveDateISO = getEffectiveBusinessDateISOInCaracas();
  const latestRate = bcvRateRepo.getLatest();
  const hasFreshRateForToday = Boolean(
    latestRate?.valueDateISO && latestRate.valueDateISO >= effectiveDateISO,
  );

  const isOnline = await probeConnectivity();
  lastConnectivity = isOnline;

  const requiresManualRate = !isOnline && !hasFreshRateForToday;

  return {
    isOnline,
    todayISO,
    effectiveDateISO,
    hasFreshRateForToday,
    requiresManualRate,
    lastSyncError,
    lastSuccessfulSyncAt,
    latestRate,
  };
}

export async function refreshBcvUsdRateSafe(options = {}) {
  if (isRefreshing) {
    return {
      ok: true,
      updated: false,
      skipped: true,
      reason: "refresh-in-progress",
      source: "local",
      rate: getLatestBcvUsdRate(),
    };
  }

  isRefreshing = true;
  try {
    const result = await refreshBcvUsdRate(options);
    lastConnectivity = true;
    lastSyncError = null;
    lastSuccessfulSyncAt = new Date().toISOString();
    return result;
  } catch (error) {
    if (isConnectivityError(error)) {
      lastConnectivity = false;
    }
    lastSyncError = error?.message || String(error);
    return {
      ok: false,
      updated: false,
      skipped: true,
      reason: "refresh-failed",
      source: "remote",
      error: lastSyncError,
      rate: getLatestBcvUsdRate(),
    };
  } finally {
    isRefreshing = false;
  }
}

export function startBcvRateSyncInterval(intervalMs = DEFAULT_SYNC_INTERVAL_MS) {
  if (syncIntervalId) return;

  refreshBcvUsdRateSafe({ force: false, reason: "startup" });

  syncIntervalId = setInterval(async () => {
    const wasOnline = lastConnectivity;
    const nowOnline = await probeConnectivity();
    lastConnectivity = nowOnline;

    // Refresh when connectivity returns and also periodically while online.
    if ((wasOnline === false && nowOnline === true) || nowOnline === true) {
      await refreshBcvUsdRateSafe({ force: false, reason: "background" });
    }
  }, intervalMs);
}

export function stopBcvRateSyncInterval() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
