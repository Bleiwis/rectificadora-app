import React from "react";
import { Link } from "react-router";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import { AlertHexaIcon, CheckCircleIcon, ArrowRightIcon } from "../../icons";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  priceUSD: number;
  quantity: number;
  minStock: number;
  description: string;
}

interface InventoryAlertCardProps {
  lowStockItems: InventoryItem[];
}

export const InventoryAlertCard: React.FC<InventoryAlertCardProps> = ({
  lowStockItems,
}) => {
  const isAllGood = lowStockItems.length === 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-white/[0.03]">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                isAllGood
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
              }`}
            >
              {isAllGood ? (
                <CheckCircleIcon className="size-5.5" />
              ) : (
                <AlertHexaIcon className="size-5.5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Stock de Inventario
                </h3>
                {!isAllGood && (
                  <Badge variant="solid" color="error" size="sm">
                    {lowStockItems.length} críticas
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isAllGood
                  ? "Niveles de repuestos e insumos dentro del rango óptimo"
                  : "Artículos en nivel crítico o por debajo del mínimo"}
              </p>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="mt-4 space-y-2.5">
          {isAllGood ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircleIcon className="size-5" />
              </div>
              <p className="mt-2 text-xs font-semibold text-gray-800 dark:text-white">
                Todo el inventario en orden
              </p>
              <p className="text-xxs text-gray-400 mt-0.5">
                No hay repuestos con existencias por debajo del stock mínimo.
              </p>
            </div>
          ) : (
            lowStockItems.slice(0, 4).map((item) => {
              const isDepleted = item.quantity <= 0;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.01] dark:hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 pr-2">
                    <h5 className="text-xs font-bold text-gray-900 truncate dark:text-white">
                      {item.name}
                    </h5>
                    <span className="text-xxs text-gray-500 dark:text-gray-400">
                      {item.category || "General"}
                    </span>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-xxs font-bold ${
                      isDepleted
                        ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    }`}
                  >
                    {isDepleted
                      ? "Agotado (0)"
                      : `Cant: ${item.quantity} / Mín: ${item.minStock}`}
                  </span>
                </div>
              );
            })
          )}

          {lowStockItems.length > 4 && (
            <div className="text-center pt-1 text-xxs font-semibold text-gray-500 dark:text-gray-400">
              +{lowStockItems.length - 4} artículo(s) crítico(s) adicional(es)
            </div>
          )}
        </div>
      </div>

      {/* Footer Link / Button */}
      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Link to="/inventario" className="block w-full">
          <Button
            variant="outline"
            size="sm"
            endIcon={<ArrowRightIcon className="size-3.5" />}
            className="w-full text-xs"
          >
            Gestionar Inventario
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default InventoryAlertCard;
