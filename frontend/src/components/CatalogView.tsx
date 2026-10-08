import React from 'react';
import { Catalog, Product } from '../types';
import { ProductCard } from './ProductCard';
import { Sparkles, Layers, ArrowLeft } from 'lucide-react';

interface CatalogViewProps {
  catalog: Catalog;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onBack: () => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  catalog,
  onSelectProduct,
  onQuickAdd,
  onBack,
}) => {
  const theme = catalog.theme;
  const products = catalog.resolvedProducts || [];
  const collections = catalog.collections || [];

  // Reusable theme-based styling (if theme exists)
  const primaryColor = theme?.primaryColor || '#0f172a';
  const font = theme?.font || 'Inter';

  return (
    <div style={{ fontFamily: font }} className="min-h-screen bg-white pb-20">
      {/* Catalog Hero Banner */}
      <div
        style={{ backgroundColor: primaryColor }}
        className="text-white py-16 px-4 sm:px-6 lg:px-8 shadow-sm relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <button
            onClick={onBack}
            className="inline-flex items-center text-xs font-semibold text-white/80 hover:text-white mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
          </button>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-white mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Catálogo {catalog.type === 'AUTOMATIC' ? 'Inteligente' : 'Curado'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{catalog.name}</h1>
          {catalog.description && (
            <p className="mt-3 text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed">
              {catalog.description}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-16">
        {/* Collections Included in this Catalog */}
        {collections.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <Layers className="w-5 h-5 text-slate-800" />
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Coleções em Destaque
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {collections.map((c) => (
                <div
                  key={c.collection.id}
                  className="p-6 bg-slate-50 rounded-2xl border border-gray-100"
                >
                  <h3 className="font-bold text-base text-slate-900">{c.collection.name}</h3>
                  {c.collection.description && (
                    <p className="text-xs text-slate-500 mt-1">{c.collection.description}</p>
                  )}
                  <span className="text-[11px] font-semibold text-slate-400 mt-3 block">
                    {c.collection.items?.length || 0} produtos na seleção
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved Products */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Produtos do Catálogo ({products.length})
            </h2>
          </div>

          {products.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-gray-200 rounded-2xl">
              Nenhum produto ativo associado a este catálogo no momento.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onSelect={onSelectProduct}
                  onQuickAdd={onQuickAdd}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
