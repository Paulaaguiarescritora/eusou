import React, { useEffect, useState } from 'react';
import { AffiliateDashboardStats, AffiliateLink, AffiliateConversion, Collection } from '../types';
import { fetchApi, resolveMediaUrl } from '../api';
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
  KeyRound,
  Search,
  Trash2,
  Edit,
  Palette,
  Download
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
  interface CategorySubItem {
    id: string;
    name: string;
    slug: string;
    parentId: string;
    productsCount: number;
  }
  interface CategoryTreeItem {
    id: string;
    name: string;
    slug: string;
    productsCount: number;
    subcategories: CategorySubItem[];
  }
  interface CatalogProductItem {
    id: string;
    name: string;
    slug: string;
    price: number;
    imageUrl: string | null;
    categoryIds?: string[];
    categoryLabel?: string;
  }

  const [availableProducts, setAvailableProducts] = useState<CatalogProductItem[]>([]);
  const [categoriesTree, setCategoriesTree] = useState<CategoryTreeItem[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [savingCollection, setSavingCollection] = useState(false);
  const [publicCatalogs, setPublicCatalogs] = useState<any[]>([]);
  const [shareProductSearch, setShareProductSearch] = useState('');
  const [shareCategoryFilter, setShareCategoryFilter] = useState<string | null>(null);

  // Theme Customization States
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [themePrimaryColor, setThemePrimaryColor] = useState('#d97706');
  const [themeBannerStyle, setThemeBannerStyle] = useState<'gradient' | 'minimal' | 'dark'>('gradient');
  const [themeStoreTitle, setThemeStoreTitle] = useState('');
  const [themeCustomBio, setThemeCustomBio] = useState('');
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeSavedSuccess, setThemeSavedSuccess] = useState(false);

  // Card & QR Code Generator States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrProduct, setQrProduct] = useState<any | null>(null);
  const [qrCardFormat, setQrCardFormat] = useState<'story' | 'feed'>('story');
  const [generatingCard, setGeneratingCard] = useState(false);

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

        if (affMe.themeConfig) {
          setThemePrimaryColor(affMe.themeConfig.primaryColor || '#d97706');
          setThemeBannerStyle(affMe.themeConfig.bannerStyle || 'gradient');
          setThemeStoreTitle(affMe.themeConfig.storeTitle || '');
          setThemeCustomBio(affMe.themeConfig.customBio || '');
        }

        // Carregar métricas, links, conversões, coleções, catálogos e produtos em paralelo para máxima velocidade
        const [dashRes, linksRes, convRes, colRes, homeRes, prodsRes, catsRes] = await Promise.allSettled([
          fetchApi<any>('/affiliate/dashboard'),
          fetchApi<any[]>('/affiliate/links'),
          fetchApi<any[]>('/affiliate/conversions'),
          fetchApi<any[]>('/affiliate/collections'),
          fetchApi<any>('/public/home'),
          fetchApi<any[]>('/affiliate/catalog-products'),
          fetchApi<any[]>('/affiliate/categories'),
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

        if (homeRes.status === 'fulfilled' && Array.isArray(homeRes.value?.catalogs)) {
          setPublicCatalogs(homeRes.value.catalogs);
        }

        let prodsList: any[] = [];
        if (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value) && prodsRes.value.length > 0) {
          prodsList = prodsRes.value;
        } else {
          try {
            const pubRes = await fetchApi<any>('/public/products?limit=100');
            const rawList = Array.isArray(pubRes) ? pubRes : pubRes?.data || [];
            prodsList = rawList.map((p: any) => {
              let price = Number(p.basePrice) || 0;
              if (!price && p.productChannelPrices && p.productChannelPrices.length > 0) {
                const cp = p.productChannelPrices.find((c: any) => c.channelType === 'OWN_STORE') || p.productChannelPrices[0];
                price = Number(cp.effectivePrice || cp.calculatedPrice || cp.manualPrice) || 0;
              }
              if (!price && p.wholesalePrice) price = Number(p.wholesalePrice) || 0;

              return {
                id: p.id,
                name: p.name,
                slug: p.slug,
                price,
                imageUrl: p.media?.[0]?.url || null,
                categoryIds: p.categories?.map((c: any) => c.categoryId || c.category?.id).filter(Boolean) || [],
                categoryLabel: p.categories?.[0]?.category?.name || 'Geral',
              };
            });
          } catch (e) {
            console.error('Error fetching public fallback products:', e);
          }
        }
        if (prodsList.length > 0) {
          setAvailableProducts(prodsList);
        }

        if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value) && catsRes.value.length > 0) {
          setCategoriesTree(catsRes.value);
        } else {
          try {
            const pubCats = await fetchApi<any[]>('/public/categories');
            if (Array.isArray(pubCats)) {
              setCategoriesTree(pubCats.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                productsCount: 0,
                subcategories: (c.children || []).map((sub: any) => ({
                  id: sub.id,
                  name: sub.name,
                  slug: sub.slug,
                  parentId: c.id,
                  productsCount: 0,
                })),
              })));
            }
          } catch {}
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

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTheme(true);
    setThemeSavedSuccess(false);
    try {
      const themeConfig = {
        primaryColor: themePrimaryColor,
        bannerStyle: themeBannerStyle,
        storeTitle: themeStoreTitle.trim(),
        customBio: themeCustomBio.trim(),
      };
      await fetchApi('/affiliate/me', {
        method: 'PATCH',
        body: JSON.stringify({ themeConfig }),
      });
      setThemeSavedSuccess(true);
      setTimeout(() => setThemeSavedSuccess(false), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar tema do catálogo');
    } finally {
      setSavingTheme(false);
    }
  };

  const downloadQrOnly = async (targetUrl: string, filename: string) => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qrcode-${filename}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Erro ao baixar QR code:', err);
    }
  };

  const downloadPromoCard = async (item: any | null, format: 'story' | 'feed') => {
    setGeneratingCard(true);
    try {
      const isStory = format === 'story';
      const width = 1080;
      const height = isStory ? 1920 : 1080;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const color = themePrimaryColor || '#d97706';

      // 1. Background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#09090b');
      bgGrad.addColorStop(0.5, '#18181b');
      bgGrad.addColorStop(1, color);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Top Header / Badge
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(80, 70, 360, 50, 25);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('CURADORIA EXCLUSIVA', 105, 104);

      const affName = (stats?.affiliate?.displayName || 'AFILIADO').toUpperCase();
      ctx.fillStyle = '#d4d4d8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`POR ${affName}`, 80, 160);

      const targetUrl = item
        ? `${baseOrigin}/produtos/${item.slug}?ref=${stats?.affiliate?.code}`
        : `${baseOrigin}/catalogo/${stats?.affiliate?.code}`;

      // 2. Product Image
      const imgY = isStory ? 220 : 160;
      const imgSize = isStory ? 760 : 460;
      const imgX = (width - imgSize) / 2;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgSize, imgSize, 36);
      ctx.fill();

      if (item && item.imageUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = resolveMediaUrl(item.imageUrl);
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(imgX + 16, imgY + 16, imgSize - 32, imgSize - 32, 28);
          ctx.clip();
          ctx.drawImage(img, imgX + 16, imgY + 16, imgSize - 32, imgSize - 32);
          ctx.restore();
        } catch {}
      }

      // 3. Title & Price
      const textY = isStory ? imgY + imgSize + 70 : imgY + 70;
      const title = item ? item.name : (themeStoreTitle || `Catálogo Oficial de ${stats?.affiliate?.displayName}`);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      const cleanTitle = title.length > 38 ? title.slice(0, 38) + '...' : title;
      ctx.fillText(cleanTitle, 80, textY);

      if (item) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 54px sans-serif';
        ctx.fillText(formatCurrency(item.price), 80, textY + 70);
      }

      // 4. QR Code
      const qrSize = isStory ? 280 : 200;
      const qrX = width - qrSize - 80;
      const qrY = height - qrSize - 70;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 20);
      ctx.fill();

      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize * 2}x${qrSize * 2}&data=${encodeURIComponent(targetUrl)}`;
      await new Promise((resolve) => {
        qrImg.onload = resolve;
        qrImg.onerror = resolve;
      });
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('APONTE A CÂMERA', 80, height - 110);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '20px sans-serif';
      ctx.fillText('Para comprar direto pelo link exclusivo', 80, height - 75);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `card-${item ? item.slug : 'catalogo'}-${format}.png`;
      a.click();
    } catch (err) {
      console.error('Erro ao gerar card:', err);
    } finally {
      setGeneratingCard(false);
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

  const loadCatalogProductsAndCategories = async (search?: string) => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const [prodRes, catRes] = await Promise.allSettled([
        fetchApi<any[]>(`/affiliate/catalog-products${q}`),
        fetchApi<any[]>('/affiliate/categories'),
      ]);
      if (prodRes.status === 'fulfilled' && Array.isArray(prodRes.value)) {
        setAvailableProducts(prodRes.value);
      }
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value)) {
        setCategoriesTree(catRes.value);
      }
    } catch (err) {
      console.error('Failed to load catalog products or categories:', err);
    }
  };

  const openCreateCollection = () => {
    setEditingCollection(null);
    setNewCollectionName('');
    setNewCollectionSlug('');
    setNewCollectionDesc('');
    setSelectedProductIds([]);
    setSelectedCategoryFilter(null);
    setSelectedSubcategoryFilter(null);
    setProductSearch('');
    setShowCreateCollectionModal(true);
    loadCatalogProductsAndCategories();
  };

  const openEditCollection = (col: any) => {
    setEditingCollection(col);
    setNewCollectionName(col.name || '');
    setNewCollectionSlug(col.slug || '');
    setNewCollectionDesc(col.description || '');
    const currentProductIds = Array.isArray(col.items)
      ? col.items.map((it: any) => it.productId || it.product?.id).filter(Boolean)
      : [];
    setSelectedProductIds(currentProductIds);
    setSelectedCategoryFilter(null);
    setSelectedSubcategoryFilter(null);
    setProductSearch('');
    setShowCreateCollectionModal(true);
    loadCatalogProductsAndCategories();
  };

  const handleSelectEntireCategory = (catId: string) => {
    const matchingProds = availableProducts.filter((p) => p.categoryIds?.includes(catId));
    const idsToAdd = matchingProds.map((p) => p.id);
    setSelectedProductIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectEntireCategory = (catId: string) => {
    const matchingProds = availableProducts.filter((p) => p.categoryIds?.includes(catId));
    const idsToRemove = new Set(matchingProds.map((p) => p.id));
    setSelectedProductIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta vitrine de coleção?')) return;
    try {
      await fetchApi(`/affiliate/collections/${collectionId}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir coleção');
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) {
      alert('Informe o nome da coleção.');
      return;
    }
    setSavingCollection(true);
    try {
      if (editingCollection) {
        await fetchApi(`/affiliate/collections/${editingCollection.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: newCollectionName.trim(),
            description: newCollectionDesc.trim() || undefined,
            productIds: selectedProductIds,
          }),
        });
      } else {
        await fetchApi('/affiliate/collections', {
          method: 'POST',
          body: JSON.stringify({
            name: newCollectionName.trim(),
            description: newCollectionDesc.trim() || undefined,
            productIds: selectedProductIds,
          }),
        });
      }
      setShowCreateCollectionModal(false);
      setNewCollectionName('');
      setNewCollectionSlug('');
      setNewCollectionDesc('');
      setSelectedProductIds([]);
      setEditingCollection(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar coleção de afiliado');
    } finally {
      setSavingCollection(false);
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
  const catalogRefLink = stats?.affiliate?.code ? `${baseOrigin}/produtos?ref=${stats.affiliate.code}` : '';
  const affiliatePageLink = stats?.affiliate?.code ? `${baseOrigin}/catalogo/${stats.affiliate.code}` : '';

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Minhas Coleções de Vitrine</h3>
              <p className="text-xs text-zinc-500">Agrupe seus produtos favoritos e divulgue sua vitrine personalizada com comissão</p>
            </div>
            <button
              onClick={openCreateCollection}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              <Plus size={16} /> Nova Coleção
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
                Nenhuma vitrine criada ainda. Clique em "Nova Coleção" para escolher produtos e montar sua vitrine!
              </div>
            ) : (
              collections.map((col: any) => {
                const colUrl = `${baseOrigin}/colecoes/${col.slug}?ref=${stats?.affiliate?.code}`;
                const itemsCount = col.items?.length || 0;
                const previewProducts = Array.isArray(col.items)
                  ? col.items.slice(0, 4).map((it: any) => it.product).filter(Boolean)
                  : [];

                return (
                  <div key={col.id} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-md border border-amber-200">
                          {itemsCount} {itemsCount === 1 ? 'produto' : 'produtos'} na vitrine
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">/{col.slug}</span>
                      </div>
                      <h4 className="font-bold text-zinc-900 text-base mb-1">{col.name}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 mb-3">
                        {col.description || 'Sem descrição cadastrada.'}
                      </p>

                      {/* Product Preview Thumbnails */}
                      {previewProducts.length > 0 && (
                        <div className="flex items-center gap-2 mb-4 py-2 border-y border-zinc-100">
                          {previewProducts.map((p: any, idx: number) => {
                            const imgUrl = p.media?.[0]?.url || p.imageUrl;
                            return (
                              <div
                                key={p.id || idx}
                                title={p.name}
                                className="w-10 h-10 rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0 flex items-center justify-center"
                              >
                                {imgUrl ? (
                                  <img
                                    src={resolveMediaUrl(imgUrl)}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <ShoppingBag size={14} className="text-zinc-400" />
                                )}
                              </div>
                            );
                          })}
                          {itemsCount > 4 && (
                            <span className="text-xs font-semibold text-zinc-400 pl-1">
                              +{itemsCount - 4} mais
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(colUrl, col.id)}
                          className="flex-1 py-2 px-3 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedLink === col.id ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                          {copiedLink === col.id ? 'Link Copiado!' : 'Copiar Vitrine'}
                        </button>
                        <a
                          href={colUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition cursor-pointer"
                          title="Abrir Coleção"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openEditCollection(col)}
                          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit size={13} />
                          Editar Produtos
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCollection(col.id)}
                          className="p-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Excluir Coleção"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Materiais de Divulgação & Catálogos</h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Divulgue o catálogo completo da loja, suas vitrines exclusivas e produtos com seu link de comissão rastreado.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-xs flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-600" />
                Sua comissão: {stats?.affiliate?.defaultCommissionPercent || 10}% por venda
              </span>
            </div>
          </div>

          {/* Section 1: Sua Página de Catálogo Exclusiva (Grande Destaque) */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold uppercase tracking-wider mb-3">
                  <Sparkles size={14} />
                  Sua Página Oficial de Catálogo
                </div>
                <h4 className="text-2xl sm:text-3xl font-black font-serif tracking-tight mb-2">
                  Catálogo & Vitrine de {stats?.affiliate?.displayName || 'Afiliado'}
                </h4>
                <p className="text-amber-50 text-xs sm:text-sm leading-relaxed mb-4">
                  Esta é a sua página própria de vendas. Seus seguidores verão seu nome, sua curadoria de produtos e todas as suas vitrines. Qualquer compra iniciada aqui garante automaticamente sua comissão!
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
                  <input
                    type="text"
                    readOnly
                    value={affiliatePageLink}
                    className="bg-white/95 text-zinc-900 border-none rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold flex-1 shadow-inner outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(affiliatePageLink, 'affiliate_page_link')}
                    className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
                  >
                    {copiedLink === 'affiliate_page_link' ? <CheckCircle2 size={15} className="text-green-400" /> : <Copy size={15} />}
                    {copiedLink === 'affiliate_page_link' ? 'Copiado!' : 'Copiar Link'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
                <a
                  href={affiliatePageLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-amber-50 text-amber-950 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm text-center"
                >
                  <ExternalLink size={14} />
                  Visualizar Minha Página
                </a>

                <button
                  type="button"
                  onClick={() => setShowThemeModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Palette size={14} className="text-amber-400" />
                  Personalizar Tema do Catálogo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQrProduct(null);
                    setShowQrModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer backdrop-blur-xs border border-white/20"
                >
                  <QrCode size={14} />
                  QR Code & Card da Loja
                </button>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Olá! Criei uma página com meu catálogo exclusivo de produtos colecionáveis e presentes incríveis. Dá uma olhada aqui: ${affiliatePageLink}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm text-center"
                >
                  <Share2 size={14} />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Section 1.5: Main Catalog & Store Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Product Catalog */}
            <div className="bg-gradient-to-br from-white to-amber-50/40 rounded-2xl border-2 border-amber-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-amber-600 text-white text-[10px] font-bold uppercase rounded-bl-xl tracking-wider">
                Recomendado
              </div>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-bold shadow-xs">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-base">Catálogo Completo de Produtos</h4>
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      Todas as Categorias • Link Rastreado
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
                  Leva o cliente diretamente para a página de catálogo com todos os produtos. Qualquer compra realizada nos próximos 30 dias comissiona você automaticamente.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-amber-100">
                <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-zinc-200 shadow-xs">
                  <input
                    type="text"
                    readOnly
                    value={catalogRefLink}
                    className="bg-transparent border-none text-xs font-mono text-zinc-800 flex-1 outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(catalogRefLink, 'catalog_input')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedLink === 'catalog_input' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    {copiedLink === 'catalog_input' ? 'Copiado!' : 'Copiar Link'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={catalogRefLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink size={14} />
                    Abrir Catálogo
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Olá! Dá uma olhada no catálogo de produtos e impressões 3D incríveis da EuSou que selecionei para você: ${catalogRefLink}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Share2 size={14} />
                    Divulgar no WhatsApp
                  </a>
                </div>
              </div>
            </div>

            {/* Store Home Link */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-base">Página Inicial da Loja</h4>
                    <span className="text-[11px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                      Home Store • Apresentação Geral
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
                  Ideal para colocar na biografia do Instagram, TikTok ou YouTube. O visitante conhece a marca e todos os destaques da EuSou com seu cookie de indicação.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <div className="flex items-center gap-2 p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                  <input
                    type="text"
                    readOnly
                    value={storeRefLink}
                    className="bg-transparent border-none text-xs font-mono text-zinc-800 flex-1 outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(storeRefLink, 'ref_input')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedLink === 'ref_input' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    {copiedLink === 'ref_input' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={storeRefLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink size={14} />
                    Abrir Loja
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Oi! Conheça as peças colecionáveis e decorações exclusivas da EuSou: ${storeRefLink}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Share2 size={14} />
                    Divulgar no WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Minhas Vitrines & Coleções Personalizadas */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100">
              <div>
                <h4 className="font-bold text-zinc-900 text-base flex items-center gap-2">
                  <Layers size={18} className="text-amber-600" />
                  Minhas Vitrines Personalizadas
                </h4>
                <p className="text-xs text-zinc-500">
                  Vitrines exclusivas montadas por você com os produtos que você mais recomenda.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateCollection}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                Nova Vitrine
              </button>
            </div>

            {collections.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                <p className="text-xs font-semibold text-zinc-700 mb-1">Você ainda não criou nenhuma vitrine personalizada</p>
                <p className="text-xs text-zinc-500 mb-3 max-w-md mx-auto">
                  Crie coleções temáticas como "Acessórios Pet" ou "Favoritos para Gatos" para aumentar em até 3x suas conversões!
                </p>
                <button
                  type="button"
                  onClick={openCreateCollection}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Criar Minha Primeira Vitrine
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((col) => {
                  const colLink = `${baseOrigin}/colecoes/${col.slug}?ref=${stats?.affiliate?.code}`;
                  const isCopied = copiedLink === `col_${col.id}`;
                  const countItems = col.items?.length || 0;

                  return (
                    <div
                      key={col.id}
                      className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 hover:bg-white hover:border-amber-300 hover:shadow-sm transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h5 className="font-bold text-zinc-900 text-sm truncate">{col.name}</h5>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                            {countItems} {countItems === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                        {col.description && (
                          <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{col.description}</p>
                        )}
                      </div>

                      <div className="space-y-2 pt-3 border-t border-zinc-200/60 mt-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={colLink}
                            className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] font-mono text-zinc-700 flex-1 outline-none truncate"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(colLink, `col_${col.id}`)}
                            className="p-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition cursor-pointer"
                            title="Copiar Link"
                          >
                            {isCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={colLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-700 text-center flex items-center justify-center gap-1"
                          >
                            <ExternalLink size={12} />
                            Ver Vitrine
                          </a>
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                              `Oi! Dá uma olhada nessa seleção exclusiva de "${col.name}" que preparei para você: ${colLink}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[11px] font-semibold text-center flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Share2 size={12} />
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Catálogos Oficiais da Loja (se cadastrados) */}
          {publicCatalogs.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <div className="mb-4 pb-3 border-b border-zinc-100">
                <h4 className="font-bold text-zinc-900 text-base flex items-center gap-2">
                  <ShoppingBag size={18} className="text-amber-600" />
                  Catálogos Oficiais da Loja
                </h4>
                <p className="text-xs text-zinc-500">
                  Catálogos temáticos preparados pela equipe da EuSou prontos para você compartilhar com seus clientes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicCatalogs.map((cat) => {
                  const catLink = `${baseOrigin}/catalogos/${cat.slug}?ref=${stats?.affiliate?.code}`;
                  const isCopied = copiedLink === `pubcat_${cat.id}`;

                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 hover:bg-white hover:border-amber-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <h5 className="font-bold text-zinc-900 text-sm mb-1">{cat.name}</h5>
                        {cat.description && (
                          <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{cat.description}</p>
                        )}
                      </div>

                      <div className="space-y-2 pt-3 border-t border-zinc-200/60 mt-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={catLink}
                            className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] font-mono text-zinc-700 flex-1 outline-none truncate"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(catLink, `pubcat_${cat.id}`)}
                            className="p-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition cursor-pointer"
                            title="Copiar Link"
                          >
                            {isCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={catLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-700 text-center flex items-center justify-center gap-1"
                          >
                            <ExternalLink size={12} />
                            Abrir
                          </a>
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                              `Olá! Confira o catálogo especial "${cat.name}" da loja EuSou: ${catLink}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[11px] font-semibold text-center flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Share2 size={12} />
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Produtos do Catálogo para Divulgação Individual */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100">
              <div>
                <h4 className="font-bold text-zinc-900 text-base flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-600" />
                  Divulgação de Produtos Individuais
                </h4>
                <p className="text-xs text-zinc-500">
                  Gere o link comissionado direto de qualquer produto com 1 clique para mandar ao seu seguidor ou cliente.
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-3 mb-5">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Pesquisar produto pelo nome..."
                  value={shareProductSearch}
                  onChange={(e) => setShareProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-xs bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                />
              </div>

              {categoriesTree.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase mr-1">Filtrar:</span>
                  <button
                    type="button"
                    onClick={() => setShareCategoryFilter(null)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      shareCategoryFilter === null
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    Todos ({availableProducts.length})
                  </button>
                  {categoriesTree.map((cat) => {
                    const isActive = shareCategoryFilter === cat.id;
                    const catCount = availableProducts.filter((p) => p.categoryIds?.includes(cat.id)).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setShareCategoryFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isActive
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {cat.name} ({catCount})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Product Cards Grid */}
            {availableProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Carregando catálogo de produtos...
              </div>
            ) : (() => {
              const filteredProds = availableProducts.filter((p) => {
                if (shareCategoryFilter && !p.categoryIds?.includes(shareCategoryFilter)) return false;
                if (shareProductSearch && !p.name.toLowerCase().includes(shareProductSearch.toLowerCase())) return false;
                return true;
              });

              if (filteredProds.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-zinc-500 bg-zinc-50 rounded-xl">
                    Nenhum produto encontrado com este filtro ou busca.
                  </div>
                );
              }

              const commPercent = (Number(stats?.affiliate?.defaultCommissionPercent) || 10) / 100;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-1">
                  {filteredProds.map((prod) => {
                    const prodLink = `${baseOrigin}/produtos/${prod.slug}?ref=${stats?.affiliate?.code}`;
                    const isCopied = copiedLink === `prod_${prod.id}`;
                    const estComm = prod.price * commPercent;

                    return (
                      <div
                        key={prod.id}
                        className="bg-white border border-zinc-200 rounded-xl p-3 shadow-xs hover:border-amber-400 hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="w-full h-32 rounded-lg bg-zinc-100 border border-zinc-100 overflow-hidden mb-2.5 flex items-center justify-center">
                            {prod.imageUrl ? (
                              <img
                                src={resolveMediaUrl(prod.imageUrl)}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <ShoppingBag size={24} className="text-zinc-300" />
                            )}
                          </div>

                          <h5 className="font-bold text-zinc-900 text-xs line-clamp-2 mb-1" title={prod.name}>
                            {prod.name}
                          </h5>

                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-xs font-bold text-amber-700">{formatCurrency(prod.price)}</span>
                            {prod.categoryLabel && (
                              <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded truncate max-w-[110px]">
                                {prod.categoryLabel}
                              </span>
                            )}
                          </div>

                          <div className="mb-3 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200/60 text-[11px] font-bold text-emerald-800 flex items-center justify-between">
                            <span>Sua comissão:</span>
                            <span>~{formatCurrency(estComm)}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(prodLink, `prod_${prod.id}`)}
                              className="py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                            >
                              {isCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                              <span>{isCopied ? 'Copiado!' : 'Copiar Link'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setQrProduct(prod);
                                setShowQrModal(true);
                              }}
                              className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                            >
                              <QrCode size={12} className="text-amber-400" />
                              <span>Card & QR</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                `Oi! Olha que incrível esse ${prod.name} por apenas ${formatCurrency(prod.price)} na loja EuSou: ${prodLink}`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[11px] font-semibold text-center flex items-center justify-center gap-1 shadow-xs"
                            >
                              <Share2 size={12} />
                              WhatsApp
                            </a>
                            <a
                              href={prodLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-700 transition"
                              title="Visualizar produto na loja"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Section 5: Textos Prontos para Redes Sociais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <h4 className="font-bold text-zinc-900 text-base mb-2">Texto para Feed & Stories</h4>
              <p className="text-xs text-zinc-500 mb-3">
                Copie um texto pronto e engajador para postar no Instagram, Threads ou TikTok:
              </p>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-700 italic mb-3">
                "Galera, confiram os colecionáveis e decorações em impressão 3D incríveis na loja EuSou! Use meu link para garantir os melhores lançamentos: {catalogRefLink}"
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `Galera, confiram os colecionáveis e decorações em impressão 3D incríveis na loja EuSou! Use meu link para garantir os melhores lançamentos: ${catalogRefLink}`,
                    'copy_msg'
                  )
                }
                className="w-full py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedLink === 'copy_msg' ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                {copiedLink === 'copy_msg' ? 'Mensagem Copiada!' : 'Copiar Texto Pronto'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <h4 className="font-bold text-zinc-900 text-base mb-2">Mensagem Direta 1-a-1</h4>
              <p className="text-xs text-zinc-500 mb-3">
                Para enviar no privado quando alguém perguntar sobre presentes, pets ou decoração:
              </p>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-700 italic mb-3">
                "Oi! Eu sou parceiro oficial da EuSou, uma loja incrível com produtos temáticos de altíssima qualidade. Separei o catálogo com todas as peças aqui para você dar uma olhada: {catalogRefLink}"
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `Oi! Eu sou parceiro oficial da EuSou, uma loja incrível com produtos temáticos de altíssima qualidade. Separei o catálogo com todas as peças aqui para você dar uma olhada: ${catalogRefLink}`,
                    'copy_msg_direct'
                  )
                }
                className="w-full py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedLink === 'copy_msg_direct' ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                {copiedLink === 'copy_msg_direct' ? 'Mensagem Copiada!' : 'Copiar Texto Direto'}
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

      {/* Modal: Personalizar Tema do Catálogo */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Palette size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Personalizar Tema do Catálogo</h3>
                  <p className="text-xs text-zinc-500">
                    Defina as cores, estilo visual e apresentação da sua página de vendas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTheme} className="space-y-5 pt-4 flex-1 overflow-y-auto pr-1">
              {themeSavedSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Tema salvo e aplicado com sucesso à sua página de catálogo!</span>
                </div>
              )}

              {/* Cor Primária */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
                  Cor Principal do Tema
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  {[
                    { label: 'Dourado', hex: '#d97706' },
                    { label: 'Esmeralda', hex: '#059669' },
                    { label: 'Violeta', hex: '#7c3aed' },
                    { label: 'Safira', hex: '#2563eb' },
                    { label: 'Coral', hex: '#e11d48' },
                    { label: 'Grafite', hex: '#18181b' },
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setThemePrimaryColor(preset.hex)}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                        themePrimaryColor === preset.hex
                          ? 'border-zinc-950 ring-2 ring-zinc-950/20 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full shadow-xs" style={{ backgroundColor: preset.hex }} />
                      <span className="text-[11px] font-semibold text-zinc-700">{preset.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 p-2 bg-zinc-50 rounded-xl border border-zinc-200">
                  <input
                    type="color"
                    value={themePrimaryColor}
                    onChange={(e) => setThemePrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <div className="text-xs">
                    <span className="text-zinc-500 block">Cor personalizada (Hex):</span>
                    <span className="font-mono font-bold text-zinc-800">{themePrimaryColor}</span>
                  </div>
                </div>
              </div>

              {/* Estilo do Banner */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
                  Estilo Visual do Banner
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'gradient', label: 'Gradiente Moderno', desc: 'Tons vibrantes e modernos' },
                    { id: 'dark', label: 'Escuro Elegante', desc: 'Preto luxo cinematográfico' },
                    { id: 'minimal', label: 'Minimalista Claro', desc: 'Fundo branco limpo' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setThemeBannerStyle(style.id as any)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        themeBannerStyle === style.id
                          ? 'border-zinc-950 ring-2 ring-zinc-950/20 bg-zinc-50'
                          : 'border-zinc-200 hover:border-zinc-400 bg-white'
                      }`}
                    >
                      <span className="text-xs font-bold text-zinc-900 block mb-1">{style.label}</span>
                      <span className="text-[10px] text-zinc-500 leading-tight">{style.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título da Loja */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  Nome da Vitrine / Título da Loja
                </label>
                <input
                  type="text"
                  placeholder={stats?.affiliate?.displayName || 'Ex: Minha Loja Geek & Pets'}
                  value={themeStoreTitle}
                  onChange={(e) => setThemeStoreTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Bio / Slogan */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  Mensagem de Boas-Vindas / Slogan
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Sejam bem-vindos! Selecionei pessoalmente os melhores colecionáveis e presentes 3D com entrega garantida."
                  value={themeCustomBio}
                  onChange={(e) => setThemeCustomBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
              </div>

              {/* Preview Mini Box */}
              <div className="p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                  Pré-visualização do Topo do Catálogo:
                </span>
                <div
                  style={{
                    backgroundColor: themeBannerStyle === 'minimal' ? '#ffffff' : '#18181b',
                    borderColor: themeBannerStyle === 'minimal' ? '#e4e4e7' : 'transparent',
                  }}
                  className="p-4 rounded-xl border shadow-inner flex items-center justify-between"
                >
                  <div>
                    <span
                      style={{ color: themePrimaryColor }}
                      className="text-[10px] font-bold uppercase tracking-wider block mb-0.5"
                    >
                      ✦ Curadoria Verificada
                    </span>
                    <h5
                      className={`text-sm font-black font-serif ${
                        themeBannerStyle === 'minimal' ? 'text-zinc-900' : 'text-white'
                      }`}
                    >
                      {themeStoreTitle.trim() || stats?.affiliate?.displayName || 'Minha Vitrine'}
                    </h5>
                  </div>
                  <div
                    style={{ backgroundColor: themePrimaryColor }}
                    className="px-3 py-1 rounded-lg text-white text-[10px] font-bold shadow-xs"
                  >
                    Comprar
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowThemeModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={savingTheme}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingTheme ? 'Salvando...' : 'Salvar e Aplicar Tema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerador de Card Promocional & QR Code */}
      {showQrModal && (() => {
        const targetUrl = qrProduct
          ? `${baseOrigin}/produtos/${qrProduct.slug}?ref=${stats?.affiliate?.code}`
          : affiliatePageLink;
        const targetTitle = qrProduct ? qrProduct.name : (themeStoreTitle || `Catálogo Oficial de ${stats?.affiliate?.displayName}`);
        const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(targetUrl)}`;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">Card Promocional & QR Code</h3>
                    <p className="text-xs text-zinc-500">
                      Gere imagens prontas para Stories, WhatsApp e materiais impressos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5 pt-4 flex-1 overflow-y-auto pr-1">
                {/* Target Summary */}
                <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 flex items-center gap-3">
                  {qrProduct ? (
                    <div className="w-14 h-14 rounded-xl bg-white border border-zinc-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {qrProduct.imageUrl ? (
                        <img
                          src={resolveMediaUrl(qrProduct.imageUrl)}
                          alt={qrProduct.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag size={24} className="text-zinc-300" />
                      )}
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-amber-600 text-white font-black text-xl shrink-0 flex items-center justify-center shadow-xs">
                      {stats?.affiliate?.displayName?.charAt(0) || 'L'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-block mb-1 uppercase">
                      {qrProduct ? 'Produto Selecionado' : 'Loja Completa'}
                    </span>
                    <h5 className="font-bold text-zinc-900 text-xs sm:text-sm truncate">{targetTitle}</h5>
                    {qrProduct && (
                      <p className="text-xs font-extrabold text-amber-700">{formatCurrency(qrProduct.price)}</p>
                    )}
                  </div>
                </div>

                {/* QR Code Direct Box */}
                <div className="p-4 bg-zinc-900 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="w-32 h-32 bg-white rounded-xl p-2 shrink-0 flex items-center justify-center shadow-md">
                    <img
                      src={qrCodeApiUrl}
                      alt="QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <h5 className="font-bold text-sm text-white">QR Code Escaneável</h5>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Seus clientes podem apontar a câmera do celular para este código para acessar diretamente sua página ou produto com seu link de comissão.
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadQrOnly(targetUrl, qrProduct ? qrProduct.slug : 'catalogo')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer w-full sm:w-auto"
                    >
                      <Download size={14} />
                      Baixar Somente o QR Code (PNG)
                    </button>
                  </div>
                </div>

                {/* Card Promocional Generator */}
                <div className="p-4 bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-zinc-900 text-sm">Card Promocional Pronto para Postar</h5>
                      <p className="text-xs text-zinc-500">Gera imagem de alta resolução com foto, preço e QR Code integrado</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-zinc-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setQrCardFormat('story')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          qrCardFormat === 'story' ? 'bg-amber-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Stories (9:16)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrCardFormat('feed')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          qrCardFormat === 'feed' ? 'bg-amber-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Feed (1:1)
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={generatingCard}
                    onClick={() => downloadPromoCard(qrProduct, qrCardFormat)}
                    className="w-full py-3 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Download size={15} className="text-amber-400" />
                    <span>{generatingCard ? 'Gerando Imagem...' : `Baixar Card ${qrCardFormat === 'story' ? 'Stories (9:16)' : 'Feed (1:1)'} em Alta Definição (PNG)`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Create / Edit Collection with Product Picker */}
      {showCreateCollectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">
                  {editingCollection ? 'Editar Coleção de Vitrine' : 'Criar Nova Coleção de Vitrine'}
                </h3>
                <p className="text-xs text-zinc-500">
                  Selecione os produtos que você quer destacar para seus seguidores
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCollectionModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCollection} className="space-y-4 pt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Nome da Coleção *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Meus Favoritos de Decoração"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Descrição Curta (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: As peças que mais recomendo para colecionadores"
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Product Selector Section */}
              <div className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag size={14} className="text-amber-600" />
                      Escolha os Produtos da Vitrine
                    </label>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {selectedProductIds.length} {selectedProductIds.length === 1 ? 'selecionado' : 'selecionados'}
                    </span>
                  </div>
                  {availableProducts.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds(availableProducts.map((p) => p.id))}
                        className="text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                      >
                        Selecionar Todos
                      </button>
                      <span className="text-zinc-300">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds([])}
                        className="text-xs text-zinc-500 hover:text-zinc-700 font-semibold cursor-pointer"
                      >
                        Limpar Todos
                      </button>
                    </div>
                  )}
                </div>

                {/* Category & Subcategory Filter Bar */}
                {categoriesTree.length > 0 && (
                  <div className="mb-3 space-y-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                    {/* Primary Categories */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-between">
                        <span>Categorias:</span>
                        {selectedCategoryFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryFilter(null);
                              setSelectedSubcategoryFilter(null);
                            }}
                            className="text-amber-700 hover:text-amber-800 font-medium normal-case cursor-pointer"
                          >
                            Ver todas as categorias
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryFilter(null);
                            setSelectedSubcategoryFilter(null);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            selectedCategoryFilter === null
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                          }`}
                        >
                          Todas ({availableProducts.length})
                        </button>
                        {categoriesTree.map((cat) => {
                          const isActive = selectedCategoryFilter === cat.id;
                          const catProds = availableProducts.filter((p) => p.categoryIds?.includes(cat.id));
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategoryFilter(cat.id);
                                setSelectedSubcategoryFilter(null);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                isActive
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                              }`}
                            >
                              {cat.name} ({catProds.length})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subcategories (shown when parent category selected) */}
                    {selectedCategoryFilter && (() => {
                      const activeRoot = categoriesTree.find((c) => c.id === selectedCategoryFilter);
                      if (!activeRoot || activeRoot.subcategories.length === 0) return null;

                      return (
                        <div className="pt-2 border-t border-zinc-200/60">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                            Subcategorias de {activeRoot.name}:
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSubcategoryFilter(null)}
                              className={`px-2 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                selectedSubcategoryFilter === null
                                  ? 'bg-zinc-800 text-white shadow-xs'
                                  : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                              }`}
                            >
                              Todas de {activeRoot.name}
                            </button>
                            {activeRoot.subcategories.map((sub) => {
                              const isSubActive = selectedSubcategoryFilter === sub.id;
                              const subProds = availableProducts.filter((p) => p.categoryIds?.includes(sub.id));
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => setSelectedSubcategoryFilter(sub.id)}
                                  className={`px-2 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                    isSubActive
                                      ? 'bg-zinc-800 text-white shadow-xs'
                                      : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                                  }`}
                                >
                                  {sub.name} ({subProds.length})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Category Action Box */}
                    {selectedCategoryFilter && (() => {
                      const activeRoot = categoriesTree.find((c) => c.id === selectedCategoryFilter);
                      const activeSub = activeRoot?.subcategories.find((s) => s.id === selectedSubcategoryFilter);
                      const targetId = selectedSubcategoryFilter || selectedCategoryFilter;
                      const targetName = activeSub ? `subcategoria "${activeSub.name}"` : `categoria "${activeRoot?.name}"`;
                      const targetProds = availableProducts.filter((p) => p.categoryIds?.includes(targetId));
                      const allTargetSelected = targetProds.length > 0 && targetProds.every((p) => selectedProductIds.includes(p.id));

                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/60 bg-amber-50/70 p-2 rounded-lg">
                          <span className="text-xs text-amber-900 font-medium">
                            Ação rápida para {targetName} ({targetProds.length} produtos):
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectEntireCategory(targetId)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1"
                            >
                              <Plus size={13} />
                              Selecionar todos de {activeSub ? activeSub.name : activeRoot?.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeselectEntireCategory(targetId)}
                              className="px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 text-xs font-medium rounded-lg transition cursor-pointer"
                            >
                              Desmarcar categoria
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Search Bar */}
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Filtrar produtos por nome..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-zinc-200 rounded-xl text-xs bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                  />
                </div>

                {/* Products List / Grid */}
                <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 divide-y divide-zinc-100 bg-zinc-50/50 p-1">
                  {availableProducts.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-400">
                      Carregando produtos do catálogo...
                    </div>
                  ) : (() => {
                    const filtered = availableProducts.filter((product) => {
                      if (selectedSubcategoryFilter && !product.categoryIds?.includes(selectedSubcategoryFilter)) {
                        return false;
                      }
                      if (selectedCategoryFilter && !selectedSubcategoryFilter && !product.categoryIds?.includes(selectedCategoryFilter)) {
                        return false;
                      }
                      if (productSearch && !product.name.toLowerCase().includes(productSearch.toLowerCase())) {
                        return false;
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-zinc-500">
                          Nenhum produto encontrado nesta categoria ou pesquisa.
                        </div>
                      );
                    }

                    return filtered.map((product) => {
                      const isSelected = selectedProductIds.includes(product.id);
                      return (
                        <div
                          key={product.id}
                          onClick={() => toggleProductSelection(product.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50/90 border border-amber-300 text-amber-950 font-medium'
                              : 'bg-white hover:bg-zinc-50 text-zinc-700 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-lg border border-zinc-200 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                              {product.imageUrl ? (
                                <img
                                  src={resolveMediaUrl(product.imageUrl)}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <ShoppingBag size={18} className="text-zinc-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate text-zinc-900">{product.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-amber-700 font-bold">{formatCurrency(product.price)}</span>
                                {product.categoryLabel && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 rounded">
                                    {product.categoryLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 pl-3">
                            {isSelected ? (
                              <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
                                <Check size={14} />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-lg border-2 border-zinc-300 bg-white" />
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <p className="text-xs text-zinc-400 mt-1.5">
                  Clique nos produtos para marcar ou desmarcar. Os itens marcados formarão a vitrine exclusiva do seu link.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCreateCollectionModal(false)}
                  className="px-4 py-2.5 border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCollection}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
                >
                  {savingCollection ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{editingCollection ? 'Salvar Alterações' : `Criar Coleção (${selectedProductIds.length})`}</span>
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
