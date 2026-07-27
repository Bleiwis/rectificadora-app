/// <reference types="vite/client" />

type LicenseStatusPayload = {
  status: "active" | "warning" | "blocked";
  reason: string;
  installationId: string;
  nowIso: string;
  warningStartAt: string | null;
  blockAt: string | null;
  daysUntilBlock: number;
  periodLabel: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  insecureMode: boolean;
};

type BcvUsdRateSnapshot = {
  id: number;
  valueUsdRaw: string;
  valueUsd: number;
  valueDateLabel: string;
  valueDateISO: string;
  sourceUrl: string;
  isStale: number;
  fetchedAt: string;
  rawPayload: string | null;
};

type BcvUsdRateOperationResult = {
  ok: boolean;
  updated: boolean;
  skipped: boolean;
  reason: string;
  source: "local" | "remote";
  error?: string;
  rate: BcvUsdRateSnapshot | null;
};

type BcvUsdRateStatus = {
  isOnline: boolean;
  todayISO: string;
  effectiveDateISO: string;
  hasFreshRateForToday: boolean;
  requiresManualRate: boolean;
  lastSyncError: string | null;
  lastSuccessfulSyncAt: string | null;
  latestRate: BcvUsdRateSnapshot | null;
};

type PaymentStatus = "Paga" | "Abonada" | "Pendiente por cobrar";
type OrderStatus = "Ingresado" | "Parcialmente retirado" | "Retirado" | "Cancelada";

type OrderPayment = {
  id: string;
  orderId: string;
  paidAt: string;
  currency: "USD" | "VES";
  amount: number;
  paidUSD: number;
  paidVES: number | null;
  exchangeRate: number | null;
  note: string;
  createdBy: string | null;
  createdByUserId: string | null;
};

type OrderPartDelivery = {
  id: string;
  orderId: string;
  partIndex: number;
  quantity: number;
  note: string;
  deliveredAt: string;
  createdBy: string | null;
  createdByUserId: string | null;
};

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

type LanDiscoveredServer = {
  host: string;
  port: number;
  tokenRequired: boolean;
  discoveredAt: string;
};

type LocalNetworkIp = {
  interfaceName: string;
  family: "IPv4" | "IPv6" | string;
  address: string;
  netmask: string;
  cidr: string;
};

interface Window {
  database: {
    getServices: () => Promise<{ id: string; name: string; priceUSD: number; category: string; description: string }[]>;
    saveService: (service: { id: string; name: string; priceUSD: number; category: string; description: string }) => Promise<void>;
    deleteService: (id: string) => Promise<void>;
    getInventory: () => Promise<{ id: string; name: string; category: string; priceUSD: number; quantity: number; minStock: number; description: string }[]>;
    saveInventory: (item: { id: string; name: string; category: string; priceUSD: number; quantity: number; minStock: number; description: string }) => Promise<void>;
    deleteInventory: (id: string) => Promise<void>;
    getOrders: () => Promise<{ id: string; code: string; clientId?: string | null; clientName: string; clientLastName: string; clientCI: string; clientPhone: string; clientAddress: string; engineModel: string; parts: unknown[]; services: unknown[]; inventoryItems?: unknown[]; totalUSD: number; totalVES: number; paidUSD?: number; balanceUSD?: number; entryDate: string; deliveryDays: number; tentativeDeliveryDate: string; paymentStatus: PaymentStatus; orderStatus?: OrderStatus; cancelReason?: string | null; canceledAt?: string | null; canceledBy?: string | null; canceledByUserId?: string | null; priority?: "Baja" | "Media" | "Alta"; responsible?: string; createdBy: string; createdByUserId?: string | null }[]>;
    getNextOrderCode: () => Promise<string>;
    reserveNextOrderCode: () => Promise<string>;
    createOrderWithInventory: (order: { id: string; code?: string; clientId?: string | null; clientName: string; clientLastName: string; clientCI: string; clientPhone: string; clientAddress: string; engineModel: string; parts: unknown[]; services: unknown[]; inventoryItems?: unknown[]; totalUSD: number; totalVES: number; paidUSD?: number; balanceUSD?: number; entryDate: string; deliveryDays: number; tentativeDeliveryDate: string; paymentStatus: PaymentStatus; orderStatus?: OrderStatus; cancelReason?: string | null; canceledAt?: string | null; canceledBy?: string | null; canceledByUserId?: string | null; priority?: "Baja" | "Media" | "Alta"; responsible?: string; createdBy: string; createdByUserId?: string | null; initialPayment?: { currency: "USD" | "VES"; amount: number; exchangeRate?: number; paidAt?: string; note?: string; createdBy?: string; createdByUserId?: string | null } }) => Promise<unknown>;
    saveOrder: (order: { id: string; code: string; clientId?: string | null; clientName: string; clientLastName: string; clientCI: string; clientPhone: string; clientAddress: string; engineModel: string; parts: unknown[]; services: unknown[]; inventoryItems?: unknown[]; totalUSD: number; totalVES: number; paidUSD?: number; balanceUSD?: number; entryDate: string; deliveryDays: number; tentativeDeliveryDate: string; paymentStatus: PaymentStatus; orderStatus?: OrderStatus; cancelReason?: string | null; canceledAt?: string | null; canceledBy?: string | null; canceledByUserId?: string | null; priority?: "Baja" | "Media" | "Alta"; responsible?: string; createdBy: string; createdByUserId?: string | null; initialPayment?: { currency: "USD" | "VES"; amount: number; exchangeRate?: number; paidAt?: string; note?: string; createdBy?: string; createdByUserId?: string | null } }) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
    cancelOrder: (payload: { id: string; reason: string; canceledAt?: string; canceledBy?: string; canceledByUserId?: string | null }) => Promise<{ id: string; orderStatus: OrderStatus; cancelReason?: string | null; canceledAt?: string | null; canceledBy?: string | null; canceledByUserId?: string | null }>;
    getOrderPayments: (orderId: string) => Promise<OrderPayment[]>;
    addOrderPayment: (payload: { orderId: string; payment: { currency: "USD" | "VES"; amount: number; exchangeRate?: number; note?: string; paidAt?: string; createdBy?: string; createdByUserId?: string | null } }) => Promise<{ order: { id: string; paidUSD: number; balanceUSD: number; paymentStatus: PaymentStatus }; payment: OrderPayment }>;
    getOrderPartDeliveries: (orderId: string) => Promise<OrderPartDelivery[]>;
    addOrderPartDeliveries: (payload: {
      orderId: string;
      note?: string;
      createdBy?: string;
      createdByUserId?: string | null;
      deliveries: Array<{
        partIndex: number;
        quantity: number;
        note?: string;
        deliveredAt?: string;
        createdBy?: string;
        createdByUserId?: string | null;
      }>;
    }) => Promise<{ order: { id: string; orderStatus: OrderStatus }; deliveries: OrderPartDelivery[] }>;
    getClients: () => Promise<{ id: string; docType: "V" | "J"; docNumber: string; docNormalized: string; firstName?: string; lastName?: string; phone?: string; address?: string; createdAt: string; updatedAt: string }[]>;
    findClientByDocument: (docNormalized: string) => Promise<{ id: string; docType: "V" | "J"; docNumber: string; docNormalized: string; firstName?: string; lastName?: string; phone?: string; address?: string; createdAt: string; updatedAt: string } | null>;
    upsertClient: (client: { id?: string; docType?: "V" | "J"; docNumber?: string; docNormalized?: string; firstName?: string; lastName?: string; phone?: string; address?: string }) => Promise<{ id: string; docType: "V" | "J"; docNumber: string; docNormalized: string; firstName?: string; lastName?: string; phone?: string; address?: string; createdAt: string; updatedAt: string }>;
    triggerSync: () => Promise<void>;
    getBcvUsdRate: () => Promise<BcvUsdRateSnapshot | null>;
    refreshBcvUsdRate: () => Promise<BcvUsdRateOperationResult>;
    getBcvUsdRateStatus: () => Promise<BcvUsdRateStatus>;
    setManualBcvUsdRate: (valueUsd: number) => Promise<BcvUsdRateOperationResult>;
    getLanConfig: () => Promise<LanConfig>;
    setLanConfig: (config: Partial<LanConfig>) => Promise<LanConfig>;
    getLanStatus: () => Promise<LanStatus>;
    discoverLanServers: () => Promise<LanDiscoveredServer[]>;
    getLocalNetworkIps: () => Promise<LocalNetworkIp[]>;
  };
  license?: {
    getStatus: () => Promise<LicenseStatusPayload>;
    refresh: () => Promise<LicenseStatusPayload>;
  };
}
