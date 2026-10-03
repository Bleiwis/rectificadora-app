import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";

interface LanStatusState {
  config: {
    mode: "standalone" | "server" | "client";
    host: string;
    port: number;
    token: string;
  };
  serverStatus: {
    running: boolean;
    host: string | null;
    port: number | null;
    connectedClients?: Array<{ connected?: boolean }>;
  };
  remoteReachable: boolean;
}

interface BcvUsdRateSnapshot {
  valueUsd: number;
  valueDateLabel: string;
  isStale: number;
}

export const DesktopStatusBar: React.FC = () => {
  const [lanStatus, setLanStatus] = useState<LanStatusState | null>(null);
  const [bcvRate, setBcvRate] = useState<BcvUsdRateSnapshot | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (typeof window === "undefined" || !window.database) return;

    try {
      const [lan, rate] = await Promise.all([
        window.database.getLanStatus().catch(() => null),
        window.database.getBcvUsdRate().catch(() => null),
      ]);
      if (lan) setLanStatus(lan as unknown as LanStatusState);
      if (rate) setBcvRate(rate);
    } catch (err) {
      console.error("Error al actualizar barra de estado desktop:", err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleManualSync = async () => {
    if (!window.database?.triggerSync || isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      await window.database.triggerSync();
      setSyncFeedback("Sincronizado");
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch {
      setSyncFeedback("Error sync");
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const mode = lanStatus?.config?.mode || "standalone";
  const isServer = mode === "server";
  const isClient = mode === "client";
  const clientConnected = isClient && lanStatus?.remoteReachable;
  const connectedCount =
    lanStatus?.serverStatus?.connectedClients?.filter((c) => c.connected !== false).length || 0;

  return (
    <div className="hidden lg:flex items-center gap-2 px-2 shrink-0 whitespace-nowrap">
      {/* Indicador de Modo LAN / Red */}
      <Link
        to="/ajustes"
        title="Configuración de Red y Modo LAN (Click para ver ajustes)"
        className={`group inline-flex items-center gap-2 h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
          isServer
            ? "border-emerald-300/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs"
            : isClient
            ? clientConnected
              ? "border-blue-300/80 bg-blue-50 text-blue-800 hover:bg-blue-100 hover:border-blue-400 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300 shadow-2xs"
              : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300 animate-pulse shadow-2xs"
            : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 shadow-2xs"
        }`}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${
            isServer
              ? "bg-emerald-500 ring-2 ring-emerald-400/30"
              : isClient
              ? clientConnected
                ? "bg-blue-500 ring-2 ring-blue-400/30"
                : "bg-red-500 ring-2 ring-red-400/30"
              : "bg-gray-400"
          }`}
        />
        <span className="font-semibold">
          {isServer && `Servidor LAN${connectedCount > 0 ? ` (${connectedCount} clientes)` : ": Activo"}`}
          {isClient && (clientConnected ? "Cliente LAN: Conectado" : "Cliente LAN: Sin Servidor")}
          {!isServer && !isClient && "Modo Local"}
        </span>
      </Link>

      {/* Indicador de Tasa Oficial BCV */}
      {bcvRate && bcvRate.valueUsd > 0 && (
        <div
          title={
            bcvRate.isStale
              ? "Tasa BCV referencial (atención: no corresponde al día de hoy)"
              : `Tasa Oficial BCV vigente (${bcvRate.valueDateLabel || "al día"})`
          }
          className={`inline-flex items-center gap-2 h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
            bcvRate.isStale
              ? "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300 shadow-2xs"
              : "border-gray-200/90 bg-gray-50/90 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 shadow-2xs"
          }`}
        >
          <span className="rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            BCV
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            Bs. {bcvRate.valueUsd.toFixed(2)}
          </span>
          {bcvRate.isStale === 1 && (
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title="Tasa no actualizada a hoy" />
          )}
        </div>
      )}

      {/* Disparador de Sincronización Supabase Cloud */}
      <button
        type="button"
        onClick={handleManualSync}
        disabled={isSyncing}
        title="Sincronizar cambios locales con la nube Supabase"
        className="inline-flex items-center gap-1.5 h-8 rounded-full border border-gray-200/90 bg-white px-3 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white whitespace-nowrap shrink-0 transition cursor-pointer"
      >
        <svg
          className={`size-3.5 shrink-0 ${isSyncing ? "animate-spin text-brand-500" : "text-gray-500 dark:text-gray-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>{syncFeedback || (isSyncing ? "Sincronizando..." : "Sync")}</span>
      </button>
    </div>
  );
};
