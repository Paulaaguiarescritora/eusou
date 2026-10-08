import React from 'react';
import { CartItem } from '../types';
import { Trash2, ArrowRight, ArrowLeft, ShoppingBag } from 'lucide-react';

interface CartViewProps {
  items: CartItem[];
  subtotal: number;
  onUpdateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  onRemoveItem: (productId: string, variantId: string | null | undefined) => void;
  onClearCart: () => void;
  onNavigate: (route: string) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  items,
  subtotal,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onNavigate,
}) => {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-black text-slate-900 mb-8">Meu Carrinho</h1>

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

          {items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId || 'base'}`}
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-xs"
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-lg bg-slate-50 overflow-hidden border border-gray-100 shrink-0 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
                  {item.variantLabel && (
                    <span className="text-xs text-slate-500 block">{item.variantLabel}</span>
                  )}
                  <span className="text-xs font-bold text-slate-800 mt-1 block">
                    R$ {item.unitPrice.toFixed(2).replace('.', ',')} cada
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUpdateQuantity(item.productId, item.variantId, item.quantity - 1)}
                    className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-xs font-bold hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.productId, item.variantId, item.quantity + 1)}
                    className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-xs font-bold hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>

                <span className="text-sm font-bold text-slate-900 min-w-16 text-right">
                  R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}
                </span>

                <button
                  onClick={() => onRemoveItem(item.productId, item.variantId)}
                  className="text-gray-400 hover:text-rose-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

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
            <div className="flex justify-between text-slate-600">
              <span>Frete</span>
              <span className="text-emerald-700 font-medium">Grátis (Demonstração)</span>
            </div>
          </div>

          <div className="flex justify-between items-center py-4 border-b border-gray-200 mb-6">
            <span className="font-bold text-slate-900">Total</span>
            <span className="text-xl font-black text-slate-900">
              R$ {subtotal.toFixed(2).replace('.', ',')}
            </span>
          </div>

          <button
            onClick={() => onNavigate('/checkout')}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition cursor-pointer shadow-md"
          >
            <span>Avançar para o Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
