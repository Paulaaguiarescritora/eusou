import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { Product, Channel } from '../types';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Calculator,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  Layers,
  Store,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  Search,
} from 'lucide-react';

interface PricingProfile {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isDefault: boolean;
  defaultTargetMargin: number | string;
  taxRate: number | string;
  packagingCost: number | string;
  roundingRule: 'NONE' | 'DECIMAL_2' | 'ENDS_90' | 'ENDS_99';
  isActive: boolean;
  channelRules: PricingChannelRule[];
  _count?: { productChannelPrices: number };
}

interface PricingChannelRule {
  id: string;
  channelId: string;
  channel?: { id: string; name: string; type: string };
  commissionPercent: number | string;
  fixedCost: number | string;
  otherPercent: number | string;
  otherFixedCost: number | string;
  roundingRule?: string;
  tiers: PricingRuleTier[];
}

interface PricingRuleTier {
  id: string;
  name?: string;
  minPrice: number | string;
  maxPrice: number | string;
  commissionPercent: number | string;
  fixedCost: number | string;
  priority: number;
  isActive: boolean;
}

interface ProductPriceItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku?: string; basePrice?: number };
  variant?: { id: string; sku?: string; name?: string; price?: number };
  channel?: { id: string; name: string; type: string };
  pricingProfile?: { id: string; name: string };
  mode: 'AUTOMATIC' | 'MANUAL';
  costBasis: number | string;
  calculatedPrice: number | string;
  manualPrice?: number | string | null;
  effectivePrice: number | string;
  netMargin?: number | string;
  netProfit?: number | string;
}

export const AdminPricingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'channels' | 'products' | 'simulator'>('profiles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data states
  const [profiles, setProfiles] = useState<PricingProfile[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [productPrices, setProductPrices] = useState<ProductPriceItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState('');

  // Simulator Form
  const [simProductId, setSimProductId] = useState('');
  const [simChannelId, setSimChannelId] = useState('');
  const [simProfileId, setSimProfileId] = useState('');
  const [simCostOverride, setSimCostOverride] = useState('');
  const [simMarginOverride, setSimMarginOverride] = useState('');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Edit / Override Modal
  const [editingPriceItem, setEditingPriceItem] = useState<ProductPriceItem | null>(null);
  const [manualPriceInput, setManualPriceInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, chanRes, pricesRes, prodRes] = await Promise.all([
        fetchApi<PricingProfile[]>('/pricing/profiles').catch(() => []),
        fetchApi<Channel[]>('/admin/marketplaces/channels').catch(() => []),
        fetchApi<ProductPriceItem[]>('/pricing/products').catch(() => []),
        fetchApi<{ data: Product[] }>('/products?limit=100').catch(() => ({ data: [] })),
      ]);
      setProfiles(profRes || []);
      setChannels(chanRes || []);
      setProductPrices(pricesRes || []);
      setProducts(prodRes.data || []);
      if (profRes && profRes.length > 0 && !simProfileId) {
        setSimProfileId(profRes[0].id);
      }
      if (chanRes && chanRes.length > 0 && !simChannelId) {
        setSimChannelId(chanRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados de precificação');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simProductId || !simChannelId) {
      alert('Selecione um produto e um canal para simular.');
      return;
    }
    setSimulating(true);
    setError(null);
    try {
      const payload: any = {
        productId: simProductId,
        channelId: simChannelId,
        pricingProfileId: simProfileId || undefined,
      };
      if (simCostOverride) payload.costOverride = Number(simCostOverride);
      if (simMarginOverride) payload.targetMarginOverride = Number(simMarginOverride) / 100;

      const res = await fetchApi('/pricing/simulate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSimResult(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao simular preço');
    } finally {
      setSimulating(false);
    }
  };

  const handleSaveManualPrice = async () => {
    if (!editingPriceItem) return;
    try {
      const newPrice = Number(manualPriceInput);
      if (isNaN(newPrice) || newPrice <= 0) {
        alert('Informe um valor de preço válido.');
        return;
      }
      await fetchApi('/pricing/manual', {
        method: 'POST',
        body: JSON.stringify({
          productId: editingPriceItem.productId,
          variantId: editingPriceItem.variant?.id,
          channelId: editingPriceItem.channel?.id,
          manualPrice: newPrice,
          reason: 'Definição manual pelo administrador',
        }),
      });
      setSuccess('Preço manual fixado com sucesso!');
      setEditingPriceItem(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao definir preço manual');
    }
  };

  const handleRestoreAutomatic = async (item: ProductPriceItem) => {
    if (!confirm('Deseja restaurar este produto para o Preço Calculado Automático?')) return;
    try {
      await fetchApi(`/pricing/manual/${item.id}`, { method: 'DELETE' });
      setSuccess('Produto restaurado para Preço Automático!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao restaurar modo automático');
    }
  };

  const filteredPrices = productPrices.filter((p) => {
    if (!searchProduct.trim()) return true;
    const name = p.product?.name?.toLowerCase() || '';
    const sku = p.product?.sku?.toLowerCase() || '';
    const query = searchProduct.toLowerCase().trim();
    return name.includes(query) || sku.includes(query);
  });

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-900 border border-amber-500/20">
              Motor de Precificação
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-600" /> Gestão de Precificação & Margens
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitore custos reais de produção, margens alvo, taxas de canais de venda e regras de arredondamento.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('profiles')}
          className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'profiles'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" /> Perfis de Precificação ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'channels'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="w-4 h-4" /> Regras por Canal ({channels.length})
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'products'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Preços de Produtos ({productPrices.length})
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'simulator'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" /> Simulador de Preço
        </button>
      </div>

      {/* 1. ABA: PERFIS DE PRECIFICAÇÃO */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-slate-900">{p.name}</h3>
                      {p.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-900">
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.description || 'Sem descrição'}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Margem Alvo</span>
                    <span className="font-bold text-slate-800">
                      {(Number(p.defaultTargetMargin) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Impostos</span>
                    <span className="font-bold text-slate-800">
                      {(Number(p.taxRate) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Custo Embalagem</span>
                    <span className="font-bold text-slate-800">
                      R$ {Number(p.packagingCost).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Arredondamento</span>
                    <span className="font-bold text-slate-800">
                      {p.roundingRule === 'ENDS_90' ? 'Final ,90' : p.roundingRule === 'ENDS_99' ? 'Final ,99' : 'Decimal 2'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{p.channelRules?.length || 0} regras de canal</span>
                  <span>{p._count?.productChannelPrices || 0} produtos vinculados</span>
                </div>
              </div>
            ))}
          </div>

          {profiles.length === 0 && !loading && (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Nenhum perfil de precificação cadastrado.
            </div>
          )}
        </div>
      )}

      {/* 2. ABA: REGRAS POR CANAL & FAIXAS */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          {profiles.map((prof) => (
            <div key={prof.id} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Perfil: {prof.name}</h3>
                  <p className="text-xs text-slate-500">Regras e comissões associadas a este perfil comercial</p>
                </div>
              </div>

              {prof.channelRules && prof.channelRules.length > 0 ? (
                <div className="space-y-4">
                  {prof.channelRules.map((cr) => (
                    <div key={cr.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-amber-600" />
                          <h4 className="font-bold text-xs text-slate-900">
                            {cr.channel?.name || 'Canal'} ({cr.channel?.type || 'GERAL'})
                          </h4>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span>Comissão Base: <strong>{(Number(cr.commissionPercent) * 100).toFixed(1)}%</strong></span>
                          <span>Taxa Fixa: <strong>R$ {Number(cr.fixedCost).toFixed(2).replace('.', ',')}</strong></span>
                        </div>
                      </div>

                      {/* Tiers / Faixas */}
                      {cr.tiers && cr.tiers.length > 0 && (
                        <div className="mt-2 bg-white rounded-lg border border-slate-200 overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100/70 text-[10px] uppercase font-bold text-slate-500">
                              <tr>
                                <th className="p-2.5">Faixa de Preço</th>
                                <th className="p-2.5">Nome / Rótulo</th>
                                <th className="p-2.5">Comissão Específica</th>
                                <th className="p-2.5">Custo Fixo</th>
                                <th className="p-2.5 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {cr.tiers.map((t) => (
                                <tr key={t.id}>
                                  <td className="p-2.5 font-bold text-slate-800">
                                    R$ {Number(t.minPrice).toFixed(2).replace('.', ',')} — {Number(t.maxPrice) >= 999999 ? 'Sem Limite' : `R$ ${Number(t.maxPrice).toFixed(2).replace('.', ',')}`}
                                  </td>
                                  <td className="p-2.5 text-slate-600">{t.name || '-'}</td>
                                  <td className="p-2.5 font-semibold text-slate-900">
                                    {(Number(t.commissionPercent) * 100).toFixed(1)}%
                                  </td>
                                  <td className="p-2.5 font-semibold text-slate-900">
                                    R$ {Number(t.fixedCost).toFixed(2).replace('.', ',')}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                      Ativa
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Nenhuma regra de canal cadastrada para este perfil.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. ABA: PREÇOS DE PRODUTOS */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Buscar produto ou SKU..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {filteredPrices.length} preço(s) registrado(s)
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Produto</th>
                    <th className="py-3 px-4">Canal</th>
                    <th className="py-3 px-4">Modo</th>
                    <th className="py-3 px-4">Custo Base</th>
                    <th className="py-3 px-4">Preço Calculado</th>
                    <th className="py-3 px-4">Preço Manual</th>
                    <th className="py-3 px-4 font-black">Preço Efetivo</th>
                    <th className="py-3 px-4">Margem Líquida</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPrices.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.product?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          SKU: {item.variant?.sku || item.product?.sku || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {item.channel?.name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.mode === 'MANUAL'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {item.mode === 'MANUAL' ? 'Manual' : 'Automático'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        R$ {Number(item.costBasis).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        R$ {Number(item.calculatedPrice).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-700">
                        {item.manualPrice ? `R$ ${Number(item.manualPrice).toFixed(2).replace('.', ',')}` : '-'}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 text-sm">
                        R$ {Number(item.effectivePrice).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {item.netMargin ? `${(Number(item.netMargin) * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingPriceItem(item);
                            setManualPriceInput(String(item.effectivePrice));
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold transition"
                        >
                          Editar Manual
                        </button>
                        {item.mode === 'MANUAL' && (
                          <button
                            onClick={() => handleRestoreAutomatic(item)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-bold transition"
                          >
                            Voltar Automático
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredPrices.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                        Nenhum registro de preço de canal encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. ABA: SIMULADOR DE PREÇO */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário de Simulação */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" /> Parâmetros de Simulação
            </h3>
            <p className="text-xs text-slate-500">
              O simulador executa o motor matemático em tempo real sem persistir alterações no banco.
            </p>

            <form onSubmit={handleSimulate} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Produto *</label>
                <select
                  required
                  value={simProductId}
                  onChange={(e) => setSimProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
                >
                  <option value="">Selecione um produto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku || 'N/A'}) - Base: R$ {Number(p.basePrice || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Canal de Venda *</label>
                <select
                  required
                  value={simChannelId}
                  onChange={(e) => setSimChannelId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
                >
                  <option value="">Selecione o canal...</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil de Precificação</label>
                <select
                  value={simProfileId}
                  onChange={(e) => setSimProfileId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
                >
                  <option value="">Usar perfil padrão...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isDefault ? '(Padrão)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Sobrescrito (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Opcional (Usa F7 se vazio)"
                    value={simCostOverride}
                    onChange={(e) => setSimCostOverride(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Margem Alvo (%)</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="Ex: 25"
                    value={simMarginOverride}
                    onChange={(e) => setSimMarginOverride(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                {simulating ? 'Calculando...' : 'Executar Simulação'}
              </button>
            </form>
          </div>

          {/* Resultado da Simulação */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Resultado do Cálculo Matemático</h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
              <span className="font-bold block">Aviso:</span>
              Simulação de teste — nenhuma alteração é persistida no catálogo ou canais.
            </div>

            {simResult ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-bold block">Preço Final Calculado</span>
                    <span className="text-2xl font-black text-slate-900">
                      R$ {Number(simResult.calculatedPrice).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 uppercase font-bold block">Margem Líquida</span>
                    <span className="text-lg font-black text-emerald-600">
                      {(Number(simResult.netMargin) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Custo Total de Produção & Envio:</span>
                    <strong className="text-slate-800">R$ {Number(simResult.cost).toFixed(2).replace('.', ',')}</strong>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Lucro Líquido Estimado:</span>
                    <strong className="text-emerald-700">R$ {Number(simResult.netProfit).toFixed(2).replace('.', ',')}</strong>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Faixa Aplicada:</span>
                    <span className="text-slate-700 font-mono">{simResult.appliedTierName || 'Regra Base do Canal'}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Regra de Arredondamento:</span>
                    <span className="text-slate-700">{simResult.roundingRule || 'Conforme Perfil'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Preencha os dados e execute a simulação para visualizar o detalhamento matemático.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Editar Preço Manual */}
      {editingPriceItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900">Definir Preço Manual</h3>
            <p className="text-xs text-slate-500">
              Produto: <strong>{editingPriceItem.product?.name}</strong> no canal{' '}
              <strong>{editingPriceItem.channel?.name}</strong>.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200">
              Preço Calculado pelo Motor: <strong>R$ {Number(editingPriceItem.calculatedPrice).toFixed(2).replace('.', ',')}</strong>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Novo Preço Manual (R$)</label>
              <input
                type="number"
                step="0.01"
                value={manualPriceInput}
                onChange={(e) => setManualPriceInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPriceItem(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveManualPrice}
                className="flex-1 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition"
              >
                Salvar Preço
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
