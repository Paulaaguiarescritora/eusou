import React from 'react';
import { Order } from '../types';
import { CheckCircle, Package, ArrowRight, Calendar, User, MapPin } from 'lucide-react';

interface OrderConfirmationProps {
  order: Order;
  onNavigate: (route: string) => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order,
  onNavigate,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 shadow-sm text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>

        <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full">
          Pedido Confirmado (Demonstração)
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-4">
          Obrigado pelo seu pedido, {order.customerName}!
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Número do Pedido: <span className="font-mono font-bold text-slate-800">{order.id}</span>
        </p>

        {/* Resumo em Blocos */}
        <div className="mt-8 text-left bg-slate-50 rounded-2xl p-6 border border-gray-100 space-y-4 text-xs">
          <div className="flex items-center space-x-2 text-slate-700">
            <User className="w-4 h-4 text-slate-400" />
            <span>
              <strong>Cliente:</strong> {order.customerName} ({order.customerEmail}) — {order.customerPhone}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>
              <strong>Endereço:</strong> {order.street}, {order.number} {order.complement || ''} - {order.neighborhood}, {order.city}/{order.state} - CEP: {order.zipCode}
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
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-slate-800 block">{item.productNameSnapshot}</span>
                  {item.skuSnapshot && (
                    <span className="text-slate-400 font-mono text-[11px]">SKU: {item.skuSnapshot}</span>
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
