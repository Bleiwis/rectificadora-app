import React, { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { DollarLineIcon, AlertIcon } from "../../icons";
import type { OrderItem, OrderPaymentRow } from "../pedidos/models/types";
import { getOrderBalanceUSD, getOrderPaidUSD } from "../../utils/receivablesSchedule";

interface ReceivablesQuickPaymentModalProps {
  order: OrderItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  bcvRate?: number;
}

export const ReceivablesQuickPaymentModal: React.FC<ReceivablesQuickPaymentModalProps> = ({
  order,
  isOpen,
  onClose,
  onPaymentSuccess,
  bcvRate,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<OrderPaymentRow[]>([]);

  useEffect(() => {
    if (order && isOpen) {
      setAmount("");
      setNote("");
      setError(null);

      // Load payment history
      window.database
        .getOrderPayments(order.id)
        .then((rows) => setHistory(rows || []))
        .catch(() => setHistory([]));
    }
  }, [order, isOpen]);

  if (!order) return null;

  const currentBalance = getOrderBalanceUSD(order);
  const currentPaid = getOrderPaidUSD(order);
  const numAmount = Number(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError("Ingrese un monto mayor a 0.");
      return;
    }

    if (numAmount - currentBalance > 0.001) {
      setError(`El pago excede el saldo pendiente ($${currentBalance.toFixed(2)} USD).`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await window.database.addOrderPayment({
        orderId: order.id,
        payment: {
          currency: "USD",
          amount: numAmount,
          note: note.trim(),
        },
      });

      onPaymentSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el cobro.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[500px] p-6 sm:p-7"
      showCloseButton
    >
      <div className="flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <DollarLineIcon className="size-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Registrar Cobro / Abono
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Orden Nº {order.code} - {order.clientName} {order.clientLastName}
            </p>
          </div>
        </div>

        {/* Resumen de Saldo */}
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3.5 text-xs dark:bg-gray-800/40">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Orden:</span>
            <div className="font-mono font-bold text-gray-800 dark:text-white">
              ${(order.totalUSD || 0).toFixed(2)} USD
            </div>
            <div className="text-gray-500 text-xxs">
              Abonado: ${currentPaid.toFixed(2)} USD
            </div>
          </div>
          <div className="text-right">
            <span className="text-amber-600 dark:text-amber-400 font-medium">Saldo Pendiente:</span>
            <div className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
              ${currentBalance.toFixed(2)} USD
            </div>
            {bcvRate && bcvRate > 0 && (
              <div className="text-xxs text-gray-500 dark:text-gray-400">
                ≈ Bs. {(currentBalance * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertIcon className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-payment-amount">Monto a Cobrar (USD)</Label>
              <button
                type="button"
                onClick={() => setAmount(currentBalance.toFixed(2))}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer"
              >
                Cobrar saldo total (${currentBalance.toFixed(2)})
              </button>
            </div>
            <Input
              id="quick-payment-amount"
              type="number"
              min="0"
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-10 font-mono"
            />
            {bcvRate && numAmount > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Equivalente al cambio: Bs.{" "}
                {(numAmount * bcvRate).toLocaleString("es-VE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                VES (Tasa: {bcvRate.toFixed(2)})
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="quick-payment-note">Nota / Referencia de Pago (opcional)</Label>
            <Input
              id="quick-payment-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Pago móvil Ref 1234 / Efectivo USD"
              className="h-10"
            />
          </div>

          {history.length > 0 && (
            <div className="rounded-lg border border-gray-100 p-2.5 dark:border-gray-800">
              <h5 className="mb-1 text-xxs font-semibold uppercase tracking-wider text-gray-400">
                Pagos Previos ({history.length})
              </h5>
              <div className="max-h-24 overflow-y-auto space-y-1 text-xs">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between text-gray-600 dark:text-gray-300"
                  >
                    <span>
                      {new Date(h.paidAt).toLocaleDateString()} {h.note ? `- ${h.note}` : ""}
                    </span>
                    <span className="font-mono font-medium">${h.paidUSD.toFixed(2)} USD</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || numAmount <= 0}
            >
              {isSaving ? "Guardando..." : "Confirmar Cobro"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ReceivablesQuickPaymentModal;
