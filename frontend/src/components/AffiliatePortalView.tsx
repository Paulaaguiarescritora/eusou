import React, { useEffect, useState } from 'react';
import { AffiliateDashboardStats, AffiliateLink, AffiliateConversion, Collection } from '../types';
import { fetchApi } from '../api';
import { 
  TrendingUp, 
  MousePointerClick, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Plus, 
  Share2, 
  Sparkles,
  QrCode,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AffiliatePortalViewProps {
  onNavigate: (route: string) => void;
}

export const AffiliatePortalView: React.FC<AffiliatePortalViewProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'links' | 'collections' | 'share' | 'reports'>('dashboard');
  const [stats, setStats] = useState<AffiliateDashboardStats | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [conversions, setConversions] = useState<AffiliateConversion[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Modal / Form states
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [newLinkTargetType, setNewLinkTargetType] = useState<'STORE' | 'PRODUCT' | 'COLLECTION' | 'CATALOG'>('STORE');
  const [newLinkSlug, setNewLinkSlug] = useState('');
  const [newLinkUtmSource, setNewLinkUtmSource] = useState('instagram');
  const [newLinkUtmCampaign, setNewLinkUtmCampaign] = useState('');

  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionSlug, setNewCollectionSlug] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      let affMe: any = null;
      try {
        affMe = await fetchApi<any>('/affiliate/me');
      } catch {}

      let dashData: any = null;
      try {
        dashData = await fetchApi<any>('/affiliate/dashboard');
      } catch {}

      if (affMe || dashData) {
        setStats({
          affiliate: affMe || { displayName: 'Afiliado', code: 'oficial' },
          clicks: dashData?.clicks || 0,
          conversions: dashData?.orders || 0,
          totalSold: Number(dashData?.totalSales) || 0,
          pendingCommission: Number(dashData?.commissions?.pending) || 0,
          approvedCommission: Number(dashData?.commissions?.approved) || 0,
        });
      }

      try {
        const linksRes = await fetchApi<any[]>('/affiliate/links');
        setLinks(Array.isArray(linksRes) ? linksRes : []);
      } catch {
        setLinks([]);
      }

      try {
        const convRes = await fetchApi<any[]>('/affiliate/conversions');
        setConversions(Array.isArray(convRes) ? convRes : []);
      } catch {
        setConversions([]);
      }

      try {
        const colRes = await fetchApi<any[]>('/affiliate/collections');
        setCollections(Array.isArray(colRes) ? colRes : []);
      } catch {
        setCollections([]);
      }
    } catch (err) {
      console.error('Failed to load affiliate data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const destination = newLinkSlug
        ? newLinkTargetType === 'PRODUCT'
          ? `/produtos/${newLinkSlug}`
          : newLinkTargetType === 'CATALOG'
          ? `/catalogos/${newLinkSlug}`
          : `/${newLinkSlug}`
        : '/';

      await fetchApi('/affiliate/links', {
        method: 'POST',
        body: JSON.stringify({
          destination,
          code: newLinkSlug ? newLinkSlug.trim().toUpperCase() : undefined,
        }),
      });
      setShowCreateLinkModal(false);
      setNewLinkSlug('');
      setNewLinkUtmCampaign('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao gerar link de afiliado');
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/affiliate/collections', {
        method: 'POST',
        body: JSON.stringify({
          name: newCollectionName,
          description: newCollectionDesc || undefined,
        }),
      });
      setShowCreateCollectionModal(false);
      setNewCollectionName('');
      setNewCollectionSlug('');
      setNewCollectionDesc('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar coleção de afiliado');
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-amber-600 border-t-transparent mb-4"></div>
        <p className="text-zinc-600 font-medium">Carregando painel de afiliado...</p>
      </div>
    );
  }

  const baseOrigin = window.location.origin;
  const storeRefLink = stats?.affiliate?.code ? `${baseOrigin}?ref=${stats.affiliate.code}` : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-amber-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Afiliado Oficial
            </span>
            <span className="text-xs text-zinc-400 font-mono">Código: {stats?.affiliate?.code}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            Olá, {stats?.affiliate?.displayName || 'Afiliado'}
          </h1>
          <p className="text-zinc-300 text-sm mt-1 max-w-xl">
            Acompanhe seu desempenho em tempo real, crie links exclusivos de divulgação e monetize sua audiência com segurança.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => copyToClipboard(storeRefLink, 'main_ref')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-all shadow-md active:scale-95"
          >
            {copiedLink === 'main_ref' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {copiedLink === 'main_ref' ? 'Link Copiado!' : 'Copiar Link da Loja'}
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all border border-white/10 backdrop-blur-sm"
          >
            <Share2 size={16} /> Divulgar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 overflow-x-auto no-scrollbar gap-2 mb-8">
        {[
          { id: 'dashboard', label: 'Visão Geral', icon: TrendingUp },
          { id: 'links', label: 'Meus Links', icon: MousePointerClick },
          { id: 'collections', label: 'Minhas Coleções', icon: Layers },
          { id: 'reports', label: 'Conversões e Vendas', icon: ShoppingBag },
          { id: 'share', label: 'Materiais de Divulgação', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                isActive
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total de Cliques</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <MousePointerClick size={18} />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900">{stats?.clicks || 0}</div>
              <p className="text-xs text-zinc-500 mt-1">Visitas únicas e recorrentes rastreadas</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Conversões</span>
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  <ShoppingBag size={18} />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900">{stats?.conversions || 0}</div>
              <p className="text-xs text-zinc-500 mt-1">Pedidos atribuídos via Last-Click</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Comissão Aprovada</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(stats?.approvedCommission || 0)}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Disponível de pedidos confirmados</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Comissão Pendente</span>
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                  <Clock size={18} />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-700">
                {formatCurrency(stats?.pendingCommission || 0)}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Aguardando confirmação do pagamento</p>
            </div>
          </div>

          {/* Quick Links & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-900 text-lg">Links Mais Recentes</h3>
                <button
                  onClick={() => setActiveTab('links')}
                  className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center gap-1"
                >
                  Ver todos <ArrowRight size={14} />
                </button>
              </div>

              {links.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  Nenhum link gerado ainda. Crie um link exclusivo para começar a divulgar!
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {links.slice(0, 4).map((link: any) => {
                    const targetUrl = link.targetUrl || `${baseOrigin}${link.destination || '/'}?ref=${link.code}`;
                    const linkName = link.slug || link.code;
                    const targetType = link.targetType || (link.productId ? 'PRODUCT' : link.catalogId ? 'CATALOG' : link.collectionId ? 'COLLECTION' : 'STORE');
                    const clicksCount = link.clicksCount ?? (link._count?.clicks || 0);

                    return (
                      <div key={link.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900 text-sm truncate">{linkName}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600 uppercase">
                              {targetType}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">{targetUrl}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-semibold text-zinc-600 whitespace-nowrap">
                            {clicksCount} cliques
                          </span>
                          <button
                            onClick={() => copyToClipboard(targetUrl, link.id)}
                            className="p-1.5 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 rounded-lg transition"
                            title="Copiar link"
                          >
                            {copiedLink === link.id ? <CheckCircle2 size={16} className="text-green-600" /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Share Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="p-3 bg-amber-100 text-amber-800 rounded-xl w-fit mb-3">
                  <Sparkles size={24} />
                </div>
                <h3 className="font-serif font-bold text-lg text-amber-950 mb-1">Divulgação Rápida</h3>
                <p className="text-xs text-amber-900/80 mb-4">
                  Envie seu catálogo para amigos ou grupos no WhatsApp com 1 clique e garanta suas comissões.
                </p>
                <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs text-zinc-600 font-mono break-all mb-4">
                  {storeRefLink}
                </div>
              </div>
              <button
                onClick={() => {
                  const msg = encodeURIComponent(`Confira os produtos e fragrâncias exclusivas da EuSou: ${storeRefLink}`);
                  window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
                }}
                className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-sm"
              >
                Compartilhar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Links */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Seus Links Rastreados</h2>
              <p className="text-sm text-zinc-500">Crie links para a loja inteira, coleções ou produtos específicos</p>
            </div>
            <button
              onClick={() => setShowCreateLinkModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
            >
              <Plus size={16} /> Criar Novo Link
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Nome / Identificador</th>
                    <th className="px-6 py-3.5">Destino</th>
                    <th className="px-6 py-3.5">Origem (UTM)</th>
                    <th className="px-6 py-3.5">Cliques</th>
                    <th className="px-6 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {links.map((link: any) => {
                    const targetUrl = link.targetUrl || `${baseOrigin}${link.destination || '/'}?ref=${link.code}`;
                    const linkName = link.slug || link.code;
                    const targetType = link.targetType || (link.productId ? 'PRODUCT' : link.catalogId ? 'CATALOG' : link.collectionId ? 'COLLECTION' : 'STORE');
                    const clicksCount = link.clicksCount ?? (link._count?.clicks || 0);

                    return (
                      <tr key={link.id} className="hover:bg-zinc-50/60 transition">
                        <td className="px-6 py-4 font-semibold text-zinc-900">{linkName}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-700 mr-2">
                            {targetType}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono">{targetUrl}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-600">
                          {link.utmSource ? `${link.utmSource} / ${link.utmCampaign || 'geral'}` : '-'}
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-900">{clicksCount}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => copyToClipboard(targetUrl, link.id)}
                            className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition inline-flex items-center gap-1.5"
                          >
                            {copiedLink === link.id ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                            {copiedLink === link.id ? 'Copiado!' : 'Copiar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {links.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-zinc-500">
                        Nenhum link gerado. Clique em "Criar Novo Link" para começar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Collections */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Coleções Pessoais</h2>
              <p className="text-sm text-zinc-500">Monte suas próprias vitrines com a curadoria que seus seguidores amam</p>
            </div>
            <button
              onClick={() => setShowCreateCollectionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
            >
              <Plus size={16} /> Nova Coleção Pessoal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((col) => {
              const colUrl = `${baseOrigin}/colecoes/${col.slug}?ref=${stats?.affiliate?.code}`;
              return (
                <div key={col.id} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded border border-purple-200/50">
                        Coleção Afiliado
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">/{col.slug}</span>
                    </div>
                    <h3 className="font-serif font-bold text-zinc-900 text-lg mb-1">{col.name}</h3>
                    <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{col.description || 'Sem descrição cadastrada'}</p>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => copyToClipboard(colUrl, col.id)}
                      className="flex-1 py-2 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 flex items-center justify-center gap-1.5 transition"
                    >
                      {copiedLink === col.id ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                      {copiedLink === col.id ? 'Link Copiado' : 'Copiar Link'}
                    </button>
                    <button
                      onClick={() => window.open(colUrl, '_blank')}
                      className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition"
                      title="Abrir página pública"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {collections.length === 0 && (
              <div className="col-span-full bg-white border border-dashed border-zinc-300 rounded-2xl p-10 text-center">
                <Layers className="mx-auto text-zinc-400 mb-3" size={36} />
                <h3 className="font-semibold text-zinc-800 text-base">Crie sua primeira seleção exclusiva</h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1 mb-4">
                  Selecione produtos temáticos como "Fragrâncias para o Verão" ou "Meus Favoritos da Semana".
                </p>
                <button
                  onClick={() => setShowCreateCollectionModal(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Criar Coleção Agora
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Reports / Conversions */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Extrato de Conversões e Comissões</h2>
            <p className="text-sm text-zinc-500">
              Histórico seguro de pedidos concluídos por intermédio dos seus links (dados do comprador são protegidos)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Data</th>
                    <th className="px-6 py-3.5">ID Pedido</th>
                    <th className="px-6 py-3.5">Valor do Pedido</th>
                    <th className="px-6 py-3.5">Alíquota</th>
                    <th className="px-6 py-3.5">Comissão Gerada</th>
                    <th className="px-6 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {conversions.map((conv) => (
                    <tr key={conv.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {new Date(conv.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-600">
                        {conv.orderId.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-900">
                        {formatCurrency(conv.orderAmount)}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-zinc-600">
                        {conv.commissionRate}%
                      </td>
                      <td className="px-6 py-4 font-bold text-amber-600">
                        {formatCurrency(conv.commissionAmount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            conv.status === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : conv.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {conv.status === 'APPROVED'
                            ? 'Aprovada'
                            : conv.status === 'PENDING'
                            ? 'Pendente'
                            : 'Cancelada'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {conversions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-zinc-500">
                        Nenhuma conversão registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Share / Materials */}
      {activeTab === 'share' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Materiais de Divulgação</h2>
            <p className="text-sm text-zinc-500">Copie textos pré-formatados ou crie cards para redes sociais</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* WhatsApp Pitch */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900 mb-2">Mensagem Pronta para WhatsApp</h3>
                <p className="text-xs text-zinc-500 mb-4">
                  Envie este texto para listas de transmissão, contatos próximos ou stories:
                </p>
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-700 leading-relaxed font-sans mb-4">
                  "Oi! Descobri fragrâncias incríveis na EuSou com uma fixação e identidade marcante. Dê uma olhada no catálogo oficial pelo meu link especial: {storeRefLink}"
                </div>
              </div>
              <button
                onClick={() => {
                  const txt = `Oi! Descobri fragrâncias incríveis na EuSou com uma fixação e identidade marcante. Dê uma olhada no catálogo oficial pelo meu link especial: ${storeRefLink}`;
                  copyToClipboard(txt, 'wa_pitch');
                }}
                className="w-full py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition flex items-center justify-center gap-2"
              >
                {copiedLink === 'wa_pitch' ? <CheckCircle2 size={16} className="text-green-600" /> : <Copy size={16} />}
                {copiedLink === 'wa_pitch' ? 'Texto Copiado!' : 'Copiar Texto Pronto'}
              </button>
            </div>

            {/* QR Code / Direct Scan */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl mb-4 shadow-inner">
                <QrCode size={120} className="text-zinc-800" />
              </div>
              <h3 className="font-semibold text-zinc-900 mb-1">QR Code de Divulgação</h3>
              <p className="text-xs text-zinc-500 max-w-xs mb-4">
                Ideal para imprimir em cartões de visita, tags de embalagens ou exibir na tela do celular.
              </p>
              <button
                onClick={() => copyToClipboard(storeRefLink, 'qr_url')}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition"
              >
                {copiedLink === 'qr_url' ? 'Link Copiado' : 'Copiar URL do QR Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Link */}
      {showCreateLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Gerar Novo Link de Afiliado</h3>
            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Destino</label>
                <select
                  value={newLinkTargetType}
                  onChange={(e) => setNewLinkTargetType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="STORE">Loja Completa (/)</option>
                  <option value="PRODUCT">Produto Específico</option>
                  <option value="COLLECTION">Coleção</option>
                  <option value="CATALOG">Catálogo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Nome / Slug do Link</label>
                <input
                  type="text"
                  placeholder="ex: promo-instagram, story-perfumes"
                  value={newLinkSlug}
                  onChange={(e) => setNewLinkSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Canal (UTM)</label>
                  <input
                    type="text"
                    value={newLinkUtmSource}
                    onChange={(e) => setNewLinkUtmSource(e.target.value)}
                    placeholder="instagram, tiktok"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Campanha</label>
                  <input
                    type="text"
                    value={newLinkUtmCampaign}
                    onChange={(e) => setNewLinkUtmCampaign(e.target.value)}
                    placeholder="natal, verao"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCreateLinkModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Criar Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Collection */}
      {showCreateCollectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Criar Coleção Pessoal</h3>
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Nome da Coleção</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Meus Favoritos de Luxo"
                  value={newCollectionName}
                  onChange={(e) => {
                    setNewCollectionName(e.target.value);
                    if (!newCollectionSlug) {
                      setNewCollectionSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Slug URL</label>
                <input
                  type="text"
                  required
                  placeholder="ex: meus-favoritos-de-luxo"
                  value={newCollectionSlug}
                  onChange={(e) => setNewCollectionSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Descrição</label>
                <textarea
                  rows={3}
                  placeholder="Apresente aos seus seguidores o que torna esta seleção especial..."
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCreateCollectionModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Criar Coleção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
