interface PedidosPaginationProps {
  processedCount: number;
  currentPage: number;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  totalPages: number;
  onPageChange: (value: number) => void;
}

export default function PedidosPagination({
  processedCount,
  currentPage,
  itemsPerPage,
  onItemsPerPageChange,
  totalPages,
  onPageChange,
}: PedidosPaginationProps) {
  if (processedCount <= 0) return null;

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>Mostrar</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(parseInt(e.target.value, 10))}
          className="rounded-lg border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>por pagina</span>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">
        Mostrando {Math.min(processedCount, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(processedCount, currentPage * itemsPerPage)} de {processedCount} pedidos
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition"
        >
          Anterior
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              currentPage === page
                ? "bg-brand-500 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
