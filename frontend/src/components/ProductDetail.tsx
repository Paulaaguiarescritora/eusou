import { renderFormattedDescription } from '../formatDescription';
import React, { useState, useEffect } from 'react';
import { Product, ProductVariant } from '../types';
import { ShoppingBag, ArrowLeft, Check, Package, AlertCircle } from 'lucide-react';
import { resolveMediaUrl } from '../api';

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (item: {
    productId: string;
    variantId?: string | null;
    name: string;
    variantLabel?: string | null;
    sku?: string | null;
    imageUrl?: string | null;
    unitPrice: number;
    quantity: number;
    availableStock?: number;
  }) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  onBack,
  onAddToCart,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => {
    if (!product.variants || product.variants.length === 0) return null;
    const inStock = product.variants.find((v) => (v.availableStock ?? 0) > 0);
    return inStock || product.variants[0];
  });
  const [quantity, setQuantity] = useState(1);
  const [stockError, setStockError] = useState<string | null>(null);
  const primaryImg = product.media?.find((m) => m.isPrimary)?.url || (product.media && product.media.length > 0 ? product.media[0].url : null);
  const [selectedImage, setSelectedImage] = useState<string | null>(primaryImg);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    setSelectedImage(primaryImg);
  }, [product.id, primaryImg]);

  const hasVariants = Boolean(product.variants && product.variants.length > 0);
  const currentAvailableStock = hasVariants
    ? selectedVariant ? (selectedVariant.availableStock ?? 0) : 0
    : (product.availableStock ?? 0);
  const isOutOfStock = currentAvailableStock <= 0;

  useEffect(() => {
    setStockError(null);
    if (isOutOfStock) {
      setQuantity(1);
    } else if (quantity > currentAvailableStock) {
      setQuantity(Math.max(1, currentAvailableStock));
    }
  }, [selectedVariant?.id, isOutOfStock, currentAvailableStock]);

  const currentPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : product.basePrice
    ? Number(product.basePrice)
    : 0;

  const currentSku = selectedVariant?.sku || product.sku;

  const handleAdd = () => {
    if (isOutOfStock) {
      setStockError('Esta variante está esgotada.');
      return;
    }

    if (quantity > currentAvailableStock) {
      setStockError('Quantidade solicitada indisponível em estoque.');
      return;
    }

    let variantLabel = null;
    if (selectedVariant && selectedVariant.variantAttributeValues) {
      variantLabel = selectedVariant.variantAttributeValues
        .map((v) => `${v.productAttributeValue.attributeDefinition.name}: ${v.productAttributeValue.value}`)
        .join(', ');
    } else if (selectedVariant?.name) {
      variantLabel = selectedVariant.name;
    }

    onAddToCart({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      name: product.name,
      variantLabel,
      sku: currentSku,
      imageUrl: selectedImage ? resolveMediaUrl(selectedImage) : null,
      unitPrice: currentPrice,
      quantity,
      availableStock: currentAvailableStock,
    });

    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center">
            {selectedImage ? (
              <img
                src={resolveMediaUrl(selectedImage)}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-20 h-20 text-slate-300 stroke-[1]" />
            )}
          </div>

          {product.media && product.media.length > 1 && (
            <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
              {product.media.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedImage(m.url)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 shrink-0 ${
                    selectedImage === m.url ? 'border-slate-900' : 'border-transparent'
                  }`}
                >
                  <img src={resolveMediaUrl(m.url)} alt="Miniatura" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info & Options */}
        <div className="flex flex-col justify-between">
          <div>
            {product.brand && (
              <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1 block">
                {product.brand}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {product.name}
            </h1>

            {currentSku && (
              <span className="text-xs text-slate-400 mt-1 block">SKU: {currentSku}</span>
            )}

            <div className="mt-4 pb-6 border-b border-gray-100">
              <span className="text-3xl font-black text-slate-900">
                {currentPrice > 0
                  ? `R$ ${currentPrice.toFixed(2).replace('.', ',')}`
                  : 'Sob consulta'}
              </span>
            </div>

            {product.shortDescription && (
              <p className="text-slate-600 text-sm mt-4 leading-relaxed">
                {product.shortDescription}
              </p>
            )}

            {/* Variant Selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 tracking-wide uppercase block">
                    Selecione a Opção / Variante
                  </label>
                  {selectedVariant && (
                    <span className="text-xs font-medium">
                      {(selectedVariant.availableStock ?? 0) > 0 ? (
                        <span className="text-emerald-700 font-semibold">Disponível</span>
                      ) : (
                        <span className="text-rose-600 font-bold">Esgotado</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const variantStock = v.availableStock ?? 0;
                    const vOutOfStock = variantStock <= 0;
                    const label =
                      v.variantAttributeValues && v.variantAttributeValues.length > 0
                        ? v.variantAttributeValues
                            .map((attr) => attr.productAttributeValue.value)
                            .join(' / ')
                        : v.name || v.sku || 'Opção';

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariant(v);
                          setStockError(null);
                          // Se houver imagem que contenha no altText ou url o nome da cor em minúsculo, seleciona automaticamente
                          const colorName = (v.name || '').toLowerCase();
                          if (colorName && product.media && product.media.length > 0) {
                            const matchingMedia = product.media.find(
                              (m) =>
                                (m.altText && m.altText.toLowerCase().includes(colorName)) ||
                                (m.url && m.url.toLowerCase().includes(colorName)),
                            );
                            if (matchingMedia) {
                              setSelectedImage(matchingMedia.url);
                            }
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? vOutOfStock
                              ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                              : 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : vOutOfStock
                            ? 'border-dashed border-rose-200 bg-rose-50/50 text-slate-500 hover:border-rose-300'
                            : 'border-gray-200 bg-white text-slate-700 hover:border-gray-400'
                        }`}
                      >
                        <span>{label}</span>
                        {vOutOfStock && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                              isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            Esgotado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mt-6">
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-2 block">
                Quantidade
              </label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  disabled={isOutOfStock || quantity <= 1}
                  onClick={() => {
                    setStockError(null);
                    setQuantity((q) => Math.max(1, q - 1));
                  }}
                  className="w-9 h-9 rounded-md border border-gray-200 flex items-center justify-center font-bold text-slate-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span className="w-10 text-center font-semibold text-slate-800 text-sm">
                  {isOutOfStock ? 0 : quantity}
                </span>
                <button
                  type="button"
                  disabled={isOutOfStock || quantity >= currentAvailableStock}
                  onClick={() => {
                    if (quantity >= currentAvailableStock) {
                      setStockError('Não há mais unidades disponíveis para esta opção.');
                      return;
                    }
                    setStockError(null);
                    setQuantity((q) => q + 1);
                  }}
                  className="w-9 h-9 rounded-md border border-gray-200 flex items-center justify-center font-bold text-slate-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Out of Stock Warning / Error notice */}
            {isOutOfStock ? (
              <div className="mt-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Esta variante está esgotada.</span>
              </div>
            ) : stockError ? (
              <div className="mt-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{stockError}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleAdd}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition ${
                isOutOfStock
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : addedNotice
                  ? 'bg-emerald-600 text-white cursor-pointer'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg cursor-pointer'
              }`}
            >
              {isOutOfStock ? (
                <span>Esgotado</span>
              ) : addedNotice ? (
                <>
                  <Check className="w-5 h-5 mr-1" />
                  <span>Adicionado ao Carrinho!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5 mr-1" />
                  <span>Adicionar ao Carrinho</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {product.description && (
        <div className="mt-16 pt-8 border-t border-gray-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Descrição Completa</h2>
          <div
            className="text-slate-600 text-sm leading-relaxed whitespace-pre-line formatted-description"
            dangerouslySetInnerHTML={{ __html: renderFormattedDescription(product.description) }}
          />
        </div>
      )}
    </div>
  );
};
