import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { fetchApi } from '../api';
import { Package, Clock, CheckCircle2, Truck, XCircle, RefreshCw, MessageCircle, Mail, Printer, Trash2, AlertTriangle } from 'lucide-react';
import { getWhatsAppOrderUrl } from '../whatsappOrder';
import { ShippingLabelModal } from './ShippingLabelModal';

export const AdminOrdersView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenDetails = async (order: Order) => {
    setSelectedOrder(order);
    try {
      const full = await fetchApi<Order>(`/admin/orders/${order.id}`);
      if (full && full.id) setSelectedOrder(full);
    } catch {}
  };

  const handleOpenLabel = async (order: Order) => {
    setLabelOrder(order);
    try {
      const full = await fetchApi<Order>(`/admin/orders/${order.id}`);
      if (full && full.id) setLabelOrder(full);
    } catch {}
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setDeleting(true);
    try {
      await fetchApi(`/admin/orders/${orderToDelete.id}`, { method: 'DELETE' });
      if (selectedOrder?.id === orderToDelete.id) {
        setSelectedOrder(null);
      }
      setOrderToDelete(null);
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir pedido');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendEmail = async (orderId: string) => {
    setSendingEmail(true);
    setActionFeedback(null);
    try {
      const res = await fetchApi<{ success: boolean; message: string }>(
        `/admin/orders/${orderId}/send-email`,
        { method: 'POST' },
      );
      setActionFeedback(res.message || 'E-mail enviado com sucesso!');
    } catch (err: any) {
      setActionFeedback(err.message || 'Falha ao disparar e-mail');
    } finally {
      setSendingEmail(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      // In production with auth, pass bearer token. For demo/admin review in F5:
      const res = await fetchApi<{ data: Order[] }>('/admin/orders', {
        headers: {
          // If public demo bypass or dev:
        },
      }).catch(async () => {
        // Fallback or empty if guards require token
        return { data: [] };
      });
      setOrders(res.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const getStatusBadge = (status: Order['status']) => {
    const map = {
      PENDING: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pendente', icon: Clock },
      CONFIRMED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Confirmado', icon: CheckCircle2 },
      PROCESSING: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Em Separação', icon: Package },
      SHIPPED: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Enviado', icon: Truck },
      DELIVERED: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', label: 'Entregue', icon: CheckCircle2 },
      CANCELLED: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Cancelado', icon: XCircle },
    };
    const s = map[status] || { bg: 'bg-gray-50 text-gray-700 border-gray-200', label: status, icon: Clock };
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg}`}>
        <Icon className="w-3 h-3 mr-1" />
        {s.label}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Gestão de Pedidos (Admin)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Visualização de pedidos realizados com snapshots históricos de preços e clientes
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-slate-600 cursor-pointer flex items-center text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Carregando pedidos...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">Nenhum pedido encontrado ainda</h3>
          <p className="text-xs text-slate-500 mt-1">
            Faça um pedido através da loja ou do catálogo para visualizá-lo aqui.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-100">
                <tr>
                  <th className="p-4">ID do Pedido</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Data</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-mono font-medium text-slate-900">{o.id.slice(0, 8)}...</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{o.customerName}</div>
                      <div className="text-[11px] text-slate-400">{o.customerEmail}</div>
                    </td>
                    <td className="p-4">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4">{getStatusBadge(o.status)}</td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      R$ {Number(o.total).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetails(o)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-800 cursor-pointer"
                        >
                          Ver Detalhes
                        </button>
                        <button
                          onClick={() => handleOpenLabel(o)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-zinc-900 hover:bg-zinc-800 text-white rounded cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="Imprimir Etiqueta de Envio e Declaração de Conteúdo"
                        >
                          <Printer size={12} className="text-amber-400" />
                          <span>Etiqueta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderToDelete(o)}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded transition cursor-pointer inline-flex items-center gap-1"
                          title="Excluir este pedido"
                        >
                          <Trash2 size={11} />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Pedido */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Detalhes do Pedido</h3>
                <span className="text-xs font-mono text-slate-400">{selectedOrder.id}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-black font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                <div><strong>Cliente:</strong> {selectedOrder.customerName}</div>
                <div><strong>E-mail:</strong> {selectedOrder.customerEmail}</div>
                <div><strong>Telefone:</strong> {selectedOrder.customerPhone}</div>
                <div>
                  <strong>Endereço:</strong> {selectedOrder.street}, {selectedOrder.number} {selectedOrder.complement || ''} - {selectedOrder.neighborhood}, {selectedOrder.city}/{selectedOrder.state} - CEP: {selectedOrder.zipCode}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Snapshots dos Itens Comprados</h4>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 p-2">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="py-2 flex justify-between">
                      <div>
                        <span className="font-medium text-slate-800">{item.productNameSnapshot}</span>
                        {item.skuSnapshot && <span className="block text-slate-400">SKU: {item.skuSnapshot}</span>}
                        <span className="text-slate-500 block">Qtd: {item.quantity} x R$ {Number(item.unitPrice).toFixed(2)}</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        R$ {Number(item.subtotal).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-gray-100">
                  <h4 className="font-bold text-slate-900">Transação de Pagamento</h4>
                  {selectedOrder.payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-[11px]">
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          Método: {p.method} | Gateway: {p.provider}
                        </span>
                        {p.providerPaymentId && (
                          <span className="font-mono text-slate-500 block">ID Ext: {p.providerPaymentId}</span>
                        )}
                        <span className="text-slate-400 block">{new Date(p.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                      <span className="font-bold text-slate-800 uppercase px-2 py-0.5 rounded bg-white border border-gray-200">
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 font-bold text-sm">
                <span>Total:</span>
                <span className="text-base text-emerald-700">R$ {Number(selectedOrder.total).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {actionFeedback && (
              <div className="mt-3 p-2.5 bg-slate-100 rounded-lg text-xs text-slate-700">
                {actionFeedback}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLabelOrder(selectedOrder)}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition shadow-xs"
                  title="Imprimir Etiqueta de Envio e Declaração de Conteúdo"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Imprimir Etiqueta</span>
                </button>

                <a
                  href={getWhatsAppOrderUrl(selectedOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp do Cliente</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleSendEmail(selectedOrder.id)}
                  disabled={sendingEmail}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{sendingEmail ? 'Enviando...' : 'Reenviar E-mail'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderToDelete(selectedOrder)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition"
                  title="Excluir este pedido definitivamente"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Excluir Pedido</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setActionFeedback(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Pedido */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Excluir Pedido</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Tem certeza que deseja excluir o pedido <strong>#{orderToDelete.id.slice(0, 8)}</strong> ({orderToDelete.customerName})?
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Esta ação é irreversível. Os pagamentos e registros vinculados serão excluídos e qualquer reserva de estoque será liberada.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteOrder}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Excluindo...' : 'Sim, Excluir Pedido'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão de Etiqueta e Declaração de Conteúdo */}
      {labelOrder && (
        <ShippingLabelModal
          order={labelOrder}
          onClose={() => setLabelOrder(null)}
        />
      )}
    </div>
  );
};
