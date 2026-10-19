import React, { useState, useEffect } from 'react';
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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const effectiveToken = token || localStorage.getItem('token') || '';

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/dashboard/summary?period=${period}`, {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Falha ao carregar métricas da Central Comercial');
      const json = await res.json();
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
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-700 shadow-2xs"
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
          onClick={() => onNavigate('/admin/products/new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-600" /> Adicionar Produto
        </button>
        <button
          onClick={() => onNavigate('/admin/catalogs/new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Criar Catálogo
        </button>
        <button
          onClick={() => onNavigate('/admin/orders')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /> Ver Pedidos
        </button>
        <button
          onClick={() => onNavigate('/admin/inventory')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs"
        >
          <Boxes className="w-3.5 h-3.5 text-amber-600" /> Ver Estoque
        </button>
        <button
          onClick={() => onNavigate('/admin/production')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-600" /> Produção 3D
        </button>
        <button
          onClick={() => onNavigate('/admin/marketplaces')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-xs font-bold text-slate-800 shadow-2xs"
        >
          <Store className="w-3.5 h-3.5 text-purple-600" /> Publicar no Marketplace
        </button>
      </div>

      {/* 1. CENTRO DE ATENÇÃO / AÇÕES PRIORITÁRIAS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Centro de Atenção Operacional
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {data?.alerts.length || 0} ações prioritárias identificadas
          </span>
        </div>

        {data?.alerts && data.alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.alerts.map((al: CommercialAlert) => (
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
                <button
                  onClick={() => onNavigate(al.actionUrl)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-2xs"
                >
                  {al.recommendedAction} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhum alerta pendente no momento. Toda a operação está em conformidade.
          </div>
        )}
      </div>

      {/* 2. CARDS PRINCIPAIS: VENDAS, PEDIDOS, PRODUTOS, ESTOQUE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vendas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Faturamento no Período
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              R$ {data?.sales.totalRevenue || '0,00'}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              {data?.sales.growthPercent !== null && data?.sales.growthPercent !== undefined ? (
                <span
                  className={`inline-flex items-center font-bold ${
                    data.sales.growthPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {data.sales.growthPercent >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  )}
                  {data.sales.growthPercent > 0 ? `+${data.sales.growthPercent}%` : `${data.sales.growthPercent}%`}
                </span>
              ) : (
                <span className="text-slate-400">Sem base anterior</span>
              )}
              <span className="text-slate-400">vs período anterior</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Ticket Médio: <strong>R$ {data?.sales.averageTicket || '0,00'}</strong></span>
            <span>Hoje: <strong>R$ {data?.sales.periods.today.revenue || '0,00'}</strong></span>
          </div>
        </div>

        {/* Pedidos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Volume de Pedidos
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {data?.sales.orderCount || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hoje: {data?.sales.periods.today.orders || 0} | 7d: {data?.sales.periods.days7.orders || 0}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px]">
            <button
              onClick={() => onNavigate('/admin/orders')}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              Ver Pedidos <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Estoque F7 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Estoque F7
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {data?.inventory.availableQuantity || 0}
              <span className="text-xs text-slate-400 font-medium ml-1">unidades</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Reservado: {data?.inventory.reservedQuantity || 0} unid.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px]">
            <span className="text-rose-600 font-bold">
              {data?.inventory.criticalCount || 0} esgotados
            </span>
            <button
              onClick={() => onNavigate('/admin/inventory')}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              Ver Estoque <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Marketplaces */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Canais & Marketplaces
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {data?.marketplaces.publishedCount || 0}
              <span className="text-xs text-slate-400 font-medium ml-1">anúncios</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data?.marketplaces.activeAccounts || 0} contas ativas conectadas
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px]">
            <span className="text-amber-600 font-bold">
              {data?.marketplaces.failedEvents || 0} eventos falhos
            </span>
            <button
              onClick={() => onNavigate('/admin/marketplaces')}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              Hub de Canais <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. SEÇÃO EM DUAS COLUNAS: SAÚDE DOS MARKETPLACES & ESTOQUE CRÍTICO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saúde dos Marketplaces */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-slate-500" /> Saúde dos Marketplaces & Canais
            </h3>
            <button
              onClick={() => onNavigate('/admin/marketplaces')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
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
                      className="block text-[11px] text-indigo-600 hover:underline font-bold mt-1"
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

        {/* Estoque Crítico & Produção */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-500" /> Estoque Crítico & Produção 3D
            </h3>
            <button
              onClick={() => onNavigate('/admin/production')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              Ordens de Produção &rarr;
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
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[10px] ${
                        item.status === 'ESGOTADO'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.available} unid. ({item.status})
                    </span>
                    <button
                      onClick={() => onNavigate('/admin/production')}
                      className="text-indigo-600 font-bold hover:underline text-[11px]"
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

      {/* 4. ÚLTIMOS PEDIDOS & ORIGEM DA RECEITA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-500" /> Pedidos Recentes & Origem de Venda
          </h3>
          <button
            onClick={() => onNavigate('/admin/orders')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
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
    </div>
  );
};
