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
    <div className="hidden lg:flex items-center gap-2.5 px-2 py-1">
      {/* Indicador de Modo LAN / Red */}
      <Link
        to="/ajustes"
        title="Configuración de Red y Modo LAN (Click para ver ajustes)"
        className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
          isServer
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
            : isClient
            ? clientConnected
              ? "border-blue-200 bg-blue-50/80 text-blue-800 hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-300"
              : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300 animate-pulse"
            : "border-gray-200 bg-gray-50/80 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isServer
              ? "bg-emerald-500"
              : isClient
              ? clientConnected
                ? "bg-blue-500"
                : "bg-red-500"
              : "bg-gray-400"
          }`}
        />
        <span>
          {isServer && `Servidor LAN${connectedCount > 0 ? ` (${connectedCount} clientes)` : ": Activo"}`}
          {isClient && (clientConnected ? `Cliente LAN: Conectado` : "Cliente LAN: Sin Servidor")}
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
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            bcvRate.isStale
              ? "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300"
              : "border-gray-200 bg-gray-50/80 text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200"
          }`}
        >
          <span className="text-[11px] font-bold opacity-80">BCV</span>
          <span className="font-semibold">Bs. {bcvRate.valueUsd.toFixed(2)}</span>
          {bcvRate.isStale === 1 && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Tasa no actualizada a hoy" />
          )}
        </div>
      )}

      {/* Disparador de Sincronización Supabase Cloud */}
      <button
        type="button"
        onClick={handleManualSync}
        disabled={isSyncing}
        title="Sincronizar cambios locales con la nube Supabase"
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition"
      >
        <svg
          className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-brand-500" : "text-gray-400"}`}
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
        <span className="text-[11px]">{syncFeedback || (isSyncing ? "Sincronizando..." : "Sync")}</span>
      </button>
    </div>
  );
};
