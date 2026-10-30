import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (limit: number) => void;
  itemsPerPageOptions?: number[];
  itemLabel?: string;
  className?: string;
  onScrollToTop?: () => void;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [12, 24, 48],
  itemLabel = 'produtos',
  className = '',
  onScrollToTop,
}) => {
  if (totalItems <= 0) return null;

  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePageClick = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
    if (onScrollToTop) {
      onScrollToTop();
    }
  };

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200/80 text-xs text-slate-600 ${className}`}
    >
      {/* Contagem e Detalhes */}
      <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
        <span>
          Mostrando <strong className="text-slate-900 font-bold">{startItem}</strong>–
          <strong className="text-slate-900 font-bold">{endItem}</strong> de{' '}
          <strong className="text-slate-900 font-bold">{totalItems}</strong> {itemLabel}
          {totalPages > 1 && (
            <span className="text-slate-400 ml-1">
              (Página <strong className="text-slate-800 font-semibold">{currentPage}</strong> de{' '}
              <strong className="text-slate-800 font-semibold">{totalPages}</strong>)
            </span>
          )}
        </span>

        {/* Seletor de itens por página */}
        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 ml-0 sm:ml-3">
            <span className="text-slate-400 text-[11px]">Exibir:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900 cursor-pointer shadow-2xs"
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} por página
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Controles de Navegação */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {/* Primeira Página */}
          <button
            type="button"
            onClick={() => handlePageClick(1)}
            disabled={currentPage <= 1}
            title="Primeira página"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Primeira</span>
          </button>

          {/* Página Anterior */}
          <button
            type="button"
            onClick={() => handlePageClick(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Página anterior"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Anterior</span>
          </button>

          {/* Números das Páginas com Elipses */}
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 font-bold text-xs"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageClick(p)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                    isCurrent
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Próxima Página */}
          <button
            type="button"
            onClick={() => handlePageClick(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Próxima página"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
          >
            <span className="hidden sm:inline text-[11px]">Próxima</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Última Página */}
          <button
            type="button"
            onClick={() => handlePageClick(totalPages)}
            disabled={currentPage >= totalPages}
            title="Última página"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
          >
            <span className="hidden md:inline text-[11px]">Última</span>
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
