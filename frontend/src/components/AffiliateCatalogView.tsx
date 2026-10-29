import React, { useEffect, useState } from 'react';
import { fetchApi, resolveMediaUrl } from '../api';
import {
  Sparkles,
  ShoppingBag,
  Share2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Search,
  ShieldCheck,
  Truck,
  MessageCircle,
  ArrowRight,
  Layers,
} from 'lucide-react';

const formatCurrency = (val: number | string) => {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface AffiliateCatalogViewProps {
  code: string;
  onSelectProduct?: (product: any) => void;
  onQuickAdd?: (product: any) => void;
  onNavigate?: (route: string) => void;
}

export const AffiliateCatalogView: React.FC<AffiliateCatalogViewProps> = ({
  code,
  onSelectProduct,
  onQuickAdd,
  onNavigate,
}) => {
  const [data, setData] = useState<{
    affiliate: { id: string; displayName: string; code: string; whatsapp?: string };
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
    // Record affiliate attribution in session and backend
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
        console.error('Falha ao carregar catálogo do afiliado:', err);
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

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-zinc-50">
        <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-600">Carregando catálogo do afiliado...</p>
      </div>
    );
  }

  if (!data || !data.affiliate) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-zinc-50">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
          <ShoppingBag size={32} />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Catálogo Não Encontrado</h2>
        <p className="text-sm text-zinc-600 max-w-md mb-6">
          Não localizamos o catálogo vinculado a este código de indicação ou o afiliado ainda não está ativo.
        </p>
        <button
          onClick={() => onNavigate ? onNavigate('/produtos') : (window.location.href = '/produtos')}
          className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-bold transition shadow-sm"
        >
          Explorar Todos os Produtos da Loja
        </button>
      </div>
    );
  }

  const { affiliate, collections, products } = data;

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

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Top Banner Notice */}
      <div className="bg-amber-600 text-white py-2 px-4 text-center text-xs font-semibold tracking-wide flex items-center justify-center gap-2">
        <Sparkles size={14} />
        <span>
          Você está navegando no catálogo exclusivo recomendado por <strong>{affiliate.displayName}</strong>
        </span>
      </div>

      {/* Hero Showcase Header */}
      <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950 text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-xl">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider mb-3">
                <Sparkles size={14} />
                Curadoria Oficial EuSou
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight font-serif mb-3">
                {affiliate.displayName}
              </h1>
              <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                Bem-vindo(a) à minha seleção especial! Aqui você encontra produtos colecionáveis, peças temáticas e utilitários fabricados em impressão 3D de altíssima qualidade.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 backdrop-blur-xs cursor-pointer border border-white/10 shadow-xs"
              >
                {copied ? <CheckCircle2 size={15} className="text-green-400" /> : <Copy size={15} />}
                {copied ? 'Link Copiado!' : 'Copiar Link'}
              </button>

              {cleanPhone && (
                <a
                  href={`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(
                    `Olá ${affiliate.displayName}! Vi seu catálogo na EuSou e gostaria de tirar uma dúvida sobre os produtos.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <MessageCircle size={15} />
                  Falar no WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Trust Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-8 mt-8 border-t border-white/10 text-xs text-zinc-300">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-amber-400 shrink-0" />
              <span>Compra 100% Segura e Garantida pela EuSou</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Truck size={18} className="text-amber-400 shrink-0" />
              <span>Entrega Rastreada para Todo o Brasil</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShoppingBag size={18} className="text-amber-400 shrink-0" />
              <span>Fabricação com Acabamento e Precisão 3D</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Tabs (Collections vs All) & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 pb-4 border-b border-zinc-200">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-amber-600 text-white shadow-sm'
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
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-sm'
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
                ? `Não encontramos itens com o termo "${search}". Tente buscar por outra palavra.`
                : 'Esta vitrine ainda não possui produtos ativos associados.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {visibleProducts.map((product) => {
              const productUrl = `/produtos/${product.slug}?ref=${affiliate.code}`;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-2xs hover:shadow-lg hover:border-amber-300 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Image Area */}
                    <div
                      onClick={() =>
                        onNavigate
                          ? onNavigate(productUrl)
                          : (window.location.href = productUrl)
                      }
                      className="w-full aspect-square bg-zinc-100 overflow-hidden cursor-pointer relative flex items-center justify-center"
                    >
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
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[10px] font-bold text-zinc-800 shadow-2xs">
                          {product.categoryName}
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-3.5 sm:p-4">
                      <h4
                        onClick={() =>
                          onNavigate
                            ? onNavigate(productUrl)
                            : (window.location.href = productUrl)
                        }
                        className="text-xs sm:text-sm font-bold text-zinc-900 line-clamp-2 hover:text-amber-700 transition cursor-pointer mb-2"
                        title={product.name}
                      >
                        {product.name}
                      </h4>

                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-base sm:text-lg font-black text-amber-700">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400">Em até 12x no cartão ou Pix</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-3.5 sm:p-4 pt-0">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate
                          ? onNavigate(productUrl)
                          : (window.location.href = productUrl)
                      }
                      className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Ver Produto</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
