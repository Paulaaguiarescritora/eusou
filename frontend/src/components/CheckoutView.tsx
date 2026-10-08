import React, { useState } from 'react';
import { CartItem, Order } from '../types';
import { fetchApi } from '../api';
import { ArrowLeft, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';

interface CheckoutViewProps {
  items: CartItem[];
  subtotal: number;
  onClearCart: () => void;
  onNavigate: (route: string) => void;
  onOrderPlaced: (order: Order) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  items,
  subtotal,
  onClearCart,
  onNavigate,
  onOrderPlaced,
}) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    zipCode: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError('O carrinho está vazio');
      return;
    }

    setLoading(true);

    try {
      const affiliateCode = localStorage.getItem('eusou_ref_code') || undefined;

      const orderPayload = {
        ...formData,
        affiliateCode,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId || undefined,
          quantity: i.quantity,
        })),
      };

      const createdOrder = await fetchApi<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      });

      onClearCart();
      onOrderPlaced(createdOrder);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={() => onNavigate('/carrinho')}
        className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-black mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar ao Carrinho
      </button>

      <h1 className="text-2xl font-black text-slate-900 mb-8">Finalizar Pedido</h1>

      {error && (
        <div className="p-4 mb-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Customer & Address Form */}
        <div className="lg:col-span-2 space-y-8">
          {/* Dados Pessoais */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">
              1. Dados do Cliente
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="Ex: Paula Aguiar"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">
              2. Endereço de Entrega
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CEP</label>
                <input
                  type="text"
                  required
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="01001-000"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Rua / Logradouro</label>
                <input
                  type="text"
                  required
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="Av. Paulista"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Número</label>
                <input
                  type="text"
                  required
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="1000"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Complemento / Apto</label>
                <input
                  type="text"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="Bloco A, Apto 42"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bairro</label>
                <input
                  type="text"
                  required
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="Bela Vista"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cidade</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="São Paulo"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm uppercase focus:outline-none focus:border-slate-800"
                  placeholder="SP"
                />
              </div>
            </div>
          </div>

          {/* Pagamento em Modo Demonstração */}
          <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200">
            <div className="flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  Modo Demonstração (Mock Payment)
                </h4>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                  Nenhum valor real será cobrado. O pedido será confirmado instantaneamente utilizando a abstração do provedor de teste da Fase 5.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo Lateral */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100 h-fit space-y-6">
          <h3 className="font-bold text-slate-900 text-base">Itens do Pedido</h3>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {items.map((i) => (
              <div key={`${i.productId}-${i.variantId}`} className="flex justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-800 block">{i.name}</span>
                  <span className="text-slate-500">
                    {i.quantity}x {i.variantLabel ? `(${i.variantLabel})` : ''}
                  </span>
                </div>
                <span className="font-bold text-slate-900">
                  R$ {(i.unitPrice * i.quantity).toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Frete</span>
              <span className="text-emerald-700 font-semibold">Grátis</span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-gray-200">
              <span>Total Final</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition cursor-pointer shadow-md disabled:opacity-50"
          >
            {loading ? (
              <span>Processando...</span>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-1" />
                <span>Confirmar e Finalizar Pedido</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
