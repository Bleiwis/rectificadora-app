import { Navigate } from "react-router";
import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../hooks/useAuth";

type LanMode = "standalone" | "server" | "client";

type LanConfig = {
  mode: LanMode;
  host: string;
  port: number;
  token: string;
  modeLocked?: boolean;
  installedRole?: LanMode | null;
};

type LanStatus = {
  config: LanConfig;
  serverStatus: {
    running: boolean;
    host: string | null;
    port: number | null;
    listenReady?: boolean;
    lastError?: string | null;
    discoveryReady?: boolean;
    discoveryLastError?: string | null;
    connectedClients?: LanConnectedClient[];
  };
  remoteReachable: boolean;
  discoveredServers?: LanDiscoveredServer[];
};

type LanConnectedClient = {
  address: string;
  port: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  disconnectedAt?: string;
  connected?: boolean;
  requests?: number;
  lastRequestType?: string;
};

type LocalNetworkIp = {
  interfaceName: string;
  family: string;
  address: string;
  netmask: string;
  cidr: string;
};

type LanDiscoveredServer = {
  host: string;
  port: number;
  tokenRequired: boolean;
  discoveredAt: string;
};

export default function Ajustes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "master" || user?.role === "administrador";

  const [lanConfig, setLanConfig] = useState<LanConfig>({
    mode: "standalone",
    host: "127.0.0.1",
    port: 4510,
    token: "",
  });
  const [lanStatus, setLanStatus] = useState<LanStatus | null>(null);
  const [localIps, setLocalIps] = useState<LocalNetworkIp[]>([]);
  const [isLoadingLocalIps, setIsLoadingLocalIps] = useState(false);
  const [isDiscoveringServers, setIsDiscoveringServers] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<LanDiscoveredServer[]>([]);
  const [isSavingLanConfig, setIsSavingLanConfig] = useState(false);

  const refreshLanState = useCallback(async (showErrors = false) => {
    try {
      const [config, status] = await Promise.all([
        window.database.getLanConfig(),
        window.database.getLanStatus(),
      ]);
      setLanConfig(config);
      setLanStatus(status);
      setDiscoveredServers(status.discoveredServers || []);
    } catch (error) {
      console.error(error);
      if (showErrors) {
        alert("No fue posible consultar el estado LAN.");
      }
    }
  }, []);

  const refreshLocalIps = useCallback(async () => {
    setIsLoadingLocalIps(true);
    try {
      const ips = await window.database.getLocalNetworkIps();
      setLocalIps(ips || []);
    } catch (error) {
      console.error(error);
      setLocalIps([]);
    } finally {
      setIsLoadingLocalIps(false);
    }
  }, []);

  useEffect(() => {
    void refreshLanState();
    void refreshLocalIps();
  }, [refreshLanState, refreshLocalIps]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshLanState();
    }, 5000);

    return () => window.clearInterval(id);
  }, [refreshLanState]);

  const handleSaveLanConfig = async () => {
    setIsSavingLanConfig(true);
    try {
      await window.database.setLanConfig(lanConfig);
      await refreshLanState(true);
      alert("Configuración LAN guardada correctamente.");
    } catch (error) {
      console.error(error);
      alert("No fue posible guardar la configuración LAN.");
    } finally {
      setIsSavingLanConfig(false);
    }
  };

  const handleDiscoverServers = async () => {
    setIsDiscoveringServers(true);
    try {
      const found = await window.database.discoverLanServers();
      setDiscoveredServers(found || []);
      if (found && found.length > 0) {
        const preferred = found[0];
        setLanConfig((prev) => ({
          ...prev,
          host: preferred.host,
          port: preferred.port,
        }));
      }
    } catch (error) {
      console.error(error);
      setDiscoveredServers([]);
      alert("No fue posible escanear la red local.");
    } finally {
      setIsDiscoveringServers(false);
    }
  };

  const handleCopyServerIp = async (ipAddress?: string) => {
    try {
      const valueToCopy = String(ipAddress || serverIpSuggestion || "").trim();
      if (!valueToCopy || valueToCopy === "No detectada") {
        throw new Error("No hay IP local detectada para copiar.");
      }

      await navigator.clipboard.writeText(valueToCopy);
      alert(`IP copiada: ${valueToCopy}`);
    } catch (error) {
      console.error(error);
      alert("No fue posible copiar la IP al portapapeles.");
    }
  };

  const selectBestServerIp = (ips: LocalNetworkIp[]) => {
    if (!Array.isArray(ips) || ips.length === 0) {
      return "No detectada";
    }

    const isPrivate = (address: string) =>
      /^192\.168\./.test(address) || /^10\./.test(address) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address);

    const isLikelyVirtual = (interfaceName: string) => {
      const value = String(interfaceName || "").toLowerCase();
      return (
        value.includes("docker") ||
        value.includes("virtual") ||
        value.includes("vethernet") ||
        value.includes("vmware") ||
        value.includes("vpn") ||
        value.includes("tailscale") ||
        value.includes("wireguard") ||
        value.startsWith("utun")
      );
    };

    const scored = ips
      .map((ip) => {
        let score = 0;
        if (isPrivate(ip.address)) score += 50;
        if (ip.address.startsWith("192.168.")) score += 25;
        if (ip.address.startsWith("10.")) score += 15;
        if (isLikelyVirtual(ip.interfaceName)) score -= 60;
        return { ip, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.ip?.address || ips[0].address;
  };

  const serverIpSuggestion = selectBestServerIp(localIps);
  const serverConnectionAddress =
    lanStatus?.serverStatus.host && lanStatus.serverStatus.host !== "0.0.0.0"
      ? lanStatus.serverStatus.host
      : serverIpSuggestion;
  const connectedClients = lanStatus?.serverStatus.connectedClients || [];
  const serverRuntimeError = lanStatus?.serverStatus.lastError || null;
  const discoveryRuntimeError = lanStatus?.serverStatus.discoveryLastError || null;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <PageMeta
        title="Ajustes LAN | Rectificadora App"
        description="Configuración cliente-servidor local para órdenes concurrentes con código de 4 dígitos."
      />
      <PageBreadcrumb pageTitle="Ajustes LAN" />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Configuración Cliente-Servidor
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Configura una sola PC como servidor y conecta los demás equipos como clientes usando la IP del servidor.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Modo</label>
            <select
              value={lanConfig.mode}
              disabled={Boolean(lanConfig.modeLocked)}
              onChange={(e) => {
                const nextMode = e.target.value as LanMode;
                setLanConfig((prev) => ({
                  ...prev,
                  mode: nextMode,
                  host:
                    nextMode === "server"
                      ? "0.0.0.0"
                      : nextMode === "standalone"
                        ? "127.0.0.1"
                        : prev.host,
                }));
              }}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white"
            >
              <option value="standalone">Standalone</option>
              <option value="server">Servidor LAN</option>
              <option value="client">Cliente LAN</option>
            </select>
            {lanConfig.modeLocked ? (
              <p className="mt-1 text-xxs text-amber-600 dark:text-amber-400">
                Este equipo fue instalado en modo {lanConfig.installedRole || lanConfig.mode} y el modo está bloqueado.
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
              {lanConfig.mode === "client" ? "IP del servidor" : "Host de escucha"}
            </label>
            <input
              type="text"
              value={lanConfig.host}
              onChange={(e) =>
                setLanConfig((prev) => ({ ...prev, host: e.target.value }))
              }
              placeholder={lanConfig.mode === "client" ? "Ejemplo: 192.168.1.50" : "0.0.0.0"}
              disabled={lanConfig.mode === "server"}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xxs text-gray-500 dark:text-gray-400">
              {lanConfig.mode === "server"
                ? "En servidor se usa 0.0.0.0 para aceptar conexiones de toda la red local."
                : "Solo debes colocar la IP del servidor. El puerto 4510 se maneja automáticamente."}
            </p>
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Token</label>
            <input
              type="text"
              value={lanConfig.token}
              onChange={(e) =>
                setLanConfig((prev) => ({ ...prev, token: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white"
            />
          </div>
        </div>

        {lanConfig.mode === "client" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Detección automática para Cliente</p>
            <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-100/90">
              Presiona el botón y la app buscará el servidor LAN en la red local para autocompletar la conexión.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleDiscoverServers}
                disabled={isDiscoveringServers}
                className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-70 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                {isDiscoveringServers ? "Buscando servidor..." : "Buscar servidor en red"}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {discoveredServers.length === 0 ? (
                <p className="text-xs text-emerald-900/90 dark:text-emerald-100/90">
                  Sin resultados de escaneo.
                </p>
              ) : (
                discoveredServers.map((server) => (
                  <div
                    key={`${server.host}:${server.port}`}
                    className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/30"
                  >
                    <span className="text-emerald-900 dark:text-emerald-100">
                      {server.host}:{server.port}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLanConfig((prev) => ({
                          ...prev,
                          host: server.host,
                          port: server.port,
                        }))
                      }
                      className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                    >
                      Usar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
          <p className="text-sm font-medium text-gray-800 dark:text-white">IPs locales detectadas</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Usa una de estas IPs en los clientes para conectarse al servidor.
          </p>

          <div className="mt-3 space-y-2">
            {isLoadingLocalIps ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Detectando interfaces de red...</p>
            ) : localIps.length === 0 ? (
              <p className="text-xs text-red-600 dark:text-red-400">No se detectaron IPs IPv4 locales activas.</p>
            ) : (
              localIps.map((ip) => (
                <div
                  key={`${ip.interfaceName}-${ip.address}`}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-900/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      {ip.address} ({ip.interfaceName})
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">{ip.family}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setLanConfig((prev) => ({
                          ...prev,
                          host: ip.address,
                        }))
                      }
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Usar esta IP
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyServerIp(ip.address)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Copiar IP
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {lanConfig.mode === "server" && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Datos para conectar clientes</p>
            <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-100/90">
              En cada cliente, coloca esta IP del servidor en el campo "IP del servidor".
            </p>
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-emerald-800 dark:text-emerald-200">IP del servidor</p>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {serverConnectionAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyServerIp(serverConnectionAddress)}
                className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                Copiar IP del servidor
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                Clientes detectados en este servidor ({connectedClients.length})
              </p>
              {connectedClients.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-900/90 dark:text-emerald-100/90">
                  Todavía no hay clientes conectados.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {connectedClients.map((client) => (
                    <div
                      key={`${client.address}:${client.port}`}
                      className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/30"
                    >
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        {client.address}:{client.port}
                      </p>
                      <p className="mt-0.5 text-emerald-900/90 dark:text-emerald-100/90">
                        {client.connected ? "Conectado" : "Desconectado"} | Solicitudes: {client.requests || 0}
                      </p>
                      {client.lastSeenAt ? (
                        <p className="mt-0.5 text-emerald-900/80 dark:text-emerald-100/80">
                          Última actividad: {new Date(client.lastSeenAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(serverRuntimeError || discoveryRuntimeError) && (
              <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-300">
                <p className="font-semibold">Diagnóstico LAN del servidor</p>
                {serverRuntimeError ? <p className="mt-1">Error TCP: {serverRuntimeError}</p> : null}
                {discoveryRuntimeError ? <p className="mt-1">Error UDP discovery: {discoveryRuntimeError}</p> : null}
                <p className="mt-1">Revisa si el puerto está ocupado o bloqueado por firewall.</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Guia rápida para definir Servidor y Clientes</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-blue-900/90 dark:text-blue-100/90">
            <li>Elige una sola computadora como servidor (la más estable y siempre encendida).</li>
            <li>En esa computadora, selecciona modo Servidor y guarda la configuración.</li>
            <li>Verifica que aparezca "Servidor activo" y comparte la IP mostrada en "Datos para conectar clientes".</li>
            <li>En cada cliente, selecciona modo Cliente y escribe esa IP (o usa "Buscar servidor en red").</li>
            <li>Guarda en cliente cuando detecte el servidor. El puerto se maneja automáticamente.</li>
            <li>Usa token solo si deseas restringir conexiones (opcional).</li>
          </ol>
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
          <p className="text-sm font-medium text-gray-800 dark:text-white">Estado actual</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Modo: {lanStatus?.config.mode || lanConfig.mode}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {lanStatus?.config.mode === "client"
              ? lanStatus?.remoteReachable
                ? `Cliente conectado al servidor ${lanStatus?.config.host || "(IP no definida)"}.`
                : "Cliente sin conexión al servidor LAN. Verifica la IP del servidor."
              : lanStatus?.config.mode === "server"
                ? lanStatus?.serverStatus.running
                  ? `Servidor activo en ${serverConnectionAddress}:${lanStatus.serverStatus.port || 4510}`
                  : "Servidor detenido."
                : "Operación local sin red LAN."}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              void refreshLanState(true);
              void refreshLocalIps();
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Revalidar estado
          </button>
          <button
            type="button"
            onClick={handleSaveLanConfig}
            disabled={isSavingLanConfig}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-70"
          >
            {isSavingLanConfig ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
