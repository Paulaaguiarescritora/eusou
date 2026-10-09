import React from 'react';
import { Product } from '../types';
import { Package, Plus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onQuickAdd?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onQuickAdd,
}) => {
  const imageUrl =
    product.media?.find((m) => m.isPrimary)?.url ||
    (product.media && product.media.length > 0 ? product.media[0].url : null);
  const price = product.basePrice ? Number(product.basePrice) : 0;

  return (
    <div
      onClick={() => onSelect(product)}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="relative aspect-square w-full bg-slate-50 flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300">
              <Package className="w-12 h-12 stroke-[1.2]" />
              <span className="text-xs mt-1 text-slate-400">Sem imagem</span>
            </div>
          )}

          {product.brand && (
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-xs text-[11px] font-semibold text-slate-700 rounded-md shadow-xs">
              {product.brand}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-slate-800 text-sm line-clamp-1 group-hover:text-black">
            {product.name}
          </h3>
          {product.shortDescription && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {product.shortDescription}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 pt-0 flex items-center justify-between border-t border-gray-50 mt-2">
        <div>
          <span className="text-xs text-slate-400 block font-normal">A partir de</span>
          <span className="text-base font-bold text-slate-900">
            {price > 0 ? `R$ ${price.toFixed(2).replace('.', ',')}` : 'Consulte'}
          </span>
        </div>

        {onQuickAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(product);
            }}
            className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
            title="Adicionar ao carrinho"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
