import React, { useState, useEffect } from 'react';
import { fetchApi } from '../api';
import {
  CommercialDashboardData,
  CommercialAlert,
  AlertSeverity,
} from '../types';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Package,
  Boxes,
  Cpu,
  Store,
  Users,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  DollarSign,
  Plus,
  Layers,
  BookOpen,
  Sliders,
  X,
} from 'lucide-react';

interface CommercialDashboardViewProps {
  onNavigate: (route: string) => void;
  token?: string;
}

export const CommercialDashboardView: React.FC<CommercialDashboardViewProps> = ({
  onNavigate,
  token,
}) => {
  const [data, setData] = useState<CommercialDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d'>('30d');
  const [error, setError] = useState<string | null>(null);

  // Estado para correção de estoque direto no local (sem sair do dashboard)
  const [inlineAdjustItem, setInlineAdjustItem] = useState<{
    productId: string;
    variantId?: string;
    productName: string;
    available: number;
    minimum: number;
  } | null>(null);
  const [inlineNewQuantity, setInlineNewQuantity] = useState<number>(0);
  const [inlineNewMinimum, setInlineNewMinimum] = useState<number>(1);
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchApi<CommercialDashboardData>(`/admin/dashboard/summary?period=${period}`);
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao consultar dados da operação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const handleOpenInlineAdjust = (item: {
    productId: string;
    variantId?: string;
    productName: string;
    available: number;
    minimum: number;
  }) => {
    setInlineAdjustItem(item);
    setInlineNewQuantity(Math.max(0, item.available));
    setInlineNewMinimum(item.minimum ?? 1);
  };

  const handleInlineAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineAdjustItem) return;

    setInlineSubmitting(true);
    try {
      await fetchApi('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: inlineAdjustItem.productId,
          variantId: inlineAdjustItem.variantId || null,
          quantity: Number(inlineNewQuantity),
          minimumQuantity: Number(inlineNewMinimum),
          mode: 'SET',
          reason: 'Ajuste direto no local via Central Comercial',
        }),
      });
      showToast(`Estoque de "${inlineAdjustItem.productName}" corrigido com sucesso!`);
      setInlineAdjustItem(null);
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Erro ao corrigir estoque');
    } finally {
      setInlineSubmitting(false);
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertOctagon className="w-3 h-3 text-rose-600" /> CRÍTICO
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> ATENÇÃO
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3 h-3 text-blue-600" /> INFO
          </span>
        );
    }
  };

  const getHealthBanner = () => {
    if (!data?.health) return null;
    const { status, label, summary, counts } = data.health;

    let bgStyle = 'bg-emerald-50 border-emerald-300 text-emerald-950';
    let icon = <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />;

    if (status === 'CRITICAL') {
      bgStyle = 'bg-rose-50 border-rose-300 text-rose-950';
      icon = <AlertOctagon className="w-7 h-7 text-rose-600 shrink-0" />;
    } else if (status === 'WARNING') {
      bgStyle = 'bg-amber-50 border-amber-300 text-amber-950';
      icon = <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" />;
    }

    return (
      <div className={`p-5 rounded-2xl border ${bgStyle} shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          {icon}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/70">
                STATUS OPERACIONAL
              </span>
              <h2 className="text-lg font-black tracking-tight">{label}</h2>
            </div>
            <p className="text-xs text-slate-600 mt-1">{summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold shrink-0">
          <div className="px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/60 shadow-2xs">
            Críticos: <strong className="text-rose-600">{counts.critical}</strong>
          </div>
          <div className="px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/60 shadow-2xs">
            Atenção: <strong className="text-amber-600">{counts.warning}</strong>
          </div>
          <div className="px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/60 shadow-2xs">
            Total Alertas: <strong>{counts.total}</strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Central de Operação Comercial
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visão unificada em tempo real: vendas, pedidos, estoques, produção e marketplaces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de Período */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            {(['today', '7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  period === p
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {p === 'today' ? 'Hoje' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboard}
            disabled={loading}
            title="Atualizar Indicadores"
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-700 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold">
          {error}
        </div>
      )}

      {/* Banner de Saúde Operacional */}
      {getHealthBanner()}

      {/* AÇÕES RÁPIDAS DA OPERAÇÃO */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition text-xs shadow-2xs group cursor-pointer"
          title="Abrir a Loja Própria em nova aba"
        >
          <Store className="w-3.5 h-3.5" />
          <span>Ver Loja</span>
          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </a>
        <button
          onClick={() => onNavigate('/admin/orders')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs cursor-pointer"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /> Ver Pedidos
        </button>
        <button
          onClick={() => onNavigate('/admin/products/new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-600" /> Adicionar Produto
        </button>
        <button
          onClick={() => onNavigate('/admin/catalogs/new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Criar Catálogo
        </button>
        <button
          onClick={() => onNavigate('/admin/inventory')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs cursor-pointer"
        >
          <Boxes className="w-3.5 h-3.5 text-amber-600" /> Ver Estoque
        </button>
        <button
          onClick={() => onNavigate('/admin/production')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs cursor-pointer"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-600" /> Produção 3D
        </button>
        <button
          onClick={() => onNavigate('/admin/marketplaces')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs cursor-pointer"
        >
          <Store className="w-3.5 h-3.5 text-purple-600" /> Hub de Canais
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SEÇÃO DE DESTAQUE MÁXIMO NO TOPO: VENDAS & FATURAMENTO                 */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0 shadow-inner">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                    Performance Comercial & Receita
                  </span>
                  {data?.sales.growthPercent !== null && data?.sales.growthPercent !== undefined ? (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-0.5 ${
                        data.sales.growthPercent >= 0
                          ? 'text-emerald-300 bg-emerald-500/20 border-emerald-400/30'
                          : 'text-rose-300 bg-rose-500/20 border-rose-400/30'
                      }`}
                    >
                      {data.sales.growthPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {data.sales.growthPercent > 0 ? `+${data.sales.growthPercent}%` : `${data.sales.growthPercent}%`} vs anterior
                    </span>
                  ) : null}
                </div>
                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  Faturamento: <span className="text-emerald-300">R$ {data?.sales.totalRevenue || '0,00'}</span>
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigate('/admin/orders')}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Ver Pedidos ({data?.sales.orderCount || 0})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('/admin/marketplaces')}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition border border-white/10 flex items-center gap-2 cursor-pointer"
              >
                <span>Canais & Afiliados</span>
              </button>
            </div>
          </div>

          {/* Grid de 4 Grandes Indicadores de Vendas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* 1. FATURAMENTO TOTAL DO PERÍODO */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Total Faturado</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black">
                  {period === 'today' ? 'Hoje' : period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : '90 dias'}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight my-1">
                R$ {data?.sales.totalRevenue || '0,00'}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Hoje: <strong>R$ {data?.sales.periods.today.revenue || '0,00'}</strong> | 7d: <strong>R$ {data?.sales.periods.days7.revenue || '0,00'}</strong>
              </p>
            </div>

            {/* 2. VOLUME DE PEDIDOS */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Volume de Pedidos</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-black">
                  {data?.sales.orderCount || 0} pedidos
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-300 tracking-tight my-1">
                {data?.sales.orderCount || 0} <span className="text-sm font-semibold text-slate-400">aprovados</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Hoje: <strong>{data?.sales.periods.today.orders || 0}</strong> | 7 dias: <strong>{data?.sales.periods.days7.orders || 0}</strong>
              </p>
            </div>

            {/* 3. TICKET MÉDIO */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Ticket Médio</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black">Médio</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight my-1">
                R$ {data?.sales.averageTicket || '0,00'}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Receita média por pedido faturado em todos os canais de venda.
              </p>
            </div>

            {/* 4. CANAIS & ORIGEM DE RECEITA */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Origem das Vendas</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-black">Canais</span>
              </div>
              <div className="text-lg font-black text-white tracking-tight my-1 space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-300">Loja Própria:</span>
                  <span className="text-emerald-300">R$ {data?.sales.originBreakdown.ownStore || '0,00'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-300">Marketplaces:</span>
                  <span className="text-purple-300">R$ {data?.sales.originBreakdown.marketplace || '0,00'}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Afiliados: R$ {data?.sales.originBreakdown.affiliate || '0,00'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CENTRO DE ATENÇÃO OPERACIONAL / PONTOS CRÍTICOS COM CORREÇÃO NO LOCAL   */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Centro de Atenção Operacional (Pontos Críticos)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {data?.alerts.length || 0} ações prioritárias identificadas
          </span>
        </div>

        {data?.alerts && data.alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.alerts.map((al: CommercialAlert) => {
              const isInventoryAlert =
                al.entityRelated === 'Inventory' ||
                al.type === 'STOCK_OUT' ||
                al.type === 'STOCK_LOW';

              return (
                <div
                  key={al.id}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(al.severity)}
                      <span className="text-[10px] text-slate-400 font-bold">
                        {al.entityRelated}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{al.title}</h4>
                    <p className="text-[11px] text-slate-600 line-clamp-2">{al.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botão de Corrigir no Local direto quando for estoque */}
                    {isInventoryAlert && (
                      <button
                        type="button"
                        onClick={() => {
                          // Se tiver entityId ou encontrar nos itens críticos, abre ajuste direto
                          const matchedCrit = data?.inventory.criticalItems.find(
                            (c) => al.title.includes(c.productName),
                          );
                          if (matchedCrit) {
                            handleOpenInlineAdjust(matchedCrit);
                          } else {
                            onNavigate('/admin/inventory');
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Corrigir saldo físico e estoque mínimo no local"
                      >
                        <Sliders size={12} />
                        <span>Corrigir</span>
                      </button>
                    )}

                    <button
                      onClick={() => onNavigate(al.actionUrl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer ${
                        isInventoryAlert
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {al.recommendedAction} <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhum alerta pendente no momento. Toda a operação está em conformidade.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. SESSÃO DO ESTOQUE & VALORAÇÃO PATRIMONIAL (COLOCADA EMBAIXO DE VENDAS) */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0 shadow-inner">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                    Patrimônio & Valoração de Estoque
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                    Produtos + Insumos
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                  Valor Total do Estoque: <span className="text-amber-300">R$ {Number(data?.inventory.totalValuation || data?.inventory.totalCostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigate('/admin/inventory')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Boxes className="w-4 h-4" />
                <span>Estoque de Produtos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('/admin/materials')}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition border border-white/10 flex items-center gap-2 cursor-pointer"
              >
                <span>Insumos & Filamentos</span>
              </button>
            </div>
          </div>

          {/* Grid de 4 Indicadores do Estoque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* 1. PRODUTOS ACABADOS A CUSTO */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Produtos Acabados</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black">
                  {data?.inventory.availableQuantity || 0} un
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight my-1">
                R$ {Number(data?.inventory.totalCostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Custo de fabricação e insumos alocados em produtos prontos na prateleira.
              </p>
            </div>

            {/* 2. MATÉRIA-PRIMA & FILAMENTOS */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Insumos & Filamentos</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-black">
                  3D & Embalagens
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-300 tracking-tight my-1">
                R$ {Number(data?.inventory.materialsCostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Estoque ativo de bobinas de filamento (PLA), embalagens, argolas e componentes.
              </p>
            </div>

            {/* 3. VALOR A PREÇO DE VENDA */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Potencial de Venda</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black">
                  Varejo
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight my-1">
                R$ {Number(data?.inventory.totalRetailValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Faturamento bruto projetado com a venda total dos produtos disponíveis.
              </p>
            </div>

            {/* 4. MARGEM BRUTA PROJETADA */}
            <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Lucro Bruto Projetado</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-black">
                  Retorno
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight my-1">
                R$ {Number(data?.inventory.potentialProfit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Margem bruta estimada subtraindo o custo fabril do valor comercial.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SEÇÃO EM DUAS COLUNAS: SAÚDE DOS MARKETPLACES & ESTOQUE CRÍTICO         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saúde dos Marketplaces */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-slate-500" /> Saúde dos Marketplaces & Canais
            </h3>
            <button
              onClick={() => onNavigate('/admin/marketplaces')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              Gerenciar Canais &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data?.marketplaces.accounts && data.marketplaces.accounts.length > 0 ? (
              data.marketplaces.accounts.map((acc) => (
                <div key={acc.accountId} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{acc.accountName}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                        {acc.channelName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {acc.publishedCount} produtos publicados | {acc.recentOrdersCount} pedidos
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        acc.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {acc.status}
                    </span>
                    <button
                      onClick={() => onNavigate('/admin/marketplaces')}
                      className="block text-[11px] text-indigo-600 hover:underline font-bold mt-1 cursor-pointer"
                    >
                      Reconciliar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Nenhum canal conectado. Configure no Marketplace Hub.
              </div>
            )}
          </div>
        </div>

        {/* Estoque Crítico com Botão Corrigir no Local */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-500" /> Estoque Crítico & Correção no Local
            </h3>
            <button
              onClick={() => onNavigate('/admin/inventory')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              Ver Inventário Completo &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {data?.inventory.criticalItems && data.inventory.criticalItems.length > 0 ? (
              data.inventory.criticalItems.map((item) => (
                <div
                  key={item.variantId ? `${item.productId}-${item.variantId}` : `${item.productId}-${item.sku || 'base'}`}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h5 className="font-bold text-slate-900">{item.productName}</h5>
                    <p className="text-[11px] text-slate-500">
                      SKU: {item.sku || 'N/A'} | Mínimo: {item.minimum} unid.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[10px] ${
                        item.status === 'ESGOTADO'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.available} unid. ({item.status})
                    </span>

                    {/* Botão de Corrigir no Local */}
                    <button
                      type="button"
                      onClick={() => handleOpenInlineAdjust(item)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Corrigir saldo no local agora"
                    >
                      <Sliders size={12} />
                      <span>Corrigir</span>
                    </button>

                    <button
                      onClick={() => onNavigate('/admin/production')}
                      className="text-indigo-600 font-bold hover:underline text-[11px] cursor-pointer"
                    >
                      Produzir
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Nenhum item em estoque crítico no momento.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ÚLTIMOS PEDIDOS & ORIGEM DA RECEITA                                    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-500" /> Pedidos Recentes & Origem de Venda
          </h3>
          <button
            onClick={() => onNavigate('/admin/orders')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            Ver Todos os Pedidos &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead>
              <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Origem</th>
                <th className="py-2.5 px-3">Itens</th>
                <th className="py-2.5 px-3">Valor Total</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.recentOrders && data.recentOrders.length > 0 ? (
                data.recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3 font-bold text-slate-900">{ord.customerName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {ord.origin}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{ord.itemCount} unid.</td>
                    <td className="py-3 px-3 font-extrabold text-slate-900">R$ {ord.total}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {new Date(ord.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Você ainda não possui vendas registradas no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CORREÇÃO DIRETA DE ESTOQUE NO LOCAL (SEM SAIR DO DASHBOARD)        */}
      {/* ========================================================================= */}
      {inlineAdjustItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 border border-slate-100">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                    Correção Direta no Local
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 flex items-center gap-1">
                    <AlertTriangle size={10} /> Ponto Crítico
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {inlineAdjustItem.productName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInlineAdjustItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Informações atuais */}
            <div className="grid grid-cols-2 gap-3 mb-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">
                  Saldo Disponível Atual
                </span>
                <span className={`text-xl font-black ${inlineAdjustItem.available <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {inlineAdjustItem.available} un
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">
                  Estoque Mínimo de Alerta
                </span>
                <span className="text-xl font-black text-slate-700">
                  {inlineAdjustItem.minimum} un
                </span>
              </div>
            </div>

            <form onSubmit={handleInlineAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Novo Saldo Físico Real (Unidades)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInlineNewQuantity(Math.max(0, inlineNewQuantity - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-lg transition cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    required
                    value={inlineNewQuantity}
                    onChange={(e) => setInlineNewQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-base text-center text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setInlineNewQuantity(inlineNewQuantity + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-lg transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Estoque Mínimo de Alerta
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={inlineNewMinimum}
                  onChange={(e) => setInlineNewMinimum(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setInlineAdjustItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inlineSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {inlineSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>Salvar Correção</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
