import React, { useState } from 'react';
import { Order } from '../types';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';

interface ShippingLabelModalProps {
  order: Order;
  onClose: () => void;
}

export const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({ order, onClose }) => {
  const [format, setFormat] = useState<'a4' | 'thermal'>('a4');
  const [includeDeclaration, setIncludeDeclaration] = useState(true);

  const handlePrint = () => {
    window.print();
  };

  const cleanCep = (order.zipCode || '').replace(/\D/g, '');
  const formattedCep = cleanCep.length === 8 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : order.zipCode;
  const orderShortId = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.createdAt).toLocaleDateString('pt-BR');

  const totalQuantity = (order.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
  const itemsTotalValue = (order.items || []).reduce(
    (acc, item) => acc + (Number(item.subtotal) || Number(item.unitPrice) * Number(item.quantity) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Estilos específicos para Impressão */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 8mm;
            size: ${format === 'thermal' ? '100mm 150mm' : 'A4'};
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-zinc-200 my-auto animate-in fade-in zoom-in-95 max-h-[95vh] flex flex-col">
        {/* Top Header - Oculto na Impressão */}
        <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-zinc-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-white">
                KUBOSTUDIO Logística
              </span>
              <span className="text-xs font-mono font-bold text-zinc-500">
                Pedido #{orderShortId}
              </span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mt-0.5">
              Etiqueta de Envio & Declaração de Conteúdo
            </h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer size={15} />
              <span>Imprimir Agora</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 rounded-xl hover:bg-zinc-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Opções de Impressão - Oculto na Impressão */}
        <div className="no-print bg-zinc-50 p-3 rounded-2xl border border-zinc-100 my-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700">Formato da Folha:</span>
            <button
              type="button"
              onClick={() => setFormat('a4')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                format === 'a4'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-700 border border-zinc-200'
              }`}
            >
              Folha A4 (Padrão)
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                format === 'thermal'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-700 border border-zinc-200'
              }`}
            >
              Térmica (10x15cm)
            </button>
          </div>

          <label className="flex items-center gap-2 font-medium text-zinc-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDeclaration}
              onChange={(e) => setIncludeDeclaration(e.target.checked)}
              className="rounded text-zinc-900 focus:ring-zinc-900"
            />
            <span>Incluir Declaração de Conteúdo Oficial</span>
          </label>
        </div>

        {/* Área Imprimível (Visível na tela e impressa no papel) */}
        <div id="print-area" className="overflow-y-auto flex-1 p-2 space-y-6 text-zinc-900">
          {/* =================================================================== */}
          {/* BLOCO 1: ETIQUETA DE POSTAGEM (PADRÃO CORREIOS / TRANSPORTADORAS)   */}
          {/* =================================================================== */}
          <div className="border-2 border-black rounded-xl p-4 max-w-md mx-auto bg-white font-sans text-xs">
            {/* Cabeçalho da Etiqueta */}
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-3">
              <div>
                <span className="text-xl font-black tracking-wider text-black block">KUBOSTUDIO</span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight block">
                  Criações & Peças 3D Exclusivas
                </span>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 border border-black font-black text-xs uppercase bg-black text-white rounded">
                  {(order as any).shippingService || 'ENCOMENDA'}
                </span>
                <span className="block font-mono text-[10px] text-zinc-600 mt-0.5">
                  PED #{orderShortId}
                </span>
              </div>
            </div>

            {/* Simulação de Código de Barras do Pedido */}
            <div className="text-center py-2 border-b border-black mb-3">
              <div className="flex justify-center items-center h-10 gap-0.5 overflow-hidden">
                {[4, 2, 5, 1, 3, 2, 6, 1, 4, 2, 5, 1, 3, 4, 1, 6, 2, 3, 5, 1, 4, 2, 3, 1, 5, 2].map(
                  (width, idx) => (
                    <div
                      key={idx}
                      className="bg-black h-full"
                      style={{ width: `${width}px` }}
                    />
                  )
                )}
              </div>
              <span className="font-mono text-[11px] font-bold tracking-widest block mt-0.5">
                *{order.id.slice(0, 12).toUpperCase()}*
              </span>
            </div>

            {/* DESTINATÁRIO */}
            <div className="mb-4 bg-zinc-50 p-3 rounded-lg border border-black">
              <div className="font-black text-[11px] uppercase tracking-wider text-black mb-1 border-b border-zinc-300 pb-0.5">
                DESTINATÁRIO
              </div>
              <div className="text-sm font-bold text-black uppercase">{order.customerName}</div>
              <div className="text-xs text-black mt-1">
                {order.street}, nº {order.number} {order.complement ? `(${order.complement})` : ''}
              </div>
              <div className="text-xs text-black">
                Bairro: <strong>{order.neighborhood}</strong>
              </div>
              <div className="text-xs text-black font-semibold">
                {order.city} - {order.state}
              </div>
              <div className="mt-2 text-base font-black tracking-wider text-black bg-white p-1.5 border border-black rounded inline-block">
                CEP: {formattedCep}
              </div>
              {order.customerPhone && (
                <div className="text-[11px] text-zinc-600 mt-1">
                  Tel: {order.customerPhone}
                </div>
              )}
            </div>

            {/* REMETENTE */}
            <div className="pt-2 border-t-2 border-dashed border-black">
              <div className="font-bold text-[10px] uppercase text-zinc-600 mb-0.5">
                REMETENTE:
              </div>
              <div className="font-bold text-xs text-black">KUBOSTUDIO (Kubo Studio 3D)</div>
              <div className="text-[11px] text-black">
                Rua do Ateliê, Ateliê de Criação 3D - Guarulhos / SP
              </div>
              <div className="text-[11px] font-bold text-black">
                CEP: 07133-300 | E-mail: contato@kubostudio.com.br
              </div>
            </div>
          </div>

          {/* Linha de Corte se incluir declaração na mesma folha */}
          {includeDeclaration && (
            <div className="border-t-2 border-dashed border-zinc-400 my-6 pt-2 text-center text-[10px] text-zinc-400 font-mono">
              - - - - - - - - - - - - - - - - - - ✂ CORTAR AQUI ✂ - - - - - - - - - - - - - - - - - -
            </div>
          )}

          {/* =================================================================== */}
          {/* BLOCO 2: DECLARAÇÃO DE CONTEÚDO OFICIAL (EXIGÊNCIA DOS CORREIOS)    */}
          {/* =================================================================== */}
          {includeDeclaration && (
            <div className="border-2 border-black p-4 bg-white text-black font-sans text-xs max-w-2xl mx-auto rounded-lg">
              <div className="text-center pb-2 border-b-2 border-black mb-3">
                <h4 className="text-sm font-black uppercase tracking-wider">
                  DECLARAÇÃO DE CONTEÚDO
                </h4>
                <p className="text-[10px] text-zinc-600">
                  Documento em conformidade com o Protocolo ICMS 32/01 do CONFAZ para transporte de mercadorias
                </p>
              </div>

              {/* Tabela de Remetente e Destinatário */}
              <div className="grid grid-cols-2 gap-3 mb-3 border border-black p-2 rounded">
                <div>
                  <div className="font-bold text-[10px] uppercase border-b border-black pb-0.5 mb-1">
                    1. REMETENTE
                  </div>
                  <div><strong>Nome:</strong> KUBOSTUDIO</div>
                  <div><strong>Cidade/UF:</strong> Guarulhos / SP</div>
                  <div><strong>CEP:</strong> 07133-300</div>
                </div>
                <div>
                  <div className="font-bold text-[10px] uppercase border-b border-black pb-0.5 mb-1">
                    2. DESTINATÁRIO
                  </div>
                  <div><strong>Nome:</strong> {order.customerName}</div>
                  <div><strong>Endereço:</strong> {order.street}, {order.number}</div>
                  <div><strong>Cidade/UF:</strong> {order.city}/{order.state} - <strong>CEP:</strong> {formattedCep}</div>
                </div>
              </div>

              {/* Tabela de Itens */}
              <div className="mb-3">
                <div className="font-bold text-[10px] uppercase mb-1">
                  3. DISCRIMINAÇÃO DO CONTEÚDO
                </div>
                <table className="w-full border-collapse border border-black text-left text-[11px]">
                  <thead>
                    <tr className="bg-zinc-100 border-b border-black">
                      <th className="border border-black p-1.5">Item</th>
                      <th className="border border-black p-1.5">Conteúdo / Descrição do Produto</th>
                      <th className="border border-black p-1.5 text-center">Qtd</th>
                      <th className="border border-black p-1.5 text-right">Valor Unit. (R$)</th>
                      <th className="border border-black p-1.5 text-right">Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                        <td className="border border-black p-1.5 font-medium">
                          {item.productNameSnapshot}
                          {item.skuSnapshot ? ` (${item.skuSnapshot})` : ''}
                        </td>
                        <td className="border border-black p-1.5 text-center">{item.quantity}</td>
                        <td className="border border-black p-1.5 text-right">
                          {Number(item.unitPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="border border-black p-1.5 text-right font-bold">
                          {Number(item.subtotal || (Number(item.unitPrice) * Number(item.quantity)) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-zinc-50 font-bold border-t-2 border-black">
                      <td colSpan={2} className="border border-black p-1.5 text-right">
                        TOTAIS:
                      </td>
                      <td className="border border-black p-1.5 text-center">{totalQuantity} un</td>
                      <td className="border border-black p-1.5"></td>
                      <td className="border border-black p-1.5 text-right font-black">
                        R$ {Number(itemsTotalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Termo de Declaração Legal */}
              <div className="border border-black p-2 text-[9px] leading-tight text-zinc-700 mb-4 rounded">
                <strong>DECLARAÇÃO:</strong> Declaro que não me enquadro no conceito de contribuinte previsto no art. 4º da Lei Complementar nº 87/1996, e que este envio não constitui ato de mercancia ou circulação de mercadorias com fins comerciais sujeitas ao ICMS. Assumo a responsabilidade pelas informações prestadas.
              </div>

              {/* Assinatura */}
              <div className="flex justify-between items-end pt-4 text-[10px]">
                <div>
                  Data: <strong>{orderDate}</strong>
                </div>
                <div className="text-center">
                  <div className="w-56 border-b border-black mb-1"></div>
                  <span>Assinatura do Remetente (KUBOSTUDIO)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
