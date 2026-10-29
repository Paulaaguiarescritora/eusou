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
  Award,
  Phone,
  CreditCard,
  FileText,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';

interface AffiliatePortalViewProps {
  onNavigate: (route: string) => void;
}

const isValidCPF = (cpf: string) => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;
  return true;
};

const formatCPF = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

const formatWhatsApp = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const AffiliatePortalView: React.FC<AffiliatePortalViewProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'links' | 'collections' | 'share' | 'reports' | 'profile'>('dashboard');
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
  const [joinCpf, setJoinCpf] = useState('');
  const [joinWhatsapp, setJoinWhatsapp] = useState('');
  const [joinPixKey, setJoinPixKey] = useState('');
  const [joinTermsAccepted, setJoinTermsAccepted] = useState(true);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Edit Profile States
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editPixKey, setEditPixKey] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

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
        setEditDisplayName(affMe.displayName || '');
        setEditEmail(affMe.user?.email || currentUserEmail || '');
        setEditWhatsapp(affMe.whatsapp ? formatWhatsApp(affMe.whatsapp) : '');
        setEditCpf(affMe.cpf ? formatCPF(affMe.cpf) : '');
        setEditPixKey(affMe.pixKey || '');
        setEditNewPassword('');
        setEditConfirmPassword('');

        // Carregar métricas, links, conversões e coleções em paralelo para máxima velocidade
        const [dashRes, linksRes, convRes, colRes] = await Promise.allSettled([
          fetchApi<any>('/affiliate/dashboard'),
          fetchApi<any[]>('/affiliate/links'),
          fetchApi<any[]>('/affiliate/conversions'),
          fetchApi<any[]>('/affiliate/collections'),
        ]);

        const dashData = dashRes.status === 'fulfilled' ? dashRes.value : null;
        const fetchedLinks = linksRes.status === 'fulfilled' && Array.isArray(linksRes.value) ? linksRes.value : [];
        const fetchedConversions = convRes.status === 'fulfilled' && Array.isArray(convRes.value) ? convRes.value : [];
        const fetchedCollections = colRes.status === 'fulfilled' && Array.isArray(colRes.value) ? colRes.value : [];

        setStats({
          affiliate: affMe,
          clicks: dashData?.clicks || 0,
          conversions: dashData?.orders || 0,
          totalSold: Number(dashData?.totalSales) || 0,
          pendingCommission: Number(dashData?.commissions?.pending) || 0,
          approvedCommission: Number(dashData?.commissions?.approved) || 0,
        });

        setLinks(fetchedLinks);
        setConversions(fetchedConversions);
        setCollections(fetchedCollections);
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

  const validateCommonFields = () => {
    if (!joinDisplayName.trim()) {
      setJoinError('Por favor, informe seu nome completo ou o nome da sua marca/canal.');
      return false;
    }
    const cleanPhone = joinWhatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setJoinError('Informe um número de WhatsApp válido com DDD (ex: 11 98888-7777).');
      return false;
    }
    const cleanCpf = joinCpf.replace(/\D/g, '');
    if (!isValidCPF(cleanCpf)) {
      setJoinError('Por favor, informe um CPF válido.');
      return false;
    }
    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setJoinError('Informe um código de indicação válido (somente letras, números e hífens).');
      return false;
    }
    if (!joinTermsAccepted) {
      setJoinError('É necessário aceitar os termos do programa para continuar.');
      return false;
    }
    return true;
  };

  const handleJoinLogged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCommonFields()) return;

    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    setSubmittingJoin(true);
    setJoinError(null);
    try {
      const res = await fetchApi<{ affiliate: any; accessToken: string }>('/affiliate/join', {
        method: 'POST',
        body: JSON.stringify({
          displayName: joinDisplayName.trim(),
          code: cleanCode,
          cpf: joinCpf.trim(),
          whatsapp: joinWhatsapp.trim(),
          pixKey: joinPixKey.trim() || joinCpf.trim(),
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
    if (!joinEmail.trim() || !joinEmail.includes('@') || !joinEmail.includes('.')) {
      setJoinError('Preencha um endereço de e-mail válido.');
      return;
    }
    if (!joinPassword.trim() || joinPassword.length < 6) {
      setJoinError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (!validateCommonFields()) return;

    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
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
          cpf: joinCpf.trim(),
          whatsapp: joinWhatsapp.trim(),
          pixKey: joinPixKey.trim() || joinCpf.trim(),
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!editDisplayName.trim()) {
      setProfileError('Informe o seu nome ou nome da sua marca/perfil.');
      return;
    }
    if (!editEmail.trim() || !editEmail.includes('@') || !editEmail.includes('.')) {
      setProfileError('Informe um e-mail de acesso válido.');
      return;
    }
    const cleanPhone = editWhatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setProfileError('Informe um WhatsApp válido com DDD (ex: 11 98888-7777).');
      return;
    }
    const cleanCpf = editCpf.replace(/\D/g, '');
    if (!isValidCPF(cleanCpf)) {
      setProfileError('Informe um CPF válido.');
      return;
    }

    if (editNewPassword.trim()) {
      if (editNewPassword.length < 6) {
        setProfileError('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (editNewPassword !== editConfirmPassword) {
        setProfileError('A confirmação da nova senha não confere.');
        return;
      }
    }

    setSavingProfile(true);
    try {
      const payload: any = {
        displayName: editDisplayName.trim(),
        email: editEmail.trim().toLowerCase(),
        cpf: editCpf.trim(),
        whatsapp: editWhatsapp.trim(),
        pixKey: editPixKey.trim() || editCpf.trim(),
      };
      if (editNewPassword.trim()) {
        payload.password = editNewPassword;
      }

      const res = await fetchApi<any>('/affiliate/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res?.accessToken) {
        localStorage.setItem('token', res.accessToken);
      }

      const updatedAff = res?.affiliate || res;
      setStats((prev) => (prev ? { ...prev, affiliate: { ...prev.affiliate, ...updatedAff } } : prev));
      if (updatedAff?.user?.email) {
        setCurrentUserEmail(updatedAff.user.email);
        setEditEmail(updatedAff.user.email);
      }
      setEditNewPassword('');
      setEditConfirmPassword('');
      setShowPasswordSection(false);
      setProfileSuccess('Informações cadastrais, e-mail e senha atualizados com sucesso!');
      setTimeout(() => setProfileSuccess(null), 5000);
    } catch (err: any) {
      setProfileError(err.message || 'Erro ao atualizar informações do perfil.');
    } finally {
      setSavingProfile(false);
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
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden mb-16">
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-amber-950 p-6 text-white text-center">
            <h2 className="text-xl sm:text-2xl font-serif font-bold">Cadastro de Afiliado</h2>
            <p className="text-zinc-300 text-xs sm:text-sm mt-1">
              Preencha seus dados cadastrais para liberação e recebimento de comissões
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
              <form onSubmit={handleJoinLogged} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-950 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2.5 truncate">
                    <User size={18} className="text-amber-700 shrink-0" />
                    <span className="truncate">
                      Conectado como <strong className="font-semibold text-zinc-900">{currentUserEmail}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('token');
                      setCurrentUserEmail(null);
                    }}
                    className="text-xs text-amber-900 hover:text-amber-700 underline shrink-0 font-medium"
                  >
                    Trocar
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Nome Completo ou Nome da Sua Marca / Perfil *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Felinodelia Blog ou Paula Aguiar"
                    value={joinDisplayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Phone size={13} className="text-zinc-400" />
                      WhatsApp (com DDD) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="(11) 98888-7777"
                      value={joinWhatsapp}
                      onChange={(e) => setJoinWhatsapp(formatWhatsApp(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <FileText size={13} className="text-zinc-400" />
                      CPF *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={joinCpf}
                      onChange={(e) => setJoinCpf(formatCPF(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={13} className="text-zinc-400" />
                      Chave PIX para Comissões
                    </label>
                    {joinCpf && (
                      <button
                        type="button"
                        onClick={() => setJoinPixKey(joinCpf)}
                        className="text-xs text-amber-700 hover:text-amber-800 font-semibold"
                      >
                        Usar meu CPF
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Chave PIX (CPF, Celular, E-mail ou Aleatória)"
                    value={joinPixKey}
                    onChange={(e) => setJoinPixKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-xs text-zinc-400 mt-1">Se não preencher agora, será utilizado o seu CPF para os repasses.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Código de Afiliado Desejado *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: FELINODELIA"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <div className="mt-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-600 font-mono break-all flex items-center gap-2">
                    <Sparkles size={13} className="text-amber-600 shrink-0" />
                    <span>Link prévio: <strong className="text-zinc-900">{previewRefUrl}</strong></span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="terms-check-logged"
                    checked={joinTermsAccepted}
                    onChange={(e) => setJoinTermsAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="terms-check-logged" className="text-xs text-zinc-600 leading-snug cursor-pointer">
                    Concordo com os Termos de Parceria e Comissionamento do Programa de Afiliados EuSou.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingJoin}
                  className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md active:scale-98 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
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
                        Nome Completo ou Razão Social *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ex: Felinodelia Blog ou Paula Aguiar"
                        value={joinDisplayName}
                        onChange={(e) => handleDisplayNameChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Mail size={13} className="text-zinc-400" />
                          Seu E-mail *
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
                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Lock size={13} className="text-zinc-400" />
                          Crie uma Senha *
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Phone size={13} className="text-zinc-400" />
                          WhatsApp (com DDD) *
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="(11) 98888-7777"
                          value={joinWhatsapp}
                          onChange={(e) => setJoinWhatsapp(formatWhatsApp(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <FileText size={13} className="text-zinc-400" />
                          CPF *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="000.000.000-00"
                          value={joinCpf}
                          onChange={(e) => setJoinCpf(formatCPF(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard size={13} className="text-zinc-400" />
                          Chave PIX para Comissões
                        </label>
                        {joinCpf && (
                          <button
                            type="button"
                            onClick={() => setJoinPixKey(joinCpf)}
                            className="text-xs text-amber-700 hover:text-amber-800 font-semibold"
                          >
                            Usar meu CPF
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Chave PIX (CPF, Celular, E-mail ou Aleatória)"
                        value={joinPixKey}
                        onChange={(e) => setJoinPixKey(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Código de Afiliado Desejado *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ex: FELINODELIA"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                      <div className="mt-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-600 font-mono break-all flex items-center gap-2">
                        <Sparkles size={13} className="text-amber-600 shrink-0" />
                        <span>Link: <strong className="text-zinc-900">{previewRefUrl}</strong></span>
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
                      Já tem conta como cliente na loja? Entre abaixo e complete seus dados cadastrais para ativar seu perfil de parceiro.
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
                As comissões são creditadas no seu saldo assim que o pagamento do pedido é confirmado. Os pagamentos são transferidos diretamente na sua chave PIX cadastrada.
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
          { id: 'profile', label: 'Meu Perfil', icon: User },
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
                    const destinationPath = link.targetUrl || link.destination || '/';
                    const fullUrl = `${baseOrigin}${destinationPath.startsWith('/') ? destinationPath : `/${destinationPath}`}?ref=${link.code || stats?.affiliate?.code}`;
                    const clicks = link.clicksCount ?? link._count?.clicks ?? 0;
                    return (
                      <div key={link.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-zinc-900 truncate">
                            {fullUrl}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {clicks} cliques • Criado em {link.createdAt ? new Date(link.createdAt).toLocaleDateString('pt-BR') : '-'}
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
                    {links.map((link: any) => {
                      const destinationPath = link.targetUrl || link.destination || '/';
                      const fullUrl = `${baseOrigin}${destinationPath.startsWith('/') ? destinationPath : `/${destinationPath}`}?ref=${link.code || stats?.affiliate?.code}`;
                      const clicks = link.clicksCount ?? link._count?.clicks ?? 0;
                      return (
                        <tr key={link.id} className="hover:bg-zinc-50/50">
                          <td className="px-6 py-4 font-medium text-zinc-900">
                            {destinationPath === '/' ? 'Página Inicial' : destinationPath}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {clicks} cliques
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
                    {conversions.map((conv: any) => {
                      const orderIdStr = String(conv.orderId || conv.orderNumber || conv.order?.id || conv.id || '').trim();
                      const displayOrderId = orderIdStr ? `#${orderIdStr.slice(0, 8)}` : '-';
                      const rawDate = conv.createdAt || conv.date || (conv.order && conv.order.createdAt);
                      let dateStr = '-';
                      try {
                        if (rawDate) {
                          dateStr = new Date(rawDate).toLocaleDateString('pt-BR');
                        }
                      } catch {
                        dateStr = '-';
                      }
                      const amountVal = conv.orderAmount ?? conv.amount ?? 0;
                      const rateVal = conv.appliedCommissionPercent ?? conv.commissionRate ?? stats?.affiliate?.defaultCommissionPercent ?? 10;
                      const commissionVal = conv.commissionAmount ?? 0;
                      const convStatus = String(conv.status || conv.conversionStatus || 'PENDING').toUpperCase();

                      return (
                        <tr key={conv.id || Math.random()} className="hover:bg-zinc-50/50">
                          <td className="px-6 py-4 text-xs text-zinc-600">
                            {dateStr}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-zinc-900 font-semibold">
                            {displayOrderId}
                          </td>
                          <td className="px-6 py-4 font-semibold text-zinc-900">
                            {formatCurrency(amountVal)}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-amber-700">
                            {rateVal}%
                          </td>
                          <td className="px-6 py-4 font-bold text-amber-600">
                            {formatCurrency(commissionVal)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                convStatus === 'APPROVED'
                                  ? 'bg-green-100 text-green-800'
                                  : convStatus === 'PENDING'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {convStatus === 'APPROVED'
                                ? 'Aprovada'
                                : convStatus === 'PENDING'
                                ? 'Pendente'
                                : 'Cancelada'}
                            </span>
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

      {/* Tab: Profile & Settings */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Meu Perfil de Afiliado</h3>
              <p className="text-sm text-zinc-500">Mantenha seus dados cadastrais e de pagamento sempre atualizados</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Conta Ativa • {stats?.affiliate?.defaultCommissionPercent || 10}% de Comissão
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-6 sm:p-8 shadow-sm">
              <h4 className="font-bold text-zinc-900 text-base mb-6 flex items-center gap-2">
                <User size={18} className="text-amber-600" />
                Dados Cadastrais & Recebimento
              </h4>

              {profileSuccess && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 text-sm">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Nome Completo ou Razão Social / Marca *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Felinodelia Blog ou Paula Aguiar"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-xs text-zinc-400 mt-1">Este nome é exibido aos seus seguidores no topo das suas coleções.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Phone size={14} className="text-zinc-400" />
                      WhatsApp (com DDD) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="(11) 98888-7777"
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(formatWhatsApp(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <FileText size={14} className="text-zinc-400" />
                      CPF *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={editCpf}
                      onChange={(e) => setEditCpf(formatCPF(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={14} className="text-zinc-400" />
                      Chave PIX para Depósito de Comissões
                    </label>
                    {editCpf && (
                      <button
                        type="button"
                        onClick={() => setEditPixKey(editCpf)}
                        className="text-xs text-amber-700 hover:text-amber-800 font-semibold"
                      >
                        Usar meu CPF
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Chave PIX (CPF, Celular, E-mail ou Aleatória)"
                    value={editPixKey}
                    onChange={(e) => setEditPixKey(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-xs text-zinc-400 mt-1">Os pagamentos das vendas confirmadas são enviados diretamente para esta chave.</p>
                </div>

                {/* Login and Password section */}
                <div className="pt-6 border-t border-zinc-200">
                  <div className="mb-4">
                    <h5 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                      <Lock size={16} className="text-amber-600" />
                      Credenciais de Acesso (Login & Senha)
                    </h5>
                    <p className="text-xs text-zinc-500">Mantenha seu e-mail e senha de login atualizados</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Mail size={14} className="text-zinc-400" />
                        E-mail de Login *
                      </label>
                      <input
                        type="email"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                      <p className="text-xs text-zinc-400 mt-1">Este é o e-mail que você utiliza para fazer login no portal do afiliado.</p>
                    </div>

                    {!showPasswordSection ? (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowPasswordSection(true)}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition"
                        >
                          <Lock size={13} />
                          Alterar Minha Senha de Acesso
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                            <KeyRound size={14} className="text-amber-600" />
                            Redefinir Senha
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPasswordSection(false);
                              setEditNewPassword('');
                              setEditConfirmPassword('');
                            }}
                            className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 underline"
                          >
                            Cancelar
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-600 mb-1">
                              Nova Senha (mín. 6 dígitos)
                            </label>
                            <div className="relative">
                              <input
                                type={showPasswordText ? "text" : "password"}
                                value={editNewPassword}
                                onChange={(e) => setEditNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-2 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswordText(!showPasswordText)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                              >
                                {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-600 mb-1">
                              Confirmar Nova Senha
                            </label>
                            <input
                              type={showPasswordText ? "text" : "password"}
                              value={editConfirmPassword}
                              onChange={(e) => setEditConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-4 py-2 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500">Ao salvar, a senha será atualizada e sua conexão será mantida ativa.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="py-3 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md active:scale-98 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingProfile ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Salvar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Side Card: Summary */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 text-white shadow-md">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xl mb-4">
                  {(stats?.affiliate?.displayName || 'A').slice(0, 2).toUpperCase()}
                </div>
                <h4 className="font-serif font-bold text-lg mb-1">{stats?.affiliate?.displayName}</h4>
                <div className="inline-block px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-4">
                  Código: {stats?.affiliate?.code}
                </div>

                <div className="space-y-2 text-xs text-zinc-300 pt-3 border-t border-zinc-700/60">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Comissão por Venda:</span>
                    <strong className="text-amber-400">{stats?.affiliate?.defaultCommissionPercent || 10}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Status:</span>
                    <strong className="text-emerald-400">Ativo</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Membro desde:</span>
                    <span>{stats?.affiliate?.createdAt ? new Date(stats.affiliate.createdAt).toLocaleDateString() : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
                <h5 className="font-bold text-zinc-900 text-sm mb-2">Precisa de Ajuda?</h5>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                  Dúvidas sobre regras de repasses, pedidos ou suporte ao afiliado, nossa equipe está pronta para te atender.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('token');
                    window.location.reload();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 text-zinc-600 hover:text-red-600 hover:bg-red-50 text-xs font-semibold transition"
                >
                  Sair da Conta (Logout)
                </button>
              </div>
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
