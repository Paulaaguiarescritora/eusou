import React from 'react';
import {
  Sparkles,
  ArrowRight,
  Layers,
  Share2,
  ShoppingBag,
  Heart,
  CheckCircle2,
  PawPrint,
} from 'lucide-react';
import { Store } from '../types';

export const DEFAULT_STORES: Store[] = [
  {
    id: 'b1105636-1e1f-4fb3-a6a1-70dd402fae43',
    name: 'Pet Shop',
    slug: 'pet-shop',
    brandName: 'Felinodélia',
    description: 'Design inovador, comedouros ergonômicos, brinquedos interativos e coleções exclusivas para cães e gatos.',
    productsCount: 38,
    categoriesCount: 6,
    catalogs: [
      {
        id: '4e739a90-b836-4613-86d1-aa799ec91373',
        name: 'Catálogo Vitrine Pet & Design',
        slug: 'vitrine-pet-design',
        description: 'Linha completa para pets com comedouros e brinquedos de catnip',
      },
    ],
  },
  {
    id: '510eb44f-8cca-4bc9-a7d0-093abe0abf2d',
    name: 'Romance',
    slug: 'romance',
    brandName: 'Romance',
    description: 'Carimbos marcadores, ejetores e cortadores de precisão para brigadeiros gourmet, biscoitos e confeitaria artística.',
    productsCount: 4,
    categoriesCount: 1,
    catalogs: [
      {
        id: '4e3dfd25-6835-49ce-a84f-05e28a0b32ab',
        name: 'Catálogo Confeitaria Romance',
        slug: 'catalogo-confeitaria-romance',
        description: 'Carimbos e cortadores artesanais para brigadeiros gourmet',
      },
    ],
  },
  {
    id: '21266e0c-6af5-4bb4-a688-c804ed5f522e',
    name: 'Sensora Íntima',
    slug: 'sensora-intima',
    brandName: 'Sensora Íntima',
    description: 'Linha sensorial exclusiva de bem-estar, cosméticos aromáticos e autocuidado. Em breve novidades.',
    productsCount: 0,
    categoriesCount: 0,
    catalogs: [
      {
        id: '74b5a356-faf9-4231-a11c-0749bc57fb34',
        name: 'Catálogo Sensora Íntima',
        slug: 'catalogo-sensora-intima',
        description: 'Velas de massagem beijáveis e cosméticos sensoriais',
      },
    ],
  },
];

export interface TrustPillar {
  icon: string;
  title: string;
  desc: string;
}

export interface StoreVisualTheme {
  badge: string;
  icon: React.ReactNode;
  headerGradient: string;
  heroGradient: string;
  headerTextColor: string;
  borderClass: string;
  hoverBorder: string;
  shadowGlow: string;
  accentBg: string;
  accentText: string;
  groupHoverText: string;
  buttonColor: string;
  quickAddColor: string;
  pillBg: string;
  tagline: string;
  featuredItems: string[];
  actionLabel: string;
  trustPillars: TrustPillar[];
}

// Configurações visuais personalizadas e cores distintas por nicho
export const STORE_THEMES: Record<string, StoreVisualTheme> = {
  'pet-shop': {
    badge: 'PET SHOP & DESIGN',
    icon: <PawPrint className="w-5 h-5 text-indigo-100" />,
    headerGradient: 'bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800',
    heroGradient: 'bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950',
    headerTextColor: 'text-white',
    borderClass: 'border-indigo-100/90',
    hoverBorder: 'hover:border-indigo-500',
    shadowGlow: 'hover:shadow-2xl hover:shadow-indigo-500/20',
    accentBg: 'bg-indigo-50/80',
    accentText: 'text-indigo-600',
    groupHoverText: 'group-hover:text-indigo-600',
    buttonColor: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-indigo-500/30',
    quickAddColor: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-indigo-500/30',
    pillBg: 'bg-white/20 text-white border-white/30',
    tagline: 'Design ergonômico, brinquedos com catnip e acessórios utilitários para cães e gatos.',
    featuredItems: [
      'Comedouros Ergonômicos Elevados',
      'Brinquedos Interativos & Catnip Puro',
      'Coleiras, Chaveiros & Acessórios',
    ],
    actionLabel: 'Entrar na Loja Felinodélia',
    trustPillars: [
      {
        icon: '🐾',
        title: 'Ergonomia & Bem-estar Pet',
        desc: 'Comedouros e utilitários desenvolvidos para postura correta e conforto animal.',
      },
      {
        icon: '🌿',
        title: 'Catnip Puro & Materiais Atóxicos',
        desc: 'Brinquedos sensoriais atóxicos com erva dos gatos selecionada de alto estímulo.',
      },
      {
        icon: '📦',
        title: 'Envio Seguro com Rastreamento',
        desc: 'Embalagens reforçadas e envio ágil para todo o território nacional.',
      },
    ],
  },
  romance: {
    badge: 'CONFEITARIA & ROMANCE',
    icon: <Heart className="w-5 h-5 text-rose-100" />,
    headerGradient: 'bg-gradient-to-br from-rose-500 via-pink-600 to-rose-700',
    heroGradient: 'bg-gradient-to-br from-rose-900 via-pink-900 to-rose-950',
    headerTextColor: 'text-white',
    borderClass: 'border-rose-100/90',
    hoverBorder: 'hover:border-rose-500',
    shadowGlow: 'hover:shadow-2xl hover:shadow-rose-500/20',
    accentBg: 'bg-rose-50/80',
    accentText: 'text-rose-600',
    groupHoverText: 'group-hover:text-rose-600',
    buttonColor: 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-rose-500/30',
    quickAddColor: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-rose-500/30',
    pillBg: 'bg-white/20 text-white border-white/30',
    tagline: 'Carimbos marcadores e cortadores de precisão para brigadeiros gourmet e doces finos.',
    featuredItems: [
      'Kits de Carimbos Romance I & II',
      'Marcador Especial "Te Amo" + Cortador',
      'Kits para Confeitaria Gourmet',
    ],
    actionLabel: 'Entrar na Loja Romance',
    trustPillars: [
      {
        icon: '🍰',
        title: 'Precisão na Confeitaria',
        desc: 'Marcações nítidas e cortes milimétricos que agregam valor aos doces finos.',
      },
      {
        icon: '✨',
        title: 'Material 100% Próprio para Alimentos',
        desc: 'Termoplásticos atóxicos duráveis, de fácil lavagem e higienização.',
      },
      {
        icon: '⚡',
        title: 'Pronta Entrega para Confeiteiros',
        desc: 'Despacho rápido para garantir que suas encomendas nunca fiquem paradas.',
      },
    ],
  },
  'sensora-intima': {
    badge: 'BEM-ESTAR & AUTOCUIDADO',
    icon: <Sparkles className="w-5 h-5 text-purple-100" />,
    headerGradient: 'bg-gradient-to-br from-purple-600 via-violet-600 to-purple-800',
    heroGradient: 'bg-gradient-to-br from-purple-900 via-violet-900 to-purple-950',
    headerTextColor: 'text-white',
    borderClass: 'border-purple-100/90',
    hoverBorder: 'hover:border-purple-500',
    shadowGlow: 'hover:shadow-2xl hover:shadow-purple-500/20',
    accentBg: 'bg-purple-50/80',
    accentText: 'text-purple-600',
    groupHoverText: 'group-hover:text-purple-600',
    buttonColor: 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-purple-500/30',
    quickAddColor: 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white shadow-purple-500/30',
    pillBg: 'bg-white/20 text-white border-white/30',
    tagline: 'Linha exclusiva de autocuidado, velas de massagem beijáveis e bem-estar sensorial.',
    featuredItems: [
      'Velas de Massagem Beijáveis (Morango & Baunilha)',
      'Gel Lubrificante & Hidratante Sensorial',
      'Bullet Pocket Velvet & Autocuidado',
    ],
    actionLabel: 'Entrar na Loja Sensora Íntima',
    trustPillars: [
      {
        icon: '📦',
        title: 'Embalagem 100% Discreta',
        desc: 'Sigilo absoluto garantido: caixa parda neutra sem menção a produtos ou categoria.',
      },
      {
        icon: '🕯️',
        title: 'Fórmulas Suaves & Karité Nobre',
        desc: 'Velas de massagem beijáveis com manteiga de karité pura e toque aveludado.',
      },
      {
        icon: '🔒',
        title: 'Privacidade & Pagamento Protegido',
        desc: 'Descrição neutra na fatura do cartão com checkout criptografado de ponta a ponta.',
      },
    ],
  },
};

export function getStoreTheme(slug?: string | null): StoreVisualTheme {
  if (slug && STORE_THEMES[slug]) {
    return STORE_THEMES[slug];
  }
  return {
    badge: 'LOJA ESPECIALIZADA',
    icon: <ShoppingBag className="w-5 h-5 text-slate-100" />,
    headerGradient: 'bg-gradient-to-br from-slate-800 to-slate-900',
    heroGradient: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950',
    headerTextColor: 'text-white',
    borderClass: 'border-slate-200',
    hoverBorder: 'hover:border-slate-500',
    shadowGlow: 'hover:shadow-2xl hover:shadow-slate-500/20',
    accentBg: 'bg-slate-50',
    accentText: 'text-slate-700',
    groupHoverText: 'group-hover:text-slate-900',
    buttonColor: 'bg-slate-900 hover:bg-black text-white shadow-slate-900/30',
    quickAddColor: 'bg-slate-800 hover:bg-slate-700 text-white',
    pillBg: 'bg-white/20 text-white border-white/30',
    tagline: 'Produtos de alta qualidade com envio imediato e garantia.',
    featuredItems: [],
    actionLabel: 'Entrar na Loja',
    trustPillars: [
      {
        icon: '🚚',
        title: 'Envio para Todo o Brasil',
        desc: 'Rastreamento e entrega rápida garantida',
      },
      {
        icon: '✨',
        title: 'Curadoria & Fabricação Própria',
        desc: 'Alta precisão, design autoral e testes rigorosos',
      },
      {
        icon: '🔒',
        title: 'Pagamento 100% Seguro',
        desc: 'Checkout transparente processado via Mercado Pago',
      },
    ],
  };
}

interface MultiStoreCardsProps {
  stores: Store[];
  onSelectStore: (storeSlug: string) => void;
  onSelectCatalog: (catalogSlug: string) => void;
  onNavigateAffiliate: (storeSlug?: string) => void;
}

export const MultiStoreCards: React.FC<MultiStoreCardsProps> = ({
  stores,
  onSelectStore,
  onSelectCatalog,
  onNavigateAffiliate,
}) => {
  // Garantir que os 3 nichos estejam presentes mesmo se o backend retornar vazio
  const displayStores =
    stores && stores.length > 0
      ? stores.map((s) => {
          const fallback = DEFAULT_STORES.find((d) => d.slug === s.slug);
          return {
            ...fallback,
            ...s,
            brandName: s.brandName || fallback?.brandName || s.name,
            description: s.description || fallback?.description,
            productsCount: s.productsCount || fallback?.productsCount || 0,
            catalogs: s.catalogs && s.catalogs.length > 0 ? s.catalogs : fallback?.catalogs || [],
          };
        })
      : DEFAULT_STORES;

  return (
    <div className="space-y-6">
      {/* Grid com os Cards de Nicho com Cores Distintas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {displayStores.map((store) => {
          const theme = getStoreTheme(store.slug);
          const primaryCatalog = store.catalogs?.[0];

          return (
            <div
              key={store.id}
              className={`bg-white rounded-3xl border-2 ${theme.borderClass} ${theme.hoverBorder} shadow-lg ${theme.shadowGlow} transition-all duration-300 flex flex-col justify-between overflow-hidden group transform hover:-translate-y-1`}
            >
              <div>
                {/* Top Banner Colorido do Nicho */}
                <div className={`p-6 pb-5 ${theme.headerGradient} ${theme.headerTextColor} relative overflow-hidden`}>
                  {/* Círculo decorativo no topo */}
                  <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />

                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-xs border ${theme.pillBg}`}
                    >
                      {theme.icon}
                      {theme.badge}
                    </span>
                    <span className="text-[11px] font-black bg-black/25 text-white backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/15">
                      {store.productsCount === 0 ? 'Em breve' : `${store.productsCount} ${store.productsCount === 1 ? 'item' : 'produtos'}`}
                    </span>
                  </div>

                  <div className="relative z-10">
                    <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                      {store.brandName}
                    </h3>
                    <p className="text-xs text-white/90 mt-1.5 leading-relaxed line-clamp-2">
                      {store.description || theme.tagline}
                    </p>
                  </div>
                </div>

                {/* Conteúdo do Card / Destaques da Linha */}
                <div className="p-6 space-y-4">
                  {theme.featuredItems.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Destaques da Coleção:
                      </span>
                      <ul className="space-y-2">
                        {theme.featuredItems.map((item, idx) => (
                          <li key={idx} className="text-xs text-slate-700 flex items-start gap-2 font-medium">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${theme.accentText}`} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Atalho de Catálogo */}
                  {primaryCatalog && (
                    <div
                      onClick={() => onSelectCatalog(primaryCatalog.slug)}
                      className={`p-3 rounded-xl border border-gray-100 ${theme.accentBg} hover:bg-opacity-100 flex items-center justify-between cursor-pointer transition text-xs group/cat`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Layers className={`w-4 h-4 shrink-0 ${theme.accentText}`} />
                        <span className="font-semibold text-slate-800 truncate">
                          {primaryCatalog.name}
                        </span>
                      </div>
                      <span className={`text-[11px] font-bold ${theme.accentText} flex items-center shrink-0 ml-2 group-hover/cat:underline`}>
                        Acessar <ArrowRight className="w-3 h-3 ml-0.5" />
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação na Base */}
              <div className="p-6 pt-0 space-y-2.5 border-t border-gray-50 mt-4">
                {/* Botão Principal: Entrar na Loja (Cor correspondente ao nicho) */}
                <button
                  type="button"
                  onClick={() => onSelectStore(store.slug)}
                  className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer ${theme.buttonColor}`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{theme.actionLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Botão Secundário: Programa de Afiliados do Nicho */}
                <button
                  type="button"
                  onClick={() => onNavigateAffiliate(store.slug)}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Divulgar Loja & Catálogos (Afiliado)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
