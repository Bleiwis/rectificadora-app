import Input from "../../form/input/InputField";
import Select from "../../form/Select";

interface PedidosFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filterPayment: string;
  onFilterPaymentChange: (value: string) => void;
  filterOrderStatus: string;
  onFilterOrderStatusChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  processedCount: number;
}

const paymentFilterOptions = [
  { value: "All", label: "Todos los Estados" },
  { value: "Paga", label: "Paga" },
  { value: "Abonada", label: "Abonada" },
  { value: "Pendiente por cobrar", label: "Pendiente por cobrar" },
];

const orderStatusFilterOptions = [
  { value: "All", label: "Estado pedido: Todos" },
  { value: "Ingresado", label: "Ingresado" },
  { value: "Parcialmente retirado", label: "Parcialmente retirado" },
  { value: "Retirado", label: "Retirado" },
  { value: "Cancelada", label: "Cancelada" },
];

const sortOptions = [
  { value: "DateDesc", label: "Mas Recientes" },
  { value: "DateAsc", label: "Mas Antiguos" },
];

export default function PedidosFilters({
  searchTerm,
  onSearchTermChange,
  filterPayment,
  onFilterPaymentChange,
  filterOrderStatus,
  onFilterOrderStatusChange,
  sortBy,
  onSortByChange,
  processedCount,
}: PedidosFiltersProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Input
            type="text"
            placeholder="Buscar por Nº, cliente, cédula..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="w-48 sm:w-52">
          <Select
            options={paymentFilterOptions}
            value={filterPayment}
            onChange={onFilterPaymentChange}
            placeholder="Filtro de pago"
            className="h-10"
          />
        </div>

        <div className="w-52 sm:w-56">
          <Select
            options={orderStatusFilterOptions}
            value={filterOrderStatus}
            onChange={onFilterOrderStatusChange}
            placeholder="Filtro de estado"
            className="h-10"
          />
        </div>

        <div className="w-44 sm:w-48">
          <Select
            options={sortOptions}
            value={sortBy}
            onChange={onSortByChange}
            placeholder="Orden"
            className="h-10"
          />
        </div>

        <span className="ml-auto rounded-full bg-brand-50 dark:bg-brand-950/20 px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
          {processedCount} Registros
        </span>
      </div>
    </div>
  );
}
