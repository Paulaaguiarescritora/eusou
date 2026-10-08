import React, { useState } from 'react';
import { Product, ProductVariant } from '../types';
import { ShoppingBag, ArrowLeft, Check, Package } from 'lucide-react';

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
  }) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  onBack,
  onAddToCart,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(
    product.media && product.media.length > 0 ? product.media[0].url : null,
  );
  const [addedNotice, setAddedNotice] = useState(false);

  const currentPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : product.basePrice
    ? Number(product.basePrice)
    : 0;

  const currentSku = selectedVariant?.sku || product.sku;

  const handleAdd = () => {
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
      imageUrl: selectedImage,
      unitPrice: currentPrice,
      quantity,
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
                src={selectedImage}
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
                  <img src={m.url} alt="Miniatura" className="w-full h-full object-cover" />
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
                <label className="text-xs font-bold text-slate-700 tracking-wide uppercase mb-2 block">
                  Selecione a Opção / Variante
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const label =
                      v.variantAttributeValues && v.variantAttributeValues.length > 0
                        ? v.variantAttributeValues
                            .map((attr) => attr.productAttributeValue.value)
                            .join(' / ')
                        : v.name || v.sku || 'Opção';

                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-gray-200 bg-white text-slate-700 hover:border-gray-400'
                        }`}
                      >
                        {label}
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
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-md border border-gray-200 flex items-center justify-center font-bold text-slate-600 hover:bg-gray-50"
                >
                  -
                </button>
                <span className="w-10 text-center font-semibold text-slate-800 text-sm">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 rounded-md border border-gray-200 flex items-center justify-center font-bold text-slate-600 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={handleAdd}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition cursor-pointer ${
                addedNotice
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg'
              }`}
            >
              {addedNotice ? (
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
          <div className="prose prose-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {product.description}
          </div>
        </div>
      )}
    </div>
  );
};
