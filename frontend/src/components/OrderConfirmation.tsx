import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { fetchApi } from '../api';
import {
  CheckCircle,
  Package,
  ArrowRight,
  Calendar,
  User,
  MapPin,
  MessageCircle,
  Copy,
  Check,
  Globe,
  Share2,
} from 'lucide-react';
import { getWhatsAppOrderUrl, sanitizeWhatsAppPhone } from '../whatsappOrder';

interface OrderConfirmationProps {
  order?: Order | null;
  orderId?: string;
  onNavigate: (route: string) => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order: initialOrder,
  orderId: propOrderId,
  onNavigate,
}) => {
  const [order, setOrder] = useState<Order | null>(initialOrder || null);
  const [loading, setLoading] = useState<boolean>(!initialOrder);
  const [whatsappPhone, setWhatsappPhone] = useState<string>(
    initialOrder?.customerPhone || '',
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // Se o pedido não foi passado por prop, tenta carregar pelo ID da URL/prop
  useEffect(() => {
    if (initialOrder) {
      setOrder(initialOrder);
      setWhatsappPhone(initialOrder.customerPhone || '');
      setLoading(false);
      return;
    }

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const extractedId =
      propOrderId || (currentPath.startsWith('/pedido/') ? currentPath.replace('/pedido/', '') : '');

    if (extractedId) {
      setLoading(true);
      fetchApi<Order>(`/orders/${extractedId}`)
        .then((data) => {
          setOrder(data);
          setWhatsappPhone(data.customerPhone || '');
        })
        .catch(() => {
          setOrder(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [initialOrder, propOrderId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500 font-medium">Carregando detalhes do pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Pedido não encontrado</h2>
        <p className="text-xs text-slate-500 mt-2">
          Verifique o código informado ou entre em contato com nosso atendimento.
        </p>
        <button
          onClick={() => onNavigate('/')}
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
        >
          Voltar para a Loja
        </button>
      </div>
    );
  }

  const trackingUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/pedido/${order.id}`
      : `https://eusou-lemon.vercel.app/pedido/${order.id}`;

  const handleCopyTrackingLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(trackingUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      });
    }
  };

  const whatsAppUrl = getWhatsAppOrderUrl(order, whatsappPhone);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-12 shadow-sm text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>

        {order.status === 'PENDING' ? (
          <div className="space-y-3">
            <span className="inline-flex items-center text-xs font-bold text-amber-700 tracking-wider uppercase bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
              Pedido Reservado (Aguardando Pagamento)
            </span>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-950 leading-relaxed max-w-lg mx-auto">
              <strong>Prazo de Pagamento: 24 horas</strong>
              <p className="mt-0.5 text-[11px] text-amber-900">
                Seu pedido foi reservado e você tem 24 horas para realizar o pagamento. Após esse
                prazo, caso o pagamento não seja confirmado, o pedido será expirado e os produtos
                voltarão ao catálogo.
              </p>
            </div>
          </div>
        ) : (
          <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full">
            Pedido Confirmado
          </span>
        )}

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-4">
          Obrigado pelo seu pedido, {order.customerName}!
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Número do Pedido: <span className="font-mono font-bold text-slate-800">{order.id}</span>
        </p>

        {/* ========================================================================= */}
        {/* CARD DE WHATSAPP: PERGUNTA AO CLIENTE SE DESEJA RECEBER CÓPIA NO WHATSAPP */}
        {/* ========================================================================= */}
        <div className="mt-8 text-left bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white rounded-3xl p-6 sm:p-7 border border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <MessageCircle className="w-6 h-6" />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Deseja receber a confirmação deste pedido no seu WhatsApp?
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                  Prático & Rápido
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Enviamos o resumo completo com todos os produtos, comprovante de compra e link de
                rastreamento diretamente para a sua conversa no WhatsApp.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200 shadow-xs flex-1 max-w-xs">
                  <span className="text-xs font-semibold text-slate-500">Enviar para:</span>
                  <input
                    type="tel"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="(DD) 99999-9999"
                    className="text-xs font-semibold text-slate-800 focus:outline-none w-full bg-transparent"
                  />
                </div>

                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Receber Confirmação no WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD DE ACESSO AO SISTEMA: O CLIENTE PODE ACESSAR A QUALQUER MOMENTO     */}
        {/* ========================================================================= */}
        <div className="mt-4 text-left bg-slate-50/90 rounded-2xl p-5 border border-slate-200/80 space-y-3">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                Você também pode acessar e acompanhar seu pedido no sistema
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                Guarde este link ou o código do seu pedido. Você pode voltar a esta página quando
                quiser para consultar o status de preparação, envio e código de rastreio dos
                Correios / Melhor Envio sem precisar criar senha.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-400 font-mono text-[11px] truncate flex-1 px-1">
              {trackingUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyTrackingLink}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resumo em Blocos */}
        <div className="mt-6 text-left bg-slate-50 rounded-2xl p-6 border border-gray-100 space-y-4 text-xs">
          <div className="flex items-center space-x-2 text-slate-700">
            <User className="w-4 h-4 text-slate-400" />
            <span>
              <strong>Cliente:</strong> {order.customerName} ({order.customerEmail}) —{' '}
              {order.customerPhone}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>
              <strong>Endereço:</strong> {order.street}, {order.number} {order.complement || ''} -{' '}
              {order.neighborhood}, {order.city}/{order.state} - CEP: {order.zipCode}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              <strong>Data:</strong> {new Date(order.createdAt).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Itens do Pedido (Snapshots) */}
        <div className="mt-8 text-left">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Itens Adquiridos</h3>
          <div className="divide-y divide-gray-100 border-t border-b border-gray-100 py-2">
            {(order.items || []).map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-slate-800 block">
                    {item.productNameSnapshot}
                  </span>
                  {item.skuSnapshot && (
                    <span className="text-slate-400 font-mono text-[11px]">
                      SKU: {item.skuSnapshot}
                    </span>
                  )}
                  <span className="text-slate-500 block">Qtd: {item.quantity}</span>
                </div>
                <span className="font-bold text-slate-900">
                  R$ {Number(item.subtotal).toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 text-sm font-bold text-slate-900">
            <span>Total Pago</span>
            <span className="text-lg font-black">
              R$ {Number(order.total).toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => onNavigate('/')}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Continuar Navegando</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
