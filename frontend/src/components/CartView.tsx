import React, { useState, useEffect } from 'react';
import { CartItem, ShippingQuote } from '../types';
import { fetchApi, resolveMediaUrl } from '../api';
import { Trash2, ArrowRight, ArrowLeft, ShoppingBag, AlertCircle, AlertTriangle, Truck, Loader2, CheckCircle2, Sparkles } from 'lucide-react';

export interface AvailableAlternativeVariant {
  variantId: string;
  name: string;
  sku: string | null;
  price: number;
  availableStock: number;
}

interface CartViewProps {
  items: CartItem[];
  subtotal: number;
  onUpdateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  onRemoveItem: (productId: string, variantId: string | null | undefined) => void;
  onClearCart: () => void;
  onSwapVariant?: (
    productId: string,
    oldVariantId: string | null | undefined,
    newVariant: {
      variantId: string;
      variantLabel: string;
      sku?: string | null;
      unitPrice?: number;
      availableStock?: number;
    },
  ) => void;
  onNavigate: (route: string) => void;
}

interface ItemStockValidation {
  productId: string;
  variantId?: string | null;
  requestedQuantity: number;
  availableStock: number;
  inStock: boolean;
  error?: string | null;
  availableAlternatives?: AvailableAlternativeVariant[];
}

export const CartView: React.FC<CartViewProps> = ({
  items,
  subtotal,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSwapVariant,
  onNavigate,
}) => {
  const [stockValidation, setStockValidation] = useState<{
    isValid: boolean;
    items: ItemStockValidation[];
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const formatCep = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  // Melhor Envio - Estimativa de Frete por CEP
  const [shippingCep, setShippingCep] = useState(() => {
    const saved = localStorage.getItem('eusou_customer_cep') || '';
    return saved ? formatCep(saved) : '';
  });
  const [shippingEstimate, setShippingEstimate] = useState<number | null>(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingCalculatedCep, setShippingCalculatedCep] = useState<string | null>(null);

  const handleCalculateShipping = async (e?: React.FormEvent, cepToUse?: string) => {
    if (e) e.preventDefault();
    const rawCep = cepToUse || shippingCep;
    const cleanCep = rawCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setShippingError('Digite um CEP válido com 8 dígitos.');
      return;
    }

    localStorage.setItem('eusou_customer_cep', cleanCep);
    setCalculatingShipping(true);
    setShippingError(null);
    try {
      const res = await fetchApi<{ quotes: ShippingQuote[] }>('/shipping/calculate', {
        method: 'POST',
        body: JSON.stringify({
          destinationPostalCode: cleanCep,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId || null,
            quantity: i.quantity,
          })),
        }),
      });

      if (res.quotes && res.quotes.length > 0) {
        const prices = res.quotes.map((q) => Number(q.price)).filter((p) => !isNaN(p) && p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : Number(res.quotes[0].price);
        setShippingEstimate(minPrice);
        setShippingCalculatedCep(formatCep(cleanCep));
      } else {
        setShippingEstimate(null);
        setShippingCalculatedCep(null);
        setShippingError('Nenhuma opção de frete disponível para este CEP.');
      }
    } catch (err: any) {
      setShippingEstimate(null);
      setShippingCalculatedCep(null);
      setShippingError(err.message || 'Erro ao calcular frete.');
    } finally {
      setCalculatingShipping(false);
    }
  };

  // Se já houver CEP salvo e itens no carrinho, calcula automaticamente a estimativa
  useEffect(() => {
    const cleanCep = shippingCep.replace(/\D/g, '');
    if (cleanCep.length === 8 && items.length > 0 && shippingEstimate === null && !calculatingShipping) {
      handleCalculateShipping(undefined, cleanCep);
    }
  }, [items.length]);

  useEffect(() => {
    if (items.length === 0) {
      setStockValidation(null);
      return;
    }

    let isCancelled = false;
    setValidating(true);

    fetchApi<{ isValid: boolean; items: ItemStockValidation[] }>('/public/cart/validate', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId || null,
          quantity: i.quantity,
        })),
      }),
    })
      .then((res) => {
        if (!isCancelled) {
          setStockValidation(res);
        }
      })
      .catch((err) => {
        console.error('Falha ao validar estoque do carrinho:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setValidating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Seu carrinho está vazio</h2>
        <p className="text-sm text-slate-500 mt-2">
          Explore nossos produtos e catálogos para adicionar itens ao seu pedido.
        </p>
        <button
          onClick={() => onNavigate('/produtos')}
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
        >
          Explorar Produtos
        </button>
      </div>
    );
  }

  const validationMap = new Map<string, ItemStockValidation>();
  if (stockValidation?.items) {
    for (const v of stockValidation.items) {
      validationMap.set(`${v.productId}-${v.variantId || 'base'}`, v);
    }
  }

  const hasOutOfStockItems = stockValidation ? !stockValidation.isValid : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-black text-slate-900 mb-8">Meu Carrinho</h1>

      {quantityError && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{quantityError}</span>
          </div>
          <button
            onClick={() => setQuantityError(null)}
            className="text-xs text-amber-800 underline ml-4 font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Item List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-500">{items.length} itens no carrinho</span>
            <button
              onClick={onClearCart}
              className="text-xs text-rose-600 hover:underline cursor-pointer"
            >
              Limpar carrinho
            </button>
          </div>

          {items.map((item) => {
            const key = `${item.productId}-${item.variantId || 'base'}`;
            const itemValidation = validationMap.get(key);
            const isItemOutOfStock = itemValidation ? !itemValidation.inStock : false;
            const availableStock = itemValidation ? itemValidation.availableStock : undefined;

            return (
              <div
                key={key}
                className={`p-4 bg-white rounded-xl border shadow-xs transition ${
                  isItemOutOfStock ? 'border-rose-300 bg-rose-50/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg bg-slate-50 overflow-hidden border border-gray-100 shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={resolveMediaUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">{item.name}</h4>

                      {(() => {
                        let colorDisplay = item.variantLabel;
                        if (!colorDisplay && item.sku) {
                          const upperSku = item.sku.toUpperCase();
                          if (upperSku.endsWith('-VER') || upperSku.includes('VERMELHO')) colorDisplay = 'Vermelho';
                          else if (upperSku.endsWith('-PRE') || upperSku.includes('PRETO')) colorDisplay = 'Preto';
                          else if (upperSku.endsWith('-ROS') || upperSku.includes('ROSA')) colorDisplay = 'Rosa';
                          else if (upperSku.endsWith('-BCO') || upperSku.includes('BRANCO')) colorDisplay = 'Branco';
                        }

                        return (
                          <div className="flex flex-col gap-0.5">
                            {colorDisplay && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-950 font-bold text-xs w-fit shadow-2xs">
                                <span className="text-amber-800 font-medium">Cor:</span>
                                <span>{colorDisplay}</span>
                              </div>
                            )}
                            {item.sku && (
                              <span className="text-[11px] text-slate-400 font-mono block">
                                SKU: {item.sku}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      <span className="text-xs font-extrabold text-slate-800 block pt-0.5">
                        R$ {item.unitPrice.toFixed(2).replace('.', ',')} cada
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setQuantityError(null);
                          onUpdateQuantity(item.productId, item.variantId, item.quantity - 1);
                        }}
                        className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-xs font-bold hover:bg-gray-50 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                      <button
                        disabled={availableStock !== undefined && item.quantity >= availableStock}
                        onClick={() => {
                          if (availableStock !== undefined && item.quantity >= availableStock) {
                            setQuantityError(
                              `Não há mais unidades disponíveis para "${item.variantLabel || item.name}".`,
                            );
                            return;
                          }
                          setQuantityError(null);
                          onUpdateQuantity(item.productId, item.variantId, item.quantity + 1);
                        }}
                        className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-xs font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-sm font-bold text-slate-900 min-w-16 text-right">
                      R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}
                    </span>

                    <button
                      onClick={() => onRemoveItem(item.productId, item.variantId)}
                      className="text-gray-400 hover:text-rose-600 transition cursor-pointer"
                      title="Remover do carrinho"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stock Alert on item */}
                {isItemOutOfStock && (
                  <div className="mt-3 pt-2.5 border-t border-rose-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-rose-700">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{itemValidation?.error || 'Esta opção está esgotada.'}</span>
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.productId, item.variantId)}
                        className="text-xs text-rose-800 underline font-bold hover:text-rose-950 cursor-pointer"
                      >
                        Remover item
                      </button>
                    </div>

                    {/* Sugestão de Variantes Disponíveis */}
                    {itemValidation?.availableAlternatives && itemValidation.availableAlternatives.length > 0 && (
                      <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Opções disponíveis deste produto:</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {itemValidation.availableAlternatives.map((alt) => (
                            <button
                              key={alt.variantId}
                              type="button"
                              onClick={() => {
                                if (onSwapVariant) {
                                  onSwapVariant(item.productId, item.variantId, {
                                    variantId: alt.variantId,
                                    variantLabel: alt.name,
                                    sku: alt.sku,
                                    unitPrice: alt.price,
                                    availableStock: alt.availableStock,
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-amber-100/70 border border-amber-300 rounded-lg text-xs font-medium text-amber-950 flex items-center gap-1.5 transition cursor-pointer shadow-2xs group"
                            >
                              <span>
                                Trocar para <strong>{alt.name}</strong>
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">
                                {alt.availableStock} disp.
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-4">
            <button
              onClick={() => onNavigate('/produtos')}
              className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-black cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Continuar comprando
            </button>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100 h-fit">
          <h3 className="font-bold text-slate-900 text-base mb-4">Resumo da Compra</h3>

          <div className="space-y-3 text-sm border-b border-gray-200 pb-4">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal dos itens</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-slate-600 items-center">
              <span>Frete</span>
              {shippingEstimate !== null ? (
                <span className="font-semibold text-slate-800 text-xs">
                  a partir de R$ {shippingEstimate.toFixed(2).replace('.', ',')}
                </span>
              ) : (
                <span className="text-slate-400 text-xs">Informe o CEP abaixo</span>
              )}
            </div>
          </div>

          {/* Calculadora de Frete no Carrinho */}
          <div className="py-4 border-b border-gray-200 space-y-3">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Calcular Frete e Prazo</span>
            </label>
            <form onSubmit={handleCalculateShipping} className="flex gap-2">
              <input
                type="text"
                placeholder="00000-000"
                value={shippingCep}
                onChange={(e) => {
                  const formatted = formatCep(e.target.value);
                  setShippingCep(formatted);
                  const clean = formatted.replace(/\D/g, '');
                  if (clean.length === 8) {
                    handleCalculateShipping(undefined, clean);
                  }
                }}
                maxLength={9}
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-slate-800"
              />
              <button
                type="submit"
                disabled={calculatingShipping}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shrink-0 transition disabled:opacity-50 cursor-pointer"
              >
                {calculatingShipping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calcular'}
              </button>
            </form>

            {shippingError && (
              <p className="text-[11px] text-rose-600 font-medium">{shippingError}</p>
            )}

            {shippingCalculatedCep && shippingEstimate !== null && !shippingError && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>CEP {shippingCalculatedCep} atendido</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Fretes a partir de <strong>R$ {shippingEstimate.toFixed(2).replace('.', ',')}</strong>. Você escolherá a transportadora (SEDEX, PAC, Jadlog, Loggi) na finalização do pedido.
                </p>
              </div>
            )}
          </div>

          <div className="py-4 border-b border-gray-200 mb-6">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900">Subtotal</span>
              <span className="text-xl font-black text-slate-900">
                R$ {subtotal.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              * A transportadora e o frete exato serão selecionados no Checkout.
            </p>
          </div>

          {hasOutOfStockItems && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Existem itens esgotados ou com quantidade superior ao estoque no seu carrinho. Remova ou ajuste esses itens para prosseguir.
              </span>
            </div>
          )}

          <button
            disabled={hasOutOfStockItems || validating}
            onClick={() => {
              if (hasOutOfStockItems) return;
              onNavigate('/checkout');
            }}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition shadow-md ${
              hasOutOfStockItems || validating
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
            }`}
          >
            <span>{validating ? 'Verificando estoque...' : 'Avançar para o Checkout'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
