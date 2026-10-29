import React, { useEffect, useState } from 'react';
import { fetchApi, resolveMediaUrl } from '../api';
import {
  Sparkles,
  ShoppingBag,
  Share2,
  CheckCircle2,
  Copy,
  Search,
  ShieldCheck,
  Truck,
  MessageCircle,
  ArrowRight,
  Layers,
  ShoppingCart,
} from 'lucide-react';

const formatCurrency = (val: number | string) => {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface ThemeConfig {
  primaryColor?: string;
  bannerStyle?: 'gradient' | 'minimal' | 'dark';
  storeTitle?: string;
  customBio?: string;
}

interface AffiliateCatalogViewProps {
  code: string;
  cartCount?: number;
  onAddToCart?: (product: any) => void;
  onNavigate?: (route: string) => void;
}

export const AffiliateCatalogView: React.FC<AffiliateCatalogViewProps> = ({
  code,
  cartCount = 0,
  onAddToCart,
  onNavigate,
}) => {
  const [data, setData] = useState<{
    affiliate: {
      id: string;
      displayName: string;
      code: string;
      whatsapp?: string;
      themeConfig?: ThemeConfig | null;
    };
    collections: Array<{
      id: string;
      name: string;
      slug: string;
      description?: string;
      products: any[];
    }>;
    products: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (code) {
      try {
        localStorage.setItem('eusou_ref_code', code);
      } catch {}

      fetchApi('/public/affiliate/click', {
        method: 'POST',
        body: JSON.stringify({ refCode: code }),
      }).catch(() => {});
    }

    setLoading(true);
    fetchApi<any>(`/public/affiliate/catalog/${encodeURIComponent(code)}`)
      .then((res) => {
        if (res && res.affiliate) {
          setData(res);
        } else {
          setData(null);
        }
      })
      .catch((err) => {
        console.error('Falha ao carregar catálogo:', err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [code]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleBuyProduct = (product: any) => {
    if (onAddToCart) {
      onAddToCart({
        productId: product.id,
        name: product.name,
        unitPrice: Number(product.price) || 0,
        quantity: 1,
        imageUrl: product.imageUrl || null,
        nicheName: product.categoryName || null,
      });
    } else if (onNavigate) {
      onNavigate('/carrinho');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-50">
        <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-600">Carregando catálogo exclusivo...</p>
      </div>
    );
  }

  if (!data || !data.affiliate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-zinc-50">
        <div className="w-16 h-16 rounded-2xl bg-zinc-200 text-zinc-700 flex items-center justify-center mb-4">
          <ShoppingBag size={32} />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Catálogo Não Encontrado</h2>
        <p className="text-sm text-zinc-600 max-w-md mb-6">
          Não foi possível encontrar a vitrine solicitada com este código de indicação.
        </p>
      </div>
    );
  }

  const { affiliate, collections, products } = data;
  const theme = affiliate.themeConfig || {};
  const primaryColor = theme.primaryColor || '#d97706';
  const bannerStyle = theme.bannerStyle || 'gradient';
  const displayTitle = theme.storeTitle?.trim() || affiliate.displayName;
  const displayBio =
    theme.customBio?.trim() ||
    'Bem-vindo(a) à minha vitrine oficial! Selecionei pessoalmente cada peça deste catálogo com fabricação de altíssima qualidade e acabamento impecável.';

  // Compute products according to activeTab
  let visibleProducts = products || [];
  if (activeTab !== 'all') {
    const selectedCol = collections.find((c) => c.id === activeTab);
    if (selectedCol) {
      visibleProducts = selectedCol.products || [];
    }
  }

  if (search.trim()) {
    visibleProducts = visibleProducts.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }

  const cleanPhone = affiliate.whatsapp ? affiliate.whatsapp.replace(/\D/g, '') : '';

  // Banner background style
  let bannerBgClass = 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950';
  let bannerInlineStyle: React.CSSProperties = {};

  if (bannerStyle === 'gradient') {
    bannerInlineStyle = {
      background: `linear-gradient(135deg, #18181b 0%, ${primaryColor} 140%)`,
    };
  } else if (bannerStyle === 'dark') {
    bannerInlineStyle = {
      background: '#121214',
    };
  } else if (bannerStyle === 'minimal') {
    bannerInlineStyle = {
      background: '#ffffff',
      color: '#18181b',
      borderBottom: '1px solid #e4e4e7',
    };
  }

  const isMinimal = bannerStyle === 'minimal';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-between">
      <div>
        {/* Dedicated White-Label Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            {/* Brand Logo / Name */}
            <div className="flex items-center gap-2.5">
              <div
                style={{ backgroundColor: primaryColor }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shadow-xs uppercase"
              >
                {displayTitle.charAt(0)}
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 leading-tight">
                  {displayTitle}
                </h2>
                <span className="text-[10px] font-medium text-zinc-500 block">Vitrine Oficial</span>
              </div>
            </div>

            {/* Header Right Actions: Search / WhatsApp / Cart */}
            <div className="flex items-center gap-2 sm:gap-3">
              {cleanPhone && (
                <a
                  href={`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(
                    `Olá ${affiliate.displayName}! Gostaria de tirar uma dúvida sobre os produtos do seu catálogo.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition shadow-xs"
                >
                  <MessageCircle size={14} />
                  <span>WhatsApp</span>
                </a>
              )}

              {/* Cart Button */}
              <button
                type="button"
                onClick={() => (onNavigate ? onNavigate('/carrinho') : (window.location.href = '/carrinho'))}
                style={{ borderColor: primaryColor }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold transition shadow-xs cursor-pointer relative"
              >
                <ShoppingCart size={16} style={{ color: primaryColor }} />
                <span className="hidden sm:inline">Carrinho</span>
                {cartCount > 0 && (
                  <span
                    style={{ backgroundColor: primaryColor }}
                    className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-xs"
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Hero Showcase Header */}
        <div
          style={bannerInlineStyle}
          className={`py-12 sm:py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-md ${
            isMinimal ? 'text-zinc-900' : 'text-white'
          }`}
        >
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div
                  style={{
                    backgroundColor: isMinimal ? '#f4f4f5' : `${primaryColor}25`,
                    color: isMinimal ? primaryColor : '#fef08a',
                    borderColor: isMinimal ? '#e4e4e7' : `${primaryColor}40`,
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-3"
                >
                  <Sparkles size={13} />
                  Curadoria Verificada
                </div>

                <h1 className="text-3xl sm:text-5xl font-black tracking-tight font-serif mb-3">
                  {displayTitle}
                </h1>

                <p
                  className={`text-sm sm:text-base leading-relaxed ${
                    isMinimal ? 'text-zinc-600' : 'text-zinc-300'
                  }`}
                >
                  {displayBio}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 backdrop-blur-xs cursor-pointer border shadow-xs ${
                    isMinimal
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-200'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                  }`}
                >
                  {copied ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                  {copied ? 'Link Copiado!' : 'Copiar Link da Loja'}
                </button>

                {cleanPhone && (
                  <a
                    href={`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(
                      `Olá ${affiliate.displayName}! Gostaria de falar sobre os produtos do seu catálogo.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
                  >
                    <MessageCircle size={15} />
                    Falar com Atendente
                  </a>
                )}
              </div>
            </div>

            {/* Trust Highlights */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-8 mt-8 border-t text-xs ${
                isMinimal ? 'border-zinc-200 text-zinc-600' : 'border-white/10 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} style={{ color: primaryColor }} className="shrink-0" />
                <span>Compra 100% Segura e Protegida</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Truck size={18} style={{ color: primaryColor }} className="shrink-0" />
                <span>Envio Rápido e Rastreamento Direto</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={18} style={{ color: primaryColor }} className="shrink-0" />
                <span>Qualidade e Acabamento Premium</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Products Section */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          {/* Navigation Tabs (Collections vs All) & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 pb-4 border-b border-zinc-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                style={
                  activeTab === 'all'
                    ? { backgroundColor: primaryColor, color: '#ffffff' }
                    : undefined
                }
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'shadow-xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                }`}
              >
                Todos os Produtos ({products.length})
              </button>

              {collections.map((col) => {
                const isActive = activeTab === col.id;
                const colCount = col.products?.length || 0;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setActiveTab(col.id)}
                    style={
                      isActive
                        ? { backgroundColor: primaryColor, color: '#ffffff' }
                        : undefined
                    }
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'shadow-xs'
                        : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}
                  >
                    <Layers size={14} />
                    {col.name} ({colCount})
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar produtos neste catálogo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none transition shadow-2xs"
              />
            </div>
          </div>

          {/* Product Cards Grid */}
          {visibleProducts.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-zinc-300 p-8">
              <ShoppingBag size={40} className="mx-auto text-zinc-300 mb-3" />
              <h3 className="font-bold text-zinc-800 text-base mb-1">Nenhum produto encontrado</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {search
                  ? `Não encontramos itens com o termo "${search}".`
                  : 'Nenhum produto disponível nesta categoria no momento.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {visibleProducts.map((product) => {
                return (
                  <div
                    key={product.id}
                    onClick={() => handleBuyProduct(product)}
                    className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-2xs hover:shadow-xl hover:border-zinc-400 transition-all flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      {/* Image Area */}
                      <div className="w-full aspect-square bg-zinc-100 overflow-hidden relative flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={resolveMediaUrl(product.imageUrl)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <ShoppingBag size={32} className="text-zinc-300" />
                        )}

                        {product.categoryName && (
                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[10px] font-bold text-zinc-800 shadow-2xs">
                            {product.categoryName}
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="p-3.5 sm:p-4">
                        <h4
                          className="text-xs sm:text-sm font-bold text-zinc-900 line-clamp-2 group-hover:text-amber-700 transition mb-2"
                          title={product.name}
                        >
                          {product.name}
                        </h4>

                        <div className="flex items-baseline gap-1.5 mb-1">
                          <span
                            style={{ color: primaryColor }}
                            className="text-base sm:text-lg font-black"
                          >
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">Em até 12x ou Pix</p>
                      </div>
                    </div>

                    {/* Direct to Cart Action Button */}
                    <div className="p-3.5 sm:p-4 pt-0">
                      <button
                        type="button"
                        style={{ backgroundColor: primaryColor }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyProduct(product);
                        }}
                        className="w-full py-2.5 rounded-xl hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <ShoppingCart size={14} />
                        <span>Comprar Agora</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Standalone White-Label Footer */}
      <footer className="bg-white border-t border-zinc-200 py-8 px-4 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <div
              style={{ backgroundColor: primaryColor }}
              className="w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center uppercase"
            >
              {displayTitle.charAt(0)}
            </div>
            <span className="font-semibold text-zinc-800">{displayTitle}</span>
            <span>•</span>
            <span>Vitrine Oficial</span>
          </div>

          <p>© {new Date().getFullYear()} {displayTitle}. Todos os direitos reservados.</p>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-600" />
              Ambiente Seguro
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
