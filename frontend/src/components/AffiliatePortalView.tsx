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
  ArrowRight,
  ShieldCheck,
  Zap,
  User,
  Lock,
  Mail,
  Check,
  AlertCircle,
  HelpCircle,
  Award
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

  // Registration / Join states for non-affiliates
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinTermsAccepted, setJoinTermsAccepted] = useState(true);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

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
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      // Check current user if token exists
      if (token) {
        try {
          const userRes = await fetchApi<{ id: string; email: string }>('/auth/me');
          setCurrentUserEmail(userRes?.email || null);
        } catch {
          setCurrentUserEmail(null);
        }
      } else {
        setCurrentUserEmail(null);
      }

      // Check affiliate profile
      let affMe: any = null;
      if (token) {
        try {
          affMe = await fetchApi<any>('/affiliate/me');
        } catch {
          affMe = null;
        }
      }

      if (affMe && affMe.id) {
        let dashData: any = null;
        try {
          dashData = await fetchApi<any>('/affiliate/dashboard');
        } catch {}

        setStats({
          affiliate: affMe,
          clicks: dashData?.clicks || 0,
          conversions: dashData?.orders || 0,
          totalSold: Number(dashData?.totalSales) || 0,
          pendingCommission: Number(dashData?.commissions?.pending) || 0,
          approvedCommission: Number(dashData?.commissions?.approved) || 0,
        });

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
      } else {
        setStats(null);
      }
    } catch (err) {
      console.error('Failed to load affiliate data:', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDisplayNameChange = (val: string) => {
    setJoinDisplayName(val);
    const suggested = val
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    setJoinCode(suggested);
  };

  const handleJoinLogged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinDisplayName.trim()) {
      setJoinError('Por favor, informe o seu nome ou o nome da sua marca/perfil.');
      return;
    }
    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setJoinError('Informe um código de indicação válido (somente letras, números e hífens).');
      return;
    }
    if (!joinTermsAccepted) {
      setJoinError('É necessário aceitar os termos do programa para continuar.');
      return;
    }

    setSubmittingJoin(true);
    setJoinError(null);
    try {
      const res = await fetchApi<{ affiliate: any; accessToken: string }>('/affiliate/join', {
        method: 'POST',
        body: JSON.stringify({
          displayName: joinDisplayName.trim(),
          code: cleanCode,
        }),
      });

      if (res?.accessToken) {
        localStorage.setItem('token', res.accessToken);
      }
      setJoinSuccess('Conta de afiliado ativada com sucesso! Bem-vindo(a) ao programa.');
      await loadData();
    } catch (err: any) {
      setJoinError(err.message || 'Erro ao ativar perfil de afiliado. Tente outro código.');
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handlePublicRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinEmail.trim() || !joinPassword.trim()) {
      setJoinError('Preencha seu e-mail e crie uma senha.');
      return;
    }
    if (joinPassword.length < 6) {
      setJoinError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (!joinDisplayName.trim()) {
      setJoinError('Informe seu nome ou nome da sua marca/perfil.');
      return;
    }
    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setJoinError('Informe um código de indicação válido.');
      return;
    }
    if (!joinTermsAccepted) {
      setJoinError('É necessário aceitar os termos do programa para continuar.');
      return;
    }

    setSubmittingJoin(true);
    setJoinError(null);
    try {
      const res = await fetchApi<{ affiliate: any; accessToken: string }>('/public/affiliate/register', {
        method: 'POST',
        body: JSON.stringify({
          email: joinEmail.trim().toLowerCase(),
          password: joinPassword,
          displayName: joinDisplayName.trim(),
          code: cleanCode,
        }),
      });

      if (res?.accessToken) {
        localStorage.setItem('token', res.accessToken);
      }
      setJoinSuccess('Conta criada e credenciada com sucesso! Acessando seu painel...');
      await loadData();
    } catch (err: any) {
      setJoinError(err.message || 'Erro ao realizar cadastro de afiliado.');
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleLoginAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinEmail.trim() || !joinPassword.trim()) {
      setJoinError('Informe seu e-mail e senha.');
      return;
    }

    setSubmittingJoin(true);
    setJoinError(null);
    try {
      const res = await fetchApi<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: joinEmail.trim().toLowerCase(),
          password: joinPassword,
        }),
      });

      if (res?.accessToken) {
        localStorage.setItem('token', res.accessToken);
      }
      await loadData();
    } catch (err: any) {
      setJoinError(err.message || 'E-mail ou senha incorretos.');
    } finally {
      setSubmittingJoin(false);
    }
  };

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
        <p className="text-zinc-600 font-medium">Carregando painel de parceiro...</p>
      </div>
    );
  }

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://eusou-lemon.vercel.app';
  const previewRefCode = (joinCode.trim() || 'SEU-CODIGO').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const previewRefUrl = `${baseOrigin}?ref=${previewRefCode}`;

  // ==========================================
  // RENDER: SEJA UM AFILIADO (ONBOARDING & CADASTRO)
  // ==========================================
  if (!stats?.affiliate?.id) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-900 border border-amber-500/30 mb-4">
            <Sparkles size={14} className="text-amber-600" />
            <span>Programa Oficial de Parceiros & Criadores</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-zinc-950 tracking-tight mb-4">
            Monetize sua audiência com os melhores produtos em impressão 3D
          </h1>
          <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
            Seja um parceiro oficial EuSou. Divulgue decorações exclusivas, colecionáveis e utilidades de alto valor percebido e receba <strong className="text-amber-700">10% de comissão</strong> sobre cada venda aprovada.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <DollarSign size={24} />
            </div>
            <h3 className="font-bold text-zinc-900 text-lg mb-2">Comissões Atrativas</h3>
            <p className="text-zinc-600 text-sm leading-relaxed">
              Ganhe 10% de comissão direta sobre o total dos pedidos realizados através do seu link ou coleções. Pagamentos rápidos via PIX.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Layers size={24} />
            </div>
            <h3 className="font-bold text-zinc-900 text-lg mb-2">Coleções Personalizadas</h3>
            <p className="text-zinc-600 text-sm leading-relaxed">
              Crie vitrines com curadoria própria e dê um toque especial da sua marca para compartilhar no Instagram, TikTok e WhatsApp.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <TrendingUp size={24} />
            </div>
            <h3 className="font-bold text-zinc-900 text-lg mb-2">Painel em Tempo Real</h3>
            <p className="text-zinc-600 text-sm leading-relaxed">
              Monitore cliques, pedidos gerados, status das conversões e acompanhe exatamente quanto tem para receber a qualquer instante.
            </p>
          </div>
        </div>

        {/* Registration Card */}
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden mb-16">
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-amber-950 p-6 text-white text-center">
            <h2 className="text-xl sm:text-2xl font-serif font-bold">Cadastro de Afiliado</h2>
            <p className="text-zinc-300 text-xs sm:text-sm mt-1">
              Ativação imediata para você começar a divulgar hoje mesmo
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {joinSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 text-sm">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                <span>{joinSuccess}</span>
              </div>
            )}

            {joinError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
                <span>{joinError}</span>
              </div>
            )}

            {currentUserEmail ? (
              // Case A: User is already logged in
              <form onSubmit={handleJoinLogged} className="space-y-5">
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-950 flex items-center gap-3 text-sm">
                  <User size={18} className="text-amber-700 shrink-0" />
                  <div className="truncate">
                    Conectado como <strong className="font-semibold text-zinc-900">{currentUserEmail}</strong>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Nome da Sua Marca / Canal / Perfil
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Felinodelia Blog, Decoração Criativa..."
                    value={joinDisplayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Este é o nome exibido no topo do seu painel e nas suas coleções.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Código de Indicação Desejado
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="ex: FELINODELIA"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 text-sm font-mono font-bold tracking-wider text-zinc-900 uppercase focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                    />
                  </div>
                  <div className="mt-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-600 font-mono break-all flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-600 shrink-0" />
                    <span>Link prévio: <strong className="text-zinc-900">{previewRefUrl}</strong></span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="terms-check"
                    checked={joinTermsAccepted}
                    onChange={(e) => setJoinTermsAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="terms-check" className="text-xs text-zinc-600 leading-snug cursor-pointer">
                    Concordo com os Termos de Parceria e Comissionamento do Programa de Afiliados EuSou.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingJoin}
                  className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/20 active:scale-98 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingJoin ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Ativar Minha Conta de Afiliado</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('token');
                      setCurrentUserEmail(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-800 underline transition"
                  >
                    Entrar com outra conta
                  </button>
                </div>
              </form>
            ) : (
              // Case B: User is not logged in
              <div>
                {/* Tabs Toggle */}
                <div className="flex bg-zinc-100 p-1 rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setJoinError(null); }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      authMode === 'register' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Criar Nova Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setJoinError(null); }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      authMode === 'login' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Já Tenho Conta
                  </button>
                </div>

                {authMode === 'register' ? (
                  <form onSubmit={handlePublicRegister} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Seu Nome / Nome do Canal ou Perfil
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ex: Felinodelia Blog"
                        value={joinDisplayName}
                        onChange={(e) => handleDisplayNameChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Seu Melhor E-mail
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="seuemail@exemplo.com"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Crie uma Senha
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Mínimo 6 caracteres"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Código de Afiliado Desejado
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ex: FELINODELIA"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                      <div className="mt-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-600 font-mono break-all">
                        Link: <strong className="text-zinc-900">{previewRefUrl}</strong>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="terms-check-pub"
                        checked={joinTermsAccepted}
                        onChange={(e) => setJoinTermsAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor="terms-check-pub" className="text-xs text-zinc-600 cursor-pointer">
                        Concordo com os Termos e Políticas do Programa de Afiliados EuSou.
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingJoin}
                      className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md active:scale-98 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                    >
                      {submittingJoin ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span>Cadastrar e Começar a Divulgar</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLoginAndContinue} className="space-y-4">
                    <p className="text-xs text-zinc-500 mb-2">
                      Já tem conta como cliente na loja? Entre abaixo e ative seu código de afiliado em seguida.
                    </p>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="seuemail@exemplo.com"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Senha
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Sua senha"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingJoin}
                      className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submittingJoin ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span>Entrar na Minha Conta</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto border-t border-zinc-200 pt-10">
          <h3 className="text-center text-xl font-serif font-bold text-zinc-900 mb-6">
            Dúvidas Frequentes sobre o Programa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200">
              <h4 className="font-semibold text-zinc-900 mb-1.5 flex items-center gap-2">
                <HelpCircle size={16} className="text-amber-600" />
                Como recebo as comissões?
              </h4>
              <p className="text-zinc-600 leading-relaxed text-xs">
                As comissões são creditadas no seu saldo assim que o pagamento do pedido é confirmado. Você pode solicitar o resgate via PIX diretamente no seu painel.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200">
              <h4 className="font-semibold text-zinc-900 mb-1.5 flex items-center gap-2">
                <HelpCircle size={16} className="text-amber-600" />
                Preciso pagar algo para participar?
              </h4>
              <p className="text-zinc-600 leading-relaxed text-xs">
                Não! O cadastro no programa de afiliados é 100% gratuito. Você só ganha por cada venda gerada a partir da sua divulgação.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: PORTAL ATIVO DO AFILIADO CREDENCIADO
  // ==========================================
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
                  {links.slice(0, 4).map((link) => {
                    const fullUrl = `${baseOrigin}${link.targetUrl || '/'}?ref=${link.code || stats?.affiliate?.code}`;
                    return (
                      <div key={link.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-zinc-900 truncate">
                            {fullUrl}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {link.clicksCount} cliques • Criado em {new Date(link.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(fullUrl, link.id)}
                          className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition"
                          title="Copiar Link"
                        >
                          {copiedLink === link.id ? <CheckCircle2 size={16} className="text-green-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center mb-4 font-bold">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-bold text-zinc-900 text-lg mb-1">Divulgação Rápida</h3>
                <p className="text-sm text-zinc-600 mb-6">
                  Envie seu catálogo para amigos ou grupos no WhatsApp com 1 clique e garanta suas comissões.
                </p>
              </div>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Olá! Dá uma olhada nesses produtos incríveis da EuSou que selecionei: ${storeRefLink}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition shadow-sm"
              >
                Compartilhar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Links */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-900">Gerador de Links de Afiliado</h3>
            <button
              onClick={() => setShowCreateLinkModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Novo Link
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            {links.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                Nenhum link personalizado criado. Clique em "Novo Link" para apontar para um produto específico!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-600">
                  <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-4">Destino</th>
                      <th className="px-6 py-4">Cliques</th>
                      <th className="px-6 py-4">URL Completa</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {links.map((link) => {
                      const fullUrl = `${baseOrigin}${link.targetUrl || '/'}?ref=${link.code || stats?.affiliate?.code}`;
                      return (
                        <tr key={link.id} className="hover:bg-zinc-50/50">
                          <td className="px-6 py-4 font-medium text-zinc-900">
                            {link.targetUrl || 'Página Inicial'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {link.clicksCount} cliques
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500 truncate max-w-xs">
                            {fullUrl}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => copyToClipboard(fullUrl, link.id)}
                              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                            >
                              {copiedLink === link.id ? 'Copiado!' : 'Copiar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Collections */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Minhas Coleções de Vitrine</h3>
              <p className="text-xs text-zinc-500">Agrupe produtos favoritos e divulgue sua vitrine personalizada</p>
            </div>
            <button
              onClick={() => setShowCreateCollectionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Nova Coleção
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
                Nenhuma vitrine criada ainda. Crie uma coleção exclusiva para curar seus itens favoritos!
              </div>
            ) : (
              collections.map((col) => {
                const colUrl = `${baseOrigin}/colecoes/${col.slug}?ref=${stats?.affiliate?.code}`;
                return (
                  <div key={col.id} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-md border border-amber-200">
                          Coleção Pessoal
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">/{col.slug}</span>
                      </div>
                      <h4 className="font-bold text-zinc-900 text-base mb-1">{col.name}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 mb-4">
                        {col.description || 'Sem descrição cadastrada.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => copyToClipboard(colUrl, col.id)}
                        className="flex-1 py-2 px-3 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition flex items-center justify-center gap-1.5"
                      >
                        {copiedLink === col.id ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                        {copiedLink === col.id ? 'Link Copiado!' : 'Copiar Vitrine'}
                      </button>
                      <a
                        href={colUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition"
                        title="Abrir Coleção"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Conversions & Sales */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-zinc-900">Histórico de Pedidos e Comissões</h3>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            {conversions.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                Nenhum pedido atribuído ainda. Suas vendas confirmadas aparecerão automaticamente aqui!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-600">
                  <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Pedido</th>
                      <th className="px-6 py-4">Valor Total</th>
                      <th className="px-6 py-4">Comissão (%)</th>
                      <th className="px-6 py-4">Valor da Comissão</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {conversions.map((conv) => (
                      <tr key={conv.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 text-xs">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-zinc-900">
                          #{conv.orderId.slice(0, 8)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">
                          {formatCurrency(conv.orderAmount)}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-amber-700">
                          {conv.appliedCommissionPercent || conv.commissionRate}%
                        </td>
                        <td className="px-6 py-4 font-bold text-amber-600">
                          {formatCurrency(conv.commissionAmount)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              conv.status === 'APPROVED'
                                ? 'bg-green-100 text-green-800'
                                : conv.status === 'PENDING'
                                ? 'bg-orange-100 text-orange-800'
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
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Marketing & Share Materials */}
      {activeTab === 'share' && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-zinc-900">Recursos de Divulgação</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <h4 className="font-bold text-zinc-900 text-base mb-2">Seu Link Principal de Indicação</h4>
              <p className="text-xs text-zinc-500 mb-4">
                Coloque na biografia do seu Instagram, canal do YouTube, TikTok ou envie diretamente para seus clientes.
              </p>
              <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <input
                  type="text"
                  readOnly
                  value={storeRefLink}
                  className="bg-transparent border-none text-xs font-mono text-zinc-800 flex-1 outline-none"
                />
                <button
                  onClick={() => copyToClipboard(storeRefLink, 'ref_input')}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition"
                >
                  {copiedLink === 'ref_input' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <h4 className="font-bold text-zinc-900 text-base mb-2">Mensagem Pronta para Redes Sociais</h4>
              <p className="text-xs text-zinc-500 mb-4">
                Copie um texto engajador pronto para colar nos seus stories, feed ou grupos.
              </p>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-700 italic mb-3">
                "Galera, confiram os colecionáveis e decorações em impressão 3D incríveis na loja EuSou! Use meu link para garantir os melhores lançamentos: {storeRefLink}"
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
                    `Galera, confiram os colecionáveis e decorações em impressão 3D incríveis na loja EuSou! Use meu link para garantir os melhores lançamentos: ${storeRefLink}`,
                    'copy_msg'
                  )
                }
                className="w-full py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition flex items-center justify-center gap-2"
              >
                {copiedLink === 'copy_msg' ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                {copiedLink === 'copy_msg' ? 'Mensagem Copiada!' : 'Copiar Texto Pronto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Link */}
      {showCreateLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Criar Link Parametrizado</h3>
            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Tipo de Destino</label>
                <select
                  value={newLinkTargetType}
                  onChange={(e) => setNewLinkTargetType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="STORE">Página Inicial da Loja (/)</option>
                  <option value="PRODUCT">Produto Específico (/produtos/slug)</option>
                  <option value="CATALOG">Catálogo (/catalogos/slug)</option>
                </select>
              </div>

              {newLinkTargetType !== 'STORE' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Slug do Item</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: porta-chaves-gatinho"
                    value={newLinkSlug}
                    onChange={(e) => setNewLinkSlug(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}

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
