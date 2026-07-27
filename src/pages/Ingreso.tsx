import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../hooks/useAuth";

type ClientDocumentType = "V" | "J";

interface PartRow {
  partName: string;
  quantity: number;
  measurement: string; // Std, 0.25, 0.50, 0.75, 1.00, etc.
}

interface ServiceSelection {
  id: string;
  name: string;
  priceUSD: number;
  selected: boolean;
}

interface OrderItem {
  id: string;
  code: string; // 4-digit order code (e.g. 0005)
  clientId?: string | null;
  clientName: string;
  clientLastName: string;
  clientCI: string;
  clientPhone: string;
  clientAddress: string;
  engineModel: string;
  parts: PartRow[];
  services: { name: string; priceUSD: number }[];
  inventoryItems?: {
    id: string;
    name: string;
    priceUSD: number;
    quantity: number;
  }[];
  totalUSD: number;
  totalVES: number;
  paidUSD: number;
  balanceUSD: number;
  entryDate: string;
  deliveryDays: number;
  tentativeDeliveryDate: string;
  paymentStatus: "Paga" | "Abonada" | "Pendiente por cobrar";
  orderStatus?: "Ingresado" | "Parcialmente retirado" | "Retirado" | "Cancelada";
  priority?: "Baja" | "Media" | "Alta";
  responsible?: string;
  createdBy: string;
  createdByUserId?: string;
  initialPayment?: {
    currency: "USD" | "VES";
    amount: number;
    exchangeRate?: number;
    note?: string;
    paidAt?: string;
    createdBy?: string;
    createdByUserId?: string;
  };
}

interface BcvUsdRateSnapshot {
  valueUsdRaw: string;
  valueUsd: number;
  valueDateLabel: string;
  valueDateISO: string;
  isStale: number;
}

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
  };
  remoteReachable: boolean;
}

const FALLBACK_BCV_RATE = 36.5;

export default function Ingreso() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nextOrderCodePreview, setNextOrderCodePreview] = useState("...");
  const [servicesList, setServicesList] = useState<ServiceSelection[]>([]);
  const [bcvRate, setBcvRate] = useState<number>(FALLBACK_BCV_RATE);
  const [bcvRateMeta, setBcvRateMeta] = useState<BcvUsdRateSnapshot | null>(
    null,
  );
  const [bcvRateLoadError, setBcvRateLoadError] = useState<string | null>(null);
  const [showManualRateModal, setShowManualRateModal] = useState(false);
  const [manualRateInput, setManualRateInput] = useState("");
  const [manualRateError, setManualRateError] = useState<string | null>(null);
  const [isSavingManualRate, setIsSavingManualRate] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModeSelection, setPaymentModeSelection] = useState<
    "full" | "partial"
  >("full");
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentModalError, setPaymentModalError] = useState<string | null>(
    null,
  );

  // Client & Engine Form State
  const [clientName, setClientName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientDocumentType, setClientDocumentType] =
    useState<ClientDocumentType>("V");
  const [clientDocumentNumber, setClientDocumentNumber] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [engineModel, setEngineModel] = useState("");
  const [recurrentClientNotice, setRecurrentClientNotice] = useState<
    string | null
  >(null);

  // Received Parts State
  const [partsList, setPartsList] = useState<PartRow[]>([]);

  // Settings
  const [deliveryDays, setDeliveryDays] = useState(3);

  // Inventory selection states
  interface InventoryListItem {
    id: string;
    name: string;
    priceUSD: number;
    quantity: number;
    category: string;
    minStock: number;
    description: string;
  }
  const [inventoryList, setInventoryList] = useState<InventoryListItem[]>([]);
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<
    {
      id: string;
      name: string;
      priceUSD: number;
      quantity: number;
      maxQuantity: number;
    }[]
  >([]);
  const [inventorySelectId, setInventorySelectId] = useState("");
  const [inventoryQuantityToAdd, setInventoryQuantityToAdd] = useState(1);
  const [inventorySearchTerm, setInventorySearchTerm] = useState("");
  const [lanStatus, setLanStatus] = useState<LanStatusState | null>(null);

  const normalizeDigitsOnly = (value: string) => value.replace(/\D/g, "");

  const normalizeDecimalInput = (value: string) => {
    const sanitized = value.replace(/[^0-9.,]/g, "");
    const normalized = sanitized.replace(",", ".");
    const [intPart, ...rest] = normalized.split(".");
    if (rest.length === 0) {
      return intPart;
    }
    return `${intPart}.${rest.join("")}`;
  };

  const applyBcvRate = useCallback((rate: BcvUsdRateSnapshot | null) => {
    if (!rate) {
      return;
    }
    setBcvRateMeta(rate);
    setBcvRate(Number(rate.valueUsd) || FALLBACK_BCV_RATE);
  }, []);

  const refreshBcvRateState = useCallback(async () => {
    try {
      const status = await window.database.getBcvUsdRateStatus();
      applyBcvRate(status.latestRate || null);

      if (status.requiresManualRate) {
        setShowManualRateModal(true);
        setManualRateInput(
          status.latestRate?.valueUsd
            ? String(status.latestRate.valueUsd)
            : "",
        );
        setBcvRateLoadError(
          "No hay conexion a internet y no existe tasa BCV vigente para hoy.",
        );
      } else {
        setShowManualRateModal(false);
        setManualRateError(null);
        if (status.latestRate) {
          setBcvRateLoadError(null);
        }
      }
    } catch (error) {
      console.error(error);
      setBcvRateLoadError(
        "No fue posible validar la tasa BCV local. Se utilizará una tasa referencial temporal.",
      );
    }
  }, [applyBcvRate]);

  const refreshNextOrderCodePreview = useCallback(async () => {
    try {
      const nextCode = await window.database.getNextOrderCode();
      setNextOrderCodePreview(nextCode);
    } catch (error) {
      console.error(error);
      setNextOrderCodePreview("N/D");
    }
  }, []);

  const refreshLanState = useCallback(async () => {
    try {
      const status = await window.database.getLanStatus();
      setLanStatus(status);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Load data from SQLite database on mount
  useEffect(() => {
    // 1. Get next order code preview
    refreshNextOrderCodePreview();

    // 2. Get services catalog
    window.database
      .getServices()
      .then((list) => {
        if (list && list.length > 0) {
          // Map services list from DB to include the 'selected' field
          const mapped = list.map((s) => ({
            id: s.id,
            name: s.name,
            priceUSD: s.priceUSD,
            selected: false,
          }));
          setServicesList(mapped);
        } else {
          setServicesList([]);
        }
      })
      .catch(console.error);

    // 3. Get inventory catalog
    window.database
      .getInventory()
      .then((list) => {
        if (list) {
          setInventoryList(list);
        }
      })
      .catch(console.error);

    refreshBcvRateState();
    refreshLanState();
  }, [refreshBcvRateState, refreshLanState, refreshNextOrderCodePreview]);

  // Re-check connectivity/rate periodically to auto-update when internet returns.
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshBcvRateState();
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [refreshBcvRateState]);

  const handleSaveManualRate = async () => {
    const raw = manualRateInput.trim();
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(/,/g, ".")
      : raw;
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setManualRateError("Ingresa una tasa valida mayor a cero.");
      return;
    }

    setIsSavingManualRate(true);
    setManualRateError(null);
    try {
      const result = await window.database.setManualBcvUsdRate(parsed);
      if (!result.ok || !result.rate) {
        throw new Error(result.error || "No fue posible guardar la tasa manual.");
      }

      applyBcvRate(result.rate);
      setShowManualRateModal(false);
      setBcvRateLoadError(
        "Se está usando tasa manual por falta de internet. Se actualizará automáticamente al reconectar.",
      );
    } catch (error) {
      setManualRateError(error instanceof Error ? error.message : "Error al guardar tasa manual.");
    } finally {
      setIsSavingManualRate(false);
    }
  };

  const handleAddPartRow = () => {
    setPartsList((prev) => [...prev, { partName: "", quantity: 1, measurement: "" }]);
  };

  const handleRemovePartRow = (index: number) => {
    setPartsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePartRowChange = (
    index: number,
    field: keyof PartRow,
    value: string | number,
  ) => {
    setPartsList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const handleServiceToggle = (id: string) => {
    setServicesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
    );
  };

  const handleAddInventoryItem = () => {
    if (!inventorySelectId) return;
    const item = inventoryList.find((i) => i.id === inventorySelectId);
    if (!item) return;

    if (item.quantity <= 0) {
      alert("Este artículo se encuentra agotado.");
      return;
    }

    if (inventoryQuantityToAdd > item.quantity) {
      alert(
        `No puede agregar más de la cantidad disponible (${item.quantity} unidades).`,
      );
      return;
    }

    const existing = selectedInventoryItems.find((x) => x.id === item.id);
    if (existing) {
      const newQty = existing.quantity + inventoryQuantityToAdd;
      if (newQty > item.quantity) {
        alert(
          `No puede exceder la cantidad disponible (${item.quantity} unidades).`,
        );
        return;
      }
      setSelectedInventoryItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, quantity: newQty } : x)),
      );
    } else {
      setSelectedInventoryItems((prev) => [
        ...prev,
        {
          id: item.id,
          name: item.name,
          priceUSD: item.priceUSD,
          quantity: inventoryQuantityToAdd,
          maxQuantity: item.quantity,
        },
      ]);
    }

    setInventorySelectId("");
    setInventoryQuantityToAdd(1);
  };

  const handleRemoveInventoryItem = (id: string) => {
    setSelectedInventoryItems((prev) => prev.filter((x) => x.id !== id));
  };

  const openPaymentModal = () => {
    setShowPaymentModal(true);
    setPaymentModeSelection("full");
    setPaymentAmountInput("");
    setPaymentModalError(null);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmountInput("");
    setPaymentModalError(null);
  };

  const buildClientDocument = useCallback(() => {
    const cleanDigits = clientDocumentNumber.replace(/\D/g, "");
    return cleanDigits ? `${clientDocumentType}-${cleanDigits}` : "";
  }, [clientDocumentNumber, clientDocumentType]);

  useEffect(() => {
    const normalizedDocument = buildClientDocument();
    if (!normalizedDocument) {
      setRecurrentClientNotice(null);
      return;
    }

    let isCancelled = false;
    window.database
      .findClientByDocument(normalizedDocument)
      .then((existingClient) => {
        if (isCancelled) return;

        if (!existingClient) {
          setRecurrentClientNotice(null);
          return;
        }

        setRecurrentClientNotice("Cliente recurrente detectado.");
        // Prefill only empty fields so current user edits are not overridden.
        setClientName((prev) => prev || existingClient.firstName || "");
        setClientLastName((prev) => prev || existingClient.lastName || "");
        setClientPhone((prev) => prev || existingClient.phone || "");
        setClientAddress((prev) => prev || existingClient.address || "");
      })
      .catch(() => {
        if (!isCancelled) {
          setRecurrentClientNotice(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [buildClientDocument]);

  const calculateTotalUSD = () => {
    const servicesTotal = servicesList
      .filter((s) => s.selected)
      .reduce((sum, s) => sum + s.priceUSD, 0);
    const itemsTotal = selectedInventoryItems.reduce(
      (sum, item) => sum + item.priceUSD * item.quantity,
      0,
    );
    return servicesTotal + itemsTotal;
  };

  const filteredInventoryList = inventoryList.filter((item) => {
    const term = inventorySearchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      item.name.toLowerCase().includes(term) ||
      (item.category || "").toLowerCase().includes(term)
    );
  });

  const handleCreateOrder = async (
    e?: React.FormEvent,
    paymentMode: "full" | "partial" | "later" = "later",
    partialPaymentUsd?: number,
  ) => {
    e?.preventDefault();
    const clientCI = buildClientDocument();
    if (
      !clientName ||
      !clientLastName ||
      !clientCI ||
      !clientPhone ||
      !engineModel
    ) {
      alert("Por favor rellene todos los campos obligatorios.");
      return;
    }

    const normalizedParts = partsList
      .map((part) => ({
        partName: part.partName.trim(),
        quantity: Number(part.quantity) || 1,
        measurement: part.measurement.trim(),
      }))
      .filter((part) => part.partName.length > 0);

    if (normalizedParts.length === 0) {
      alert("Debes agregar al menos una parte del motor.");
      return;
    }

    const totalUSD = calculateTotalUSD();
    if (totalUSD <= 0) {
      alert("El total del pedido debe ser mayor a cero.");
      return;
    }

    let paidUSD = 0;
    let initialPayment: OrderItem["initialPayment"];

    if (paymentMode === "full") {
      paidUSD = totalUSD;
      initialPayment = {
        currency: "USD",
        amount: Number(totalUSD.toFixed(2)),
        note: "Pago completo al registrar pedido",
      };
    }

    if (paymentMode === "partial") {
      const amount = Number(partialPaymentUsd);

      if (!Number.isFinite(amount) || amount <= 0) {
        alert("Ingresa un monto de abono válido.");
        return;
      }

      paidUSD = Number(amount.toFixed(2));
      if (paidUSD >= totalUSD) {
        alert("El abono en USD debe ser menor al total. Usa 'Cobrar ahora' para pago completo.");
        return;
      }
      initialPayment = {
        currency: "USD",
        amount: Number(amount.toFixed(2)),
        note: "Abono inicial en divisas",
      };
      if (bcvRate <= 0) {
        alert("No hay tasa BCV válida para mostrar referencia en bolívares.");
        return;
      }
    }

    const balanceUSD = Number(Math.max(0, totalUSD - paidUSD).toFixed(2));
    const finalPaymentStatus: OrderItem["paymentStatus"] =
      balanceUSD <= 0
        ? "Paga"
        : paidUSD > 0
          ? "Abonada"
          : "Pendiente por cobrar";

    const entryDate = new Date();
    const tentativeDeliveryDate = new Date();
    tentativeDeliveryDate.setDate(entryDate.getDate() + deliveryDays);

    try {
      if (lanStatus?.config.mode === "client" && !lanStatus.remoteReachable) {
        alert(
          "No hay conexión con el servidor LAN. En modo cliente no se pueden crear órdenes sin servidor.",
        );
        return;
      }

      const client = await window.database.upsertClient({
        docType: clientDocumentType,
        docNumber: clientDocumentNumber,
        firstName: clientName,
        lastName: clientLastName,
        phone: clientPhone,
        address: clientAddress,
      });

      const newOrder: OrderItem = {
        id: Date.now().toString(),
        code: "",
        clientId: client.id,
        clientName,
        clientLastName,
        clientCI: client.docNormalized,
        clientPhone,
        clientAddress,
        engineModel,
        parts: normalizedParts,
        services: servicesList
          .filter((s) => s.selected)
          .map((s) => ({ name: s.name, priceUSD: s.priceUSD })),
        inventoryItems: selectedInventoryItems.map((x) => ({
          id: x.id,
          name: x.name,
          priceUSD: x.priceUSD,
          quantity: x.quantity,
        })),
        totalUSD,
        totalVES: totalUSD * bcvRate,
        paidUSD,
        balanceUSD,
        entryDate: entryDate.toISOString().split("T")[0],
        deliveryDays,
        tentativeDeliveryDate: tentativeDeliveryDate
          .toISOString()
          .split("T")[0],
        paymentStatus: finalPaymentStatus,
        orderStatus: "Ingresado",
        priority: "Media",
        responsible: "",
        createdBy: user?.displayName || user?.username || "Administrador",
        createdByUserId: user?.id,
        initialPayment: initialPayment
          ? {
              ...initialPayment,
              createdBy: user?.displayName || user?.username || "Administrador",
              createdByUserId: user?.id,
              paidAt: new Date().toISOString(),
            }
          : undefined,
      };

      // Atomic order creation (includes inventory deduction and central code assignment in LAN client mode).
      await window.database
        .createOrderWithInventory(newOrder)
        .then(() => {
          // Reset Form
          setClientName("");
          setClientLastName("");
          setClientDocumentType("V");
          setClientDocumentNumber("");
          setClientPhone("");
          setClientAddress("");
          setEngineModel("");
          setRecurrentClientNotice(null);
          setPartsList([]);
          setServicesList((prev) =>
            prev.map((s) => ({ ...s, selected: false })),
          );
          setSelectedInventoryItems([]);
          setDeliveryDays(3);
          void refreshNextOrderCodePreview();
          void refreshLanState();
          // Navigate to orders history list
          navigate("/pedidos");
        })
        .catch((err) => {
          console.error(err);
          alert("Error al guardar el pedido en la base de datos.");
        });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "No fue posible registrar el cliente u orden.";
      alert(message);
    }
  };

  const handleConfirmPaymentFromModal = () => {
    const totalUSD = calculateTotalUSD();

    if (totalUSD <= 0) {
      setPaymentModalError("El total del pedido debe ser mayor a cero.");
      return;
    }

    if (paymentModeSelection === "full") {
      closePaymentModal();
      void handleCreateOrder(undefined, "full");
      return;
    }

    const amount = Number(paymentAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentModalError("Ingresa un monto de abono válido en USD.");
      return;
    }

    if (amount > totalUSD) {
      setPaymentModalError(
        `El abono no puede superar el total de la orden ($${totalUSD.toFixed(2)} USD).`,
      );
      return;
    }

    if (amount === totalUSD) {
      closePaymentModal();
      void handleCreateOrder(undefined, "full");
      return;
    }

    closePaymentModal();
    void handleCreateOrder(undefined, "partial", amount);
  };

  return (
    <div className="relative">
      {showManualRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tasa BCV No Disponible
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              La aplicación no puede conectarse a internet y la última tasa BCV no corresponde a la fecha actual.
              Ingresa una tasa manual para continuar facturando.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tasa Manual (Bs/USD)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={manualRateInput}
                onChange={(e) => setManualRateInput(e.target.value)}
                placeholder="Ej. 721,3456"
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white"
              />
              {manualRateError && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {manualRateError}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveManualRate}
                disabled={isSavingManualRate}
                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingManualRate ? "Guardando..." : "Guardar Tasa Manual"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Registrar Pago
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Total de la orden: ${calculateTotalUSD().toFixed(2)} USD
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="payment-mode"
                  checked={paymentModeSelection === "full"}
                  onChange={() => setPaymentModeSelection("full")}
                  className="h-4 w-4"
                />
                Pagar total
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="payment-mode"
                  checked={paymentModeSelection === "partial"}
                  onChange={() => setPaymentModeSelection("partial")}
                  className="h-4 w-4"
                />
                Registrar abono parcial
              </label>
            </div>

            {paymentModeSelection === "partial" && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Monto abonado (USD)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentAmountInput}
                  onChange={(e) =>
                    setPaymentAmountInput(normalizeDecimalInput(e.target.value))
                  }
                  placeholder={`Máximo ${calculateTotalUSD().toFixed(2)}`}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white"
                />
              </div>
            )}

            {paymentModalError && (
              <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
                {paymentModalError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPaymentFromModal}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <PageMeta
        title="Ingreso de Pedidos | Rectificadora App"
        description="Gestión de órdenes de entrada, presupuestos y notas de entrega imprimibles."
      />
      <PageBreadcrumb pageTitle="Ingreso de Pedidos" />

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              Modo LAN: {lanStatus?.config.mode || "standalone"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {lanStatus?.config.mode === "client"
                ? lanStatus?.remoteReachable
                  ? "Conectado al servidor de órdenes en red local."
                  : "Sin conexión al servidor LAN. No se podrán crear órdenes en modo cliente."
                : lanStatus?.config.mode === "server"
                  ? lanStatus?.serverStatus.running
                    ? `Servidor LAN activo en ${lanStatus.serverStatus.host}:${lanStatus.serverStatus.port}`
                    : "Servidor LAN detenido."
                  : "Operación local (sin coordinación LAN)."}
            </p>
          </div>
            <Link
              to="/ajustes"
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
              Abrir Ajustes LAN
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulario de Registro (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          <form onSubmit={handleCreateOrder} className="space-y-6">
            {/* Tarjeta 1: Datos del Cliente */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Datos del Cliente
                </h3>
                <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  Pedido Nº {nextOrderCodePreview}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Juan"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientLastName}
                    onChange={(e) => setClientLastName(e.target.value)}
                    placeholder="Pérez"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cédula / RIF <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={clientDocumentType}
                      onChange={(e) =>
                        setClientDocumentType(
                          e.target.value as ClientDocumentType,
                        )
                      }
                      className="w-20 rounded-lg border border-gray-300 bg-transparent px-2 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="V">V</option>
                      <option value="J">J</option>
                    </select>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={clientDocumentNumber}
                      onChange={(e) =>
                        setClientDocumentNumber(
                          e.target.value.replace(/\D/g, ""),
                        )
                      }
                      placeholder="12345678"
                      required
                      className="flex-1 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                    />
                  </div>
                  {recurrentClientNotice && (
                    <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                      {recurrentClientNotice}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mt-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={clientPhone}
                    onChange={(e) =>
                      setClientPhone(normalizeDigitsOnly(e.target.value))
                    }
                    placeholder="0412-1234567"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Calle 4, Av. Principal, Local 12"
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Servicios */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Servicios a Realizar
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Selecciona primero los trabajos de rectificación para definir
                  el costo base.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Checklist de Servicios
                </label>
                <div className="divide-y divide-gray-150 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                  {servicesList.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between px-3 py-3"
                    >
                      <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={service.selected}
                          onChange={() => handleServiceToggle(service.id)}
                          className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                        />
                        {service.name}
                      </label>
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">
                        ${service.priceUSD.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {servicesList.length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">
                      No hay servicios registrados. Crea servicios en Gestión de
                      Partes y Servicios.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tarjeta 3: Modelo del Motor e Inventario de Partes Recibidas */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
              <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
                Modelo de Motor y Partes Recibidas
              </h3>

              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Modelo del Motor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={engineModel}
                  onChange={(e) => setEngineModel(e.target.value)}
                  placeholder="Ej. Chevrolet C10 230 / Toyota 2.5 D4D"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* Grid Dinámico de Partes */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Partes del Motor Recibidas
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPartRow}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    + Agregar Parte
                  </button>
                </div>

                {partsList.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No hay partes agregadas. Presiona "Agregar Parte" para comenzar.
                  </div>
                )}

                {partsList.map((row, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-end"
                  >
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                        Parte
                      </label>
                      <input
                        type="text"
                        value={row.partName}
                        onChange={(e) =>
                          handlePartRowChange(index, "partName", e.target.value)
                        }
                        placeholder="Ej. Tapa de cilindros, bloque, ciguenal"
                        className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="w-20">
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) =>
                          handlePartRowChange(
                            index,
                            "quantity",
                            parseInt(e.target.value, 10) || 1,
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-850 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white"
                      />
                    </div>

                    <div className="w-32">
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                        Medida Salida
                      </label>
                      <input
                        type="text"
                        value={row.measurement}
                        onChange={(e) =>
                          handlePartRowChange(
                            index,
                            "measurement",
                            e.target.value,
                          )
                        }
                        placeholder="Ej. Std / 0.50"
                        className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-850 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white"
                      />
                    </div>

                    {partsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePartRow(index)}
                        className="mb-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tarjeta 4: Repuestos del Inventario */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    Repuestos del Inventario (Opcional)
                  </h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Agrega repuestos sin mezclar este flujo con la selección de
                    servicios.
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xxs font-semibold text-brand-600 dark:bg-brand-950/30 dark:text-brand-400">
                  {selectedInventoryItems.length} seleccionados
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                    Buscar repuesto
                  </label>
                  <input
                    type="text"
                    value={inventorySearchTerm}
                    onChange={(e) => setInventorySearchTerm(e.target.value)}
                    placeholder="Nombre o categoria"
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                    Repuesto
                  </label>
                  <select
                    value={inventorySelectId}
                    onChange={(e) => setInventorySelectId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">-- Seleccionar --</option>
                    {filteredInventoryList.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={item.quantity <= 0}
                      >
                        {item.name} (${item.priceUSD.toFixed(2)}) - Disp:{" "}
                        {item.quantity}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                    Cant.
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={inventoryQuantityToAdd}
                      onChange={(e) =>
                        setInventoryQuantityToAdd(
                          parseInt(e.target.value, 10) || 1,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-2 py-2 text-xs text-center outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddInventoryItem}
                      className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {selectedInventoryItems.length > 0 ? (
                <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {selectedInventoryItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between text-xs rounded-lg border border-gray-100 bg-gray-50/50 p-2 dark:border-gray-800 dark:bg-white/[0.02]"
                    >
                      <div className="flex-1 pr-2">
                        <span className="font-semibold text-gray-800 dark:text-white">
                          {item.name}
                        </span>
                        <div className="text-gray-400 text-[10px]">
                          ${item.priceUSD.toFixed(2)} x {item.quantity} uds
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 dark:text-white">
                          ${(item.priceUSD * item.quantity).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveInventoryItem(item.id)}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  No hay repuestos agregados a esta orden.
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Resumen de Costos y Acciones (1/3) */}
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-8 space-y-6 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Programación y Totales
            </h3>

            {/* Configuración de entrega y estado de pago */}
            <div className="space-y-4 pt-4 border-t border-gray-150 dark:border-gray-800">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Días Tentativos de Entrega
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={String(deliveryDays)}
                    onChange={(e) => {
                      const onlyDigits = normalizeDigitsOnly(e.target.value);
                      setDeliveryDays(parseInt(onlyDigits || "1", 10) || 1);
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  El pago o abono se registra desde el botón "Registrar pago".
                  Si el cliente no paga al ingresar, usa "Cobrar después".
                </p>
              </div>
            </div>

            {/* Totales */}
            <div className="space-y-2 pt-4 border-t border-gray-150 dark:border-gray-800">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tasa Referencial BCV:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Bs. {bcvRate.toFixed(2)}
                </span>
              </div>
              {bcvRateMeta?.valueDateLabel && (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Fecha valor:</span>
                  <span>{bcvRateMeta.valueDateLabel.replace(/\s{2,}/g, " ")}</span>
                </div>
              )}
              {bcvRateMeta?.isStale ? (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  La tasa BCV disponible está desactualizada respecto al día de hoy.
                </p>
              ) : null}
              {bcvRateLoadError ? (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {bcvRateLoadError}
                </p>
              ) : null}
              <div className="flex justify-between items-center text-lg font-bold text-gray-800 dark:text-white pt-2">
                <span>Total Estimado:</span>
                <div className="text-right">
                  <div>${calculateTotalUSD().toFixed(2)} USD</div>
                  <div className="text-xs text-brand-600 dark:text-brand-400 font-normal">
                    Bs. {(calculateTotalUSD() * bcvRate).toFixed(2)} VES
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={openPaymentModal}
                className="w-full rounded-lg bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700 transition"
              >
                Registrar pago
              </button>
              <button
                type="button"
                onClick={() => handleCreateOrder(undefined, "later")}
                className="w-full rounded-lg bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 transition"
              >
                Cobrar despues
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
