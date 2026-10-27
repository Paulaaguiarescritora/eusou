import React, { useEffect, useState } from 'react';
import { InventoryItem, StockMovement, Product } from '../types';
import { fetchApi } from '../api';
import { 
  Package, 
  ArrowDownRight, 
  ArrowUpRight, 
  RotateCcw, 
  Sliders, 
  AlertTriangle, 
  Search, 
  Plus, 
  CheckCircle2, 
  Layers,
  TrendingDown
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Manual Adjust Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustMode, setAdjustMode] = useState<'DELTA' | 'SET'>('DELTA');
  const [adjustReason, setAdjustReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, movRes, prodRes] = await Promise.all([
        fetchApi<{ data: InventoryItem[]; summary?: any }>(`/admin/inventory?limit=200&lowStockOnly=${lowStockOnly}`),
        fetchApi<{ data: StockMovement[] }>('/admin/inventory/movements'),
        fetchApi<{ data: Product[] }>('/products?limit=100'),
      ]);
      setItems(invRes.data || []);
      if (invRes.summary) setSummary(invRes.summary);
      setMovements(movRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Error fetching inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [lowStockOnly]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          variantId: selectedVariantId || undefined,
          quantity: Number(adjustQuantity),
          mode: adjustMode,
          reason: adjustReason,
        }),
      });
      setShowAdjustModal(false);
      setAdjustReason('');
      setAdjustQuantity(0);
      setSelectedVariantId('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao realizar ajuste de estoque');
    }
  };

  const filteredItems = items.filter(
    (i) =>
      i.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      i.product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
      i.variant?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white">
              Logística & Armazém
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
            Controle de Estoque & Movimentações
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Acompanhe o saldo físico em tempo real, saídas por vendas, entradas da fabricação e rastreabilidade total
          </p>
        </div>

        <button
          onClick={() => setShowAdjustModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition shadow-sm"
        >
          <Sliders size={16} /> Ajuste Manual de Estoque
        </button>
      </div>

      {/* KPI CARDS: VALORAÇÃO PATRIMONIAL E CUSTO REAL DO ESTOQUE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              <span>Patrimônio Total</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">Total Geral</span>
            </div>
            <div className="text-2xl font-black text-zinc-900 mt-1">
              R$ {Number(summary?.totalValuation || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Produtos Acabados (R$ {Number(summary?.totalCostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) + Insumos/Filamentos (R$ {Number(summary?.materialsCostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              <span>Produtos a Custo</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px]">{summary?.totalAvailableQuantity || items.reduce((acc, i) => acc + (i.availableQuantity || 0), 0)} peças</span>
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              R$ {Number(summary?.totalCostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Custo real investido nos produtos finalizados e prontos para envio.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              <span>Insumos & Filamentos</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-bold text-[10px]">Matéria-Prima</span>
            </div>
            <div className="text-2xl font-black text-cyan-700 mt-1">
              R$ {Number(summary?.materialsCostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Bobinas de filamento (PLA), embalagens, argolas e suprimentos 3D.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              <span>Potencial de Venda</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px]">Varejo</span>
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-1">
              R$ {Number(summary?.totalRetailValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Projeção de faturamento bruto na venda de 100% dos produtos do estoque.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 gap-6 mb-6">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'stock'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Package size={18} />
          Saldos de Produtos ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'movements'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <RotateCcw size={18} />
          Histórico de Movimentações ({movements.length})
        </button>
      </div>

      {/* TAB: STOCK */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-zinc-200 max-w-md flex-1">
              <Search size={18} className="text-zinc-400 ml-2" />
              <input
                type="text"
                placeholder="Buscar por produto ou SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm outline-none bg-transparent"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer bg-white px-3 py-2 rounded-xl border border-zinc-200 select-none">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              Apenas Estoque Baixo (Alerta)
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Produto / Variante</th>
                  <th className="px-6 py-3.5">SKU</th>
                  <th className="px-6 py-3.5">Físico</th>
                  <th className="px-6 py-3.5">Reservado</th>
                  <th className="px-6 py-3.5">Disponível</th>
                  <th className="px-6 py-3.5">Mínimo</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-900">{item.product?.name}</div>
                      {item.variant && (
                        <div className="text-xs text-zinc-500">{item.variant.name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-600">
                      {item.variant?.sku || item.product?.sku || '-'}
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-900">{item.quantity}</td>
                    <td className="px-6 py-4 text-zinc-500">{item.reservedQuantity}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${item.availableQuantity === 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                        {item.availableQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{item.minimumQuantity}</td>
                    <td className="px-6 py-4 text-right">
                      {item.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          <AlertTriangle size={12} /> Estoque Baixo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          <CheckCircle2 size={12} /> Regular
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-zinc-500">
                      Nenhum produto em estoque encontrado. Realize uma produção ou ajuste manual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Data / Hora</th>
                <th className="px-6 py-3.5">Produto</th>
                <th className="px-6 py-3.5">Tipo</th>
                <th className="px-6 py-3.5">Quantidade</th>
                <th className="px-6 py-3.5">Origem / Referência</th>
                <th className="px-6 py-3.5">Motivo Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-zinc-50/60 transition">
                  <td className="px-6 py-4 text-xs text-zinc-500">
                    {new Date(mov.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 font-semibold text-zinc-900">{mov.product?.name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                        mov.type === 'IN'
                          ? 'bg-green-100 text-green-800'
                          : mov.type === 'OUT'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      {mov.type === 'IN' && <ArrowDownRight size={12} />}
                      {mov.type === 'OUT' && <ArrowUpRight size={12} />}
                      {mov.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-zinc-900">
                    {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-600 font-mono">
                    {mov.referenceType || 'MANUAL'}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-700">{mov.reason}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-zinc-500">
                    Nenhuma movimentação histórica de estoque registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: AJUSTE MANUAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Ajuste Manual de Estoque</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Qualquer alteração física exige declaração formal do motivo para auditoria.
            </p>
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Produto</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId('');
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">Selecione o produto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProductId && products.find((p) => p.id === selectedProductId)?.variants && (products.find((p) => p.id === selectedProductId)!.variants || []).length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                    Variante / Cor Específica
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="">Estoque Geral do Produto (sem variante)</option>
                    {products
                      .find((p) => p.id === selectedProductId)!
                      .variants!.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name || 'Variante'} ({v.sku || v.id.slice(0, 8)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Modo</label>
                  <select
                    value={adjustMode}
                    onChange={(e) => setAdjustMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="DELTA">Adicionar/Remover (+/-)</option>
                    <option value="SET">Definir Saldo Exato</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Quantidade</label>
                  <input
                    type="number"
                    required
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Motivo do Ajuste</label>
                <textarea
                  required
                  rows={2}
                  placeholder="ex: Contagem física do inventário mensal, perda por quebra..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
