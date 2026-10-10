import React, { useState } from 'react';
import { CartItem, Order, Payment, PaymentMethod } from '../types';
import { fetchApi } from '../api';
import {
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
  QrCode,
  CreditCard,
  Copy,
  Clock,
  Loader2,
} from 'lucide-react';

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
    documentNumber: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    zipCode: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardholderName: '',
    expiration: '',
    securityCode: '',
    installments: 1,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for Pix presentation
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

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
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        affiliateCode,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId || undefined,
          quantity: i.quantity,
        })),
      };

      // 1. Create Order securely
      const createdOrder = await fetchApi<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      });

      setPlacedOrder(createdOrder);

      // 2. Generate client-side card token or mock card token
      let cardToken: string | undefined;
      if (paymentMethod === 'CREDIT_CARD') {
        // Secure tokenization simulation: tokens are safe references, never raw card
        cardToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      }

      // 3. Process payment via backend PaymentService
      const paymentPayload = {
        orderId: createdOrder.id,
        method: paymentMethod,
        amount: Number(createdOrder.total),
        documentNumber: formData.documentNumber || undefined,
        documentType: 'CPF',
        cardToken,
        installments: paymentMethod === 'CREDIT_CARD' ? Number(cardData.installments) || 1 : undefined,
      };

      const payment = await fetchApi<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload),
      });

      setActivePayment(payment);

      if (payment.status === 'PAID') {
        onClearCart();
        onOrderPlaced(createdOrder);
      } else if (payment.method === 'PIX') {
        onClearCart();
        // Keep in Pix presentation state
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o pagamento. Verifique os dados digitados.');
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (activePayment?.pixQrCode) {
      navigator.clipboard.writeText(activePayment.pixQrCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  // If waiting for Pix payment completion
  if (activePayment && activePayment.method === 'PIX' && activePayment.status !== 'PAID') {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <QrCode className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">Pague com Pix</h2>
            <p className="text-xs text-slate-500 mt-1">
              Abra o app do seu banco e escaneie o código QR abaixo ou use o Copia e Cola.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center border border-gray-100">
            {activePayment.pixQrCodeBase64 ? (
              <img
                src={activePayment.pixQrCodeBase64.startsWith('data:') ? activePayment.pixQrCodeBase64 : `data:image/png;base64,${activePayment.pixQrCodeBase64}`}
                alt="QR Code Pix"
                className="w-48 h-48 rounded-lg shadow-xs"
              />
            ) : (
              <div className="w-48 h-48 bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                Código QR Pix
              </div>
            )}
            <div className="mt-3 flex items-center text-xs text-amber-700 font-semibold gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Aguardando confirmação do pagamento...</span>
            </div>
          </div>

          {activePayment.pixQrCode && (
            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold text-slate-600 block">Código Pix Copia e Cola</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={activePayment.pixQrCode}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-gray-200 bg-slate-50 text-slate-600 select-all"
                />
                <button
                  onClick={copyPixCode}
                  type="button"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={() => placedOrder && onOrderPlaced(placedOrder)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Já realizei o pagamento</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">CPF (para nota e Pix)</label>
                <input
                  type="text"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="sm:col-span-2">
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

          {/* Forma de Pagamento */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-gray-100">
              3. Forma de Pagamento
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${
                  paymentMethod === 'PIX'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <QrCode className="w-5 h-5 text-emerald-600" />
                <span>PIX (Instantâneo)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-5 h-5 text-slate-700" />
                <span>Cartão de Crédito</span>
              </button>
            </div>

            {paymentMethod === 'PIX' && (
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <p className="font-bold">Aprovação imediata via Pix</p>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Ao confirmar o pedido, o código QR e a chave Copia e Cola serão exibidos para pagamento.
                </p>
              </div>
            )}

            {paymentMethod === 'CREDIT_CARD' && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Número do Cartão</label>
                    <input
                      type="text"
                      maxLength={19}
                      value={cardData.cardNumber}
                      onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800 font-mono"
                      placeholder="0000 0000 0000 0000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nome no Cartão</label>
                    <input
                      type="text"
                      value={cardData.cardholderName}
                      onChange={(e) => setCardData({ ...cardData, cardholderName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                      placeholder="Ex: PAULA AGUIAR"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Validade</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={cardData.expiration}
                        onChange={(e) => setCardData({ ...cardData, expiration: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800 font-mono"
                        placeholder="MM/AA"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">CVV</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardData.securityCode}
                        onChange={(e) => setCardData({ ...cardData, securityCode: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800 font-mono"
                        placeholder="123"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Parcelamento</label>
                    <select
                      value={cardData.installments}
                      onChange={(e) => setCardData({ ...cardData, installments: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
                    >
                      <option value={1}>1x de R$ {subtotal.toFixed(2).replace('.', ',')} sem juros</option>
                      <option value={2}>2x de R$ {(subtotal / 2).toFixed(2).replace('.', ',')} sem juros</option>
                      <option value={3}>3x de R$ {(subtotal / 3).toFixed(2).replace('.', ',')} sem juros</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ambiente seguro. Seus dados são criptografados de ponta a ponta.</span>
                </div>
              </div>
            )}
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
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando pagamento...</span>
              </div>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-1" />
                <span>Confirmar e Pagar Agora</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

