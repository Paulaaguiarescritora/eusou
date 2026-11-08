import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Header, Footer } from './components/Navigation';
import { ProductCard } from './components/ProductCard';
import { ProductDetail } from './components/ProductDetail';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { OrderConfirmation } from './components/OrderConfirmation';
import { CatalogView } from './components/CatalogView';
import { AffiliateCatalogView } from './components/AffiliateCatalogView';
import { Pagination } from './components/Pagination';
import { MultiStoreCards, DEFAULT_STORES, getStoreTheme } from './components/MultiStoreCards';

// Lazy load backoffice and auxiliary components to drastically reduce initial bundle size for shoppers
const AdminOrdersView = lazy(() => import('./components/AdminOrdersView').then((m) => ({ default: m.AdminOrdersView })));
const AffiliatePortalView = lazy(() => import('./components/AffiliatePortalView').then((m) => ({ default: m.AffiliatePortalView })));
const AdminAffiliatesView = lazy(() => import('./components/AdminAffiliatesView').then((m) => ({ default: m.AdminAffiliatesView })));
const ProductionView = lazy(() => import('./components/ProductionView').then((m) => ({ default: m.ProductionView })));
const InventoryView = lazy(() => import('./components/InventoryView').then((m) => ({ default: m.InventoryView })));
const PromoHubView = lazy(() => import('./components/PromoHubView').then((m) => ({ default: m.PromoHubView })));
const ProductEmbedView = lazy(() => import('./components/ProductEmbedView').then((m) => ({ default: m.ProductEmbedView })));
const MarketplacesView = lazy(() => import('./components/MarketplacesView').then((m) => ({ default: m.MarketplacesView })));
const AdminLayout = lazy(() => import('./components/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminProductsView = lazy(() => import('./components/AdminProductsView').then((m) => ({ default: m.AdminProductsView })));
const AdminProductForm = lazy(() => import('./components/AdminProductForm').then((m) => ({ default: m.AdminProductForm })));
const AdminNichesView = lazy(() => import('./components/AdminNichesView').then((m) => ({ default: m.AdminNichesView })));
const AdminCategoriesView = lazy(() => import('./components/AdminCategoriesView').then((m) => ({ default: m.AdminCategoriesView })));
const AdminTagsView = lazy(() => import('./components/AdminTagsView').then((m) => ({ default: m.AdminTagsView })));
const AdminAttributesView = lazy(() => import('./components/AdminAttributesView').then((m) => ({ default: m.AdminAttributesView })));
const AdminThemesView = lazy(() => import('./components/AdminThemesView').then((m) => ({ default: m.AdminThemesView })));
const AdminCollectionsView = lazy(() => import('./components/AdminCollectionsView').then((m) => ({ default: m.AdminCollectionsView })));
const AdminCatalogsView = lazy(() => import('./components/AdminCatalogsView').then((m) => ({ default: m.AdminCatalogsView })));
const AdminCatalogForm = lazy(() => import('./components/AdminCatalogForm').then((m) => ({ default: m.AdminCatalogForm })));
const AdminPricingView = lazy(() => import('./components/AdminPricingView').then((m) => ({ default: m.AdminPricingView })));
const CommercialDashboardView = lazy(() => import('./components/CommercialDashboardView').then((m) => ({ default: m.CommercialDashboardView })));
const LoginModal = lazy(() => import('./components/LoginModal').then((m) => ({ default: m.LoginModal })));

const ViewFallback = () => (
  <div className="flex items-center justify-center min-h-[350px] p-8">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs text-slate-500 font-medium">Carregando painel...</span>
    </div>
  </div>
);
import { useCart } from './useCart';
import { fetchApi } from './api';
import { Product, Catalog, Category, Collection, Order, CartItem, Store } from './types';
import { Sparkles, ArrowRight, Filter, X, ArrowLeft, Store as StoreIcon, Layers, ShoppingBag, Share2, CheckCircle2 } from 'lucide-react';

function extractProductNiche(prod: Product | null | undefined): string | null {
  if (!prod) return null;
  if (prod.niches && prod.niches.length > 0) {
    if (prod.niches[0].niche?.slug) return prod.niches[0].niche.slug;
    if (prod.niches[0].niche?.name) return prod.niches[0].niche.name;
  }
  if (prod.categories && prod.categories.length > 0) {
    if (prod.categories[0].category?.niche?.slug) return prod.categories[0].category.niche.slug;
    if (prod.categories[0].category?.niche?.name) return prod.categories[0].category.niche.name;
  }
  if (prod.brand?.toLowerCase().includes('felino')) return 'pet-shop';
  if (prod.brand?.toLowerCase().includes('romance')) return 'romance';
  if (prod.brand?.toLowerCase().includes('sensora')) return 'sensora-intima';
  return null;
}

function extractCatalogNiche(cat: Catalog | null | undefined): string | null {
  if (!cat) return null;
  if (cat.niche?.name) return cat.niche.name;
  if (cat.resolvedProducts && cat.resolvedProducts.length > 0) {
    const prodNiche = extractProductNiche(cat.resolvedProducts[0]);
    if (prodNiche) return prodNiche;
  }
  if (cat.rules && cat.rules.some((r) => r.type === 'NICHE')) {
    return 'Pet Shop';
  }
  if (cat.slug?.includes('pet') || cat.name?.toLowerCase().includes('pet')) {
    return 'Pet Shop';
  }
  return null;
}

function normalizeCanonicalRoute(path: string): string {
  if (path.startsWith('/produto/')) {
    return path.replace('/produto/', '/produtos/');
  }
  // Preserve /catalogo/ for affiliate catalogs
  return path;
}

export function App() {
  const [route, setRoute] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname || '/';
      const canonical = normalizeCanonicalRoute(pathname);
      if (canonical !== pathname) {
        window.history.replaceState({}, '', canonical + window.location.search);
        return canonical;
      }
      return pathname;
    }
    return '/';
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const catalogSectionRef = React.useRef<HTMLDivElement>(null);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Niche identity & store context state
  const [storeContext, setStoreContext] = useState<{
    nicheId: string | null;
    nicheSlug: string | null;
    nicheName: string | null;
    brandName: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
  } | null>(null);

  const [activeStoreSlug, setActiveStoreSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname || '';
      if (pathname.startsWith('/loja/')) {
        const raw = pathname.replace('/loja/', '').split('?')[0];
        return raw === 'felinodelia' ? 'pet-shop' : raw;
      }
      const params = new URLSearchParams(window.location.search);
      const n = params.get('niche');
      if (n) return n === 'felinodelia' ? 'pet-shop' : n;
      return localStorage.getItem('eusou_active_niche_slug') || null;
    }
    return null;
  });

  const [activeNicheName, setActiveNicheName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname || '';
      if (currentPath === '/' || currentPath === '') return null;
      if (currentPath.startsWith('/loja/')) {
        const raw = currentPath.replace('/loja/', '').split('?')[0];
        const storeSlug = raw === 'felinodelia' ? 'pet-shop' : raw;
        if (storeSlug === 'pet-shop') return 'Felinodélia';
        if (storeSlug === 'romance') return 'Romance';
        if (storeSlug === 'sensora-intima') return 'Sensora Íntima';
      }
      const saved = localStorage.getItem('eusou_active_niche');
      if (saved) return saved;
      try {
        const storedCart = localStorage.getItem('eusou_cart_items');
        if (storedCart) {
          const parsed = JSON.parse(storedCart);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].nicheName) {
            return parsed[0].nicheName;
          }
        }
      } catch {}
    }
    return null;
  });

  // Auth state
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; roles: string[] } | null>(null);
  const isAdmin = currentUser?.roles?.includes('admin') ?? false;
  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    return typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Store data
  const [homeData, setHomeData] = useState<{
    categories: Category[];
    featuredProducts: Product[];
    catalogs: Catalog[];
    collections: Collection[];
    stores?: Store[];
    currentStore?: { id: string; name: string; slug: string; brandName: string; description?: string | null; logoUrl?: string | null } | null;
  } | null>(null);

  const [productsList, setProductsList] = useState<Product[]>([]);
  const [productsMeta, setProductsMeta] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    items: cartItems,
    addItem: addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    swapVariant,
    totalItems,
    subtotal,
  } = useCart();

  // Load auth session on start
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchApi<{ id: string; email: string; roles: string[] }>('/auth/me')
        .then((user) => setCurrentUser(user))
        .catch(() => {
          localStorage.removeItem('token');
          setCurrentUser(null);
        })
        .finally(() => {
          setAuthChecking(false);
        });
    } else {
      setAuthChecking(false);
    }
  }, []);

  // Listen to browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname || '/';
      const canonical = normalizeCanonicalRoute(pathname);
      if (canonical !== pathname) {
        window.history.replaceState({}, '', canonical + window.location.search);
      }
      setRoute(canonical);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load public home data
  useEffect(() => {
    // Tracking de Afiliado via URL (?ref=CODIGO)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('eusou_ref_code', refCode);
      fetchApi('/public/affiliate/click', {
        method: 'POST',
        body: JSON.stringify({
          refCode,
        }),
      }).catch((e) => console.debug('Click tracking notice:', e));
    }

    fetchApi<any>('/public/home')
      .then((data) => setHomeData(data))
      .catch((e) => console.error('Failed to load public home data', e));

    fetchApi<any>('/public/context')
      .then((ctx) => {
        if (ctx) {
          setStoreContext(ctx);
          if (ctx.nicheId) {
            localStorage.setItem('eusou_active_niche_id', ctx.nicheId);
          }
        }
      })
      .catch((e) => console.debug('Context resolution notice:', e));
  }, []);

  // Sincronizar contexto de nicho com a rota
  useEffect(() => {
    const canonical = normalizeCanonicalRoute(route);
    if (canonical !== route) {
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', canonical + window.location.search);
      }
      setRoute(canonical);
      return;
    }

    if (route === '/') {
      setActiveNicheName(null);
      setActiveStoreSlug(null);
      try {
        localStorage.removeItem('eusou_active_niche');
        localStorage.removeItem('eusou_active_niche_slug');
      } catch {}
      fetchApi<any>('/public/home')
        .then((data) => setHomeData(data))
        .catch(console.error);
    } else if (route.startsWith('/loja/')) {
      setSelectedProduct(null);
      const rawSlug = route.replace('/loja/', '').split('?')[0];
      const storeSlug = rawSlug === 'felinodelia' ? 'pet-shop' : rawSlug;
      const storeConfig = DEFAULT_STORES.find((s) => s.slug === storeSlug);
      const fallbackBrand = storeSlug === 'pet-shop'
        ? 'Felinodélia'
        : storeSlug === 'romance'
        ? 'Romance'
        : storeSlug === 'sensora-intima'
        ? 'Sensora Íntima'
        : (storeConfig?.brandName || 'Loja Especializada');

      setActiveStoreSlug(storeSlug);
      setActiveNicheName(fallbackBrand);
      try {
        localStorage.setItem('eusou_active_niche_slug', storeSlug);
        localStorage.setItem('eusou_active_niche', fallbackBrand);
      } catch {}

      setLoading(true);
      Promise.all([
        fetchApi<any>(`/public/home?niche=${encodeURIComponent(storeSlug)}`),
        fetchApi<{ data: Product[] }>(`/public/products?niche=${encodeURIComponent(storeSlug)}&limit=12`),
      ])
        .then(([homeRes, productsRes]) => {
          const resolvedBrand = homeRes?.currentStore?.brandName || fallbackBrand;
          setActiveNicheName(resolvedBrand);
          try {
            localStorage.setItem('eusou_active_niche', resolvedBrand);
          } catch {}

          // Garantir isolamento 100% rigoroso de produtos deste nicho
          const rawProducts = (productsRes?.data && productsRes.data.length > 0)
            ? productsRes.data
            : (homeRes?.featuredProducts || []);

          const nicheProducts = rawProducts.filter((p: any) => {
            const pNiche = extractProductNiche(p);
            if (storeSlug === 'pet-shop') {
              return pNiche?.toLowerCase().includes('pet') || p.brand?.toLowerCase().includes('felino');
            }
            if (storeSlug === 'romance') {
              return pNiche?.toLowerCase().includes('romance') || p.name?.toLowerCase().includes('carimbo');
            }
            if (storeSlug === 'sensora-intima') {
              return pNiche?.toLowerCase().includes('sensora') || pNiche?.toLowerCase().includes('íntima');
            }
            return true;
          });

          setHomeData({
            ...(homeRes || {}),
            currentStore: {
              id: storeConfig?.id || homeRes?.currentStore?.id || '',
              name: storeConfig?.name || homeRes?.currentStore?.name || resolvedBrand,
              slug: storeSlug,
              brandName: resolvedBrand,
              description: homeRes?.currentStore?.description || storeConfig?.description || null,
              logoUrl: homeRes?.currentStore?.logoUrl || storeConfig?.logoUrl || null,
            },
            featuredProducts: nicheProducts,
            stores: homeRes?.stores && homeRes.stores.length > 0 ? homeRes.stores : DEFAULT_STORES,
          });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (route === '/produtos' || route.startsWith('/produtos?')) {
      setSelectedProduct(null);
      const queryStr = route.includes('?') ? route.substring(route.indexOf('?')) : '';
      const params = new URLSearchParams(queryStr);
      if (!params.has('limit')) {
        params.set('limit', '12');
      }

      const cacheKey = `eusou_cat_${params.toString()}`;
      let hadCached = false;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
            setProductsList(parsed.data);
            setProductsMeta(parsed.meta || null);
            setLoading(false);
            hadCached = true;
          }
        }
      } catch {}

      if (!hadCached) {
        setLoading(true);
      }

      fetchApi<{ data: Product[]; meta?: { total: number; page: number; limit: number; totalPages: number } }>(`/public/products?${params.toString()}`)
        .then((res) => {
          setProductsList(res.data || []);
          setProductsMeta(res.meta || null);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(res));
          } catch {}
        })
        .catch(() => {
          if (!hadCached) {
            setProductsList([]);
            setProductsMeta(null);
          }
        })
        .finally(() => setLoading(false));
    } else if (route.startsWith('/colecoes/')) {
      setSelectedProduct(null);
      setLoading(true);
      const slug = route.replace('/colecoes/', '').split('?')[0];
      fetchApi<any>(`/public/collections/${encodeURIComponent(slug)}`)
        .then((res) => {
          if (res && Array.isArray(res.products)) {
            setProductsList(res.products);
          } else {
            setProductsList([]);
          }
        })
        .catch(() => {
          setProductsList([]);
        })
        .finally(() => setLoading(false));
    } else if (route.startsWith('/produtos/')) {
      const rawSlug = route.replace('/produtos/', '').split('?')[0];
      let decodedSlug = rawSlug;
      try {
        decodedSlug = decodeURIComponent(rawSlug);
      } catch {}

      // Busca sempre os dados completos e atualizados do produto (incluindo variantes e estoque em tempo real)
      setLoading(!selectedProduct || selectedProduct.slug !== decodedSlug);
      fetchApi<Product>(`/public/products/${encodeURIComponent(decodedSlug)}`)
        .then((p) => {
          setSelectedProduct(p);
          const n = extractProductNiche(p);
          if (n) {
            setActiveNicheName(n);
            try {
              localStorage.setItem('eusou_active_niche', n);
            } catch {}
          }
        })
        .catch((err) => {
          console.error('Falha ao sincronizar detalhes do produto:', err);
          setSelectedProduct((prev) => (prev?.slug === decodedSlug || prev?.slug === rawSlug ? prev : null));
        })
        .finally(() => setLoading(false));
    } else if (route.startsWith('/catalogos/')) {
      const catSlug = route.replace('/catalogos/', '').split('?')[0];
      if (catSlug && (!selectedCatalog || selectedCatalog.slug !== catSlug)) {
        setLoading(true);
        fetchApi<Catalog>(`/public/catalogs/${catSlug}`)
          .then((c) => {
            setSelectedCatalog(c);
            const n = extractCatalogNiche(c);
            if (n) {
              setActiveNicheName(n);
              try { localStorage.setItem('eusou_active_niche', n); } catch {}
            }
          })
          .catch(() => setSelectedCatalog(null))
          .finally(() => setLoading(false));
      } else if (selectedCatalog) {
        const n = extractCatalogNiche(selectedCatalog);
        if (n) {
          setActiveNicheName(n);
          try { localStorage.setItem('eusou_active_niche', n); } catch {}
        }
      }
    } else if (route === '/carrinho' || route === '/checkout') {
      if (!activeNicheName && cartItems.length > 0) {
        const cartNiche = cartItems.find((i) => Boolean(i.nicheName))?.nicheName;
        if (cartNiche) {
          setActiveNicheName(cartNiche);
          try { localStorage.setItem('eusou_active_niche', cartNiche); } catch {}
        }
      }
    }
  }, [route]);

  // Route change handler
  const navigateTo = (newRoute: string) => {
    const [pathPart, hashPart] = newRoute.split('#');
    const canonical = normalizeCanonicalRoute(pathPart || '/');
    if (canonical === '/') {
      setActiveNicheName(null);
      try { localStorage.removeItem('eusou_active_niche'); } catch {}
    }

    // Check if route is admin and requires auth
    if (canonical === '/admin' || canonical.startsWith('/admin/')) {
      const isAdmin = currentUser?.roles?.includes('admin');
      if (!isAdmin) {
        setPendingRoute(canonical);
        setShowLoginModal(true);
        return;
      }
    }

    setRoute(canonical);
    const fullTarget = hashPart ? `${canonical}#${hashPart}` : canonical;
    if (typeof window !== 'undefined' && (window.location.pathname + window.location.search) !== canonical) {
      window.history.pushState({}, '', fullTarget);
    }
    if (hashPart) {
      setTimeout(() => {
        const el = document.getElementById(hashPart);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (newPage: number) => {
    const searchPart = route.includes('?') ? route.substring(route.indexOf('?')) : '';
    const currentParams = new URLSearchParams(searchPart);
    currentParams.set('page', String(newPage));
    navigateTo(`/produtos?${currentParams.toString()}`);
    if (catalogSectionRef.current) {
      catalogSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLimitChange = (newLimit: number) => {
    const searchPart = route.includes('?') ? route.substring(route.indexOf('?')) : '';
    const currentParams = new URLSearchParams(searchPart);
    currentParams.set('limit', String(newLimit));
    currentParams.set('page', '1');
    navigateTo(`/produtos?${currentParams.toString()}`);
    if (catalogSectionRef.current) {
      catalogSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLoginSuccess = (user: { id: string; email: string; roles: string[] }) => {
    setCurrentUser(user);
    if (user.roles.includes('admin')) {
      const target = pendingRoute || (route.startsWith('/admin') && route !== '/admin' ? route : '/admin/products');
      setRoute(target);
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', target);
      }
    } else {
      alert('Seu perfil não possui acesso administrativo.');
    }
    setPendingRoute(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    navigateTo('/');
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    const n = extractProductNiche(product);
    if (n) {
      setActiveNicheName(n);
      try { localStorage.setItem('eusou_active_niche', n); } catch {}
    }
    navigateTo(`/produtos/${product.slug}`);
  };

  const handleSelectCatalog = async (catalogSlug: string) => {
    setLoading(true);
    try {
      const fullCatalog = await fetchApi<Catalog>(`/public/catalogs/${catalogSlug}`);
      setSelectedCatalog(fullCatalog);
      const n = extractCatalogNiche(fullCatalog);
      if (n) {
        setActiveNicheName(n);
        try { localStorage.setItem('eusou_active_niche', n); } catch {}
      }
      navigateTo(`/catalogos/${catalogSlug}`);
    } catch (e) {
      console.error('Failed to load catalog', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item: CartItem) => {
    // Validação de segurança: se o item estiver esgotado, impede a inclusão
    if (item.availableStock !== undefined && item.availableStock <= 0) {
      return;
    }
    const itemNiche = item.nicheName
      || activeNicheName
      || (selectedProduct && extractProductNiche(selectedProduct))
      || null;
    addToCart({
      ...item,
      nicheName: itemNiche,
    });
    if (itemNiche) {
      setActiveNicheName(itemNiche);
      try { localStorage.setItem('eusou_active_niche', itemNiche); } catch {}
    }
  };

  const handleOrderPlaced = (order: Order) => {
    setCompletedOrder(order);
    clearCart();
    navigateTo(`/pedido/${order.id}`);
  };

  // 1. EMBED ROUTE
  if (route.startsWith('/embed/products/')) {
    const embedId = route.replace('/embed/products/', '').split('?')[0];
    return (
      <Suspense fallback={<ViewFallback />}>
        <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
          <ProductEmbedView productId={embedId} />
        </div>
      </Suspense>
    );
  }

  // 2. ADMIN BACKOFFICE ROUTE
  if (route === '/admin' || route.startsWith('/admin/')) {
    if (authChecking) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-xs">
          Verificando permissões de acesso...
        </div>
      );
    }

    if (!isAdmin) {
      const executeAdminLogin = async (eMail: string, pWord: string) => {
        setAdminLoginLoading(true);
        setAdminLoginError(null);
        try {
          const res = await fetchApi<{ accessToken: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: eMail.trim(), password: pWord }),
          });
          localStorage.setItem('token', res.accessToken);
          const me = await fetchApi<{ id: string; email: string; roles: string[] }>('/auth/me');
          handleLoginSuccess(me);
        } catch (err: any) {
          setAdminLoginError(
            err.message || 'Falha ao autenticar. Se o servidor estava em repouso na nuvem, aguarde 15 segundos e clique novamente.'
          );
        } finally {
          setAdminLoginLoading(false);
        }
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 text-white">
          <div className="max-w-md w-full bg-white p-7 sm:p-8 rounded-3xl border border-slate-200 text-slate-900 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-amber-400 font-black flex items-center justify-center text-xl shadow-md">
                K
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">KUBOSTUDIO Backoffice</h2>
                <p className="text-xs text-slate-500 font-medium">Acesso Administrativo à Plataforma</p>
              </div>
            </div>

            {/* BOTÃO DE ACESSO RÁPIDO (1 CLIQUE) */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                Acesso Rápido Direto
              </span>
              <button
                type="button"
                disabled={adminLoginLoading}
                onClick={() => executeAdminLogin('admin@eusou.com', 'admin123')}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {adminLoginLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Conectando ao servidor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Entrar com 1 Clique (Admin)</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500 leading-tight">
                Entra instantaneamente com as credenciais administrativas configuradas.
              </p>
            </div>

            {adminLoginError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium leading-relaxed">
                {adminLoginError}
              </div>
            )}

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                Ou digite seu login
              </span>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const emailInput = (form.elements.namedItem('email') as HTMLInputElement).value;
                const passwordInput = (form.elements.namedItem('password') as HTMLInputElement).value;
                await executeAdminLogin(emailInput, passwordInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue="admin@eusou.com"
                  placeholder="admin@eusou.com ou seu email"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha</label>
                <input
                  type="password"
                  name="password"
                  required
                  defaultValue="admin123"
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                <span><strong>E-mails aceitos:</strong> admin@eusou.com ou paulaaguiarescritora@gmail.com</span>
                <span><strong>Senha padrão:</strong> admin123</span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => navigateTo('/')}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Voltar à Loja
                </button>
                <button
                  type="submit"
                  disabled={adminLoginLoading}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {adminLoginLoading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    return (
      <Suspense fallback={<ViewFallback />}>
        <AdminLayout
        currentRoute={route}
        onNavigate={navigateTo}
        onLogout={handleLogout}
        userEmail={currentUser?.email || 'admin@eusou.com'}
      >
        {/* /admin/dashboard */}
        {(route === '/admin/dashboard' || route === '/admin') && (
          <CommercialDashboardView onNavigate={navigateTo} token={localStorage.getItem('token') || ''} />
        )}

        {/* /admin/products */}
        {route === '/admin/products' && (
          <AdminProductsView onNavigate={navigateTo} />
        )}

        {/* /admin/products/new */}
        {route === '/admin/products/new' && (
          <AdminProductForm onNavigate={navigateTo} />
        )}

        {/* /admin/products/:id */}
        {route.startsWith('/admin/products/') && route !== '/admin/products/new' && (
          <AdminProductForm
            productId={route.replace('/admin/products/', '')}
            onNavigate={navigateTo}
          />
        )}

        {/* /admin/niches */}
        {route === '/admin/niches' && (
          <AdminNichesView />
        )}

        {/* /admin/categories */}
        {route === '/admin/categories' && (
          <AdminCategoriesView />
        )}

        {/* /admin/tags */}
        {route === '/admin/tags' && (
          <AdminTagsView />
        )}

        {/* /admin/attributes */}
        {route === '/admin/attributes' && (
          <AdminAttributesView />
        )}

        {/* /admin/themes */}
        {route === '/admin/themes' && (
          <AdminThemesView />
        )}

        {/* /admin/collections */}
        {route === '/admin/collections' && (
          <AdminCollectionsView onNavigate={navigateTo} />
        )}

        {/* /admin/catalogs */}
        {route === '/admin/catalogs' && (
          <AdminCatalogsView onNavigate={navigateTo} />
        )}

        {/* /admin/catalogs/new */}
        {route === '/admin/catalogs/new' && (
          <AdminCatalogForm onNavigate={navigateTo} />
        )}

        {/* /admin/catalogs/:id */}
        {route.startsWith('/admin/catalogs/') && route !== '/admin/catalogs/new' && (
          <AdminCatalogForm
            catalogId={route.replace('/admin/catalogs/', '')}
            onNavigate={navigateTo}
          />
        )}

        {/* Existing modules */}
        {route === '/admin/orders' && <AdminOrdersView />}
        {route === '/admin/pricing' && <AdminPricingView />}
        {route === '/admin/production' && <ProductionView />}
        {route === '/admin/inventory' && <InventoryView />}
        {route === '/admin/affiliates' && <AdminAffiliatesView onNavigate={navigateTo} />}
        {route === '/admin/divulgacao' && <PromoHubView onNavigate={navigateTo} />}
        {route === '/admin/marketplaces' && (
          <MarketplacesView token={localStorage.getItem('token') || ''} />
        )}
        </AdminLayout>
      </Suspense>
    );
  }

  // 3. PUBLIC STORE ROUTE
  const isAffiliateCatalog = route.startsWith('/catalogo/') || route.startsWith('/afiliado/');
  const storeFromSlug = DEFAULT_STORES.find((s) => s.slug === activeStoreSlug);
  const fallbackStoreBrand = activeStoreSlug === 'pet-shop'
    ? 'Felinodélia'
    : activeStoreSlug === 'romance'
    ? 'Romance'
    : activeStoreSlug === 'sensora-intima'
    ? 'Sensora Íntima'
    : (storeFromSlug?.brandName || 'Loja Especializada');

  const publicBrand = activeStoreSlug
    ? (homeData?.currentStore?.brandName || activeNicheName || fallbackStoreBrand)
    : 'KUBO STUDIO';

  // Filtros estritos por nicho no contexto da loja especializada
  const storeCategories = (homeData?.categories || []).filter((c) => {
    if (!activeStoreSlug) return true;
    if (storeFromSlug?.id) {
      return c.nicheId === storeFromSlug.id;
    }
    return true;
  });

  const storeCatalogs = (homeData?.catalogs || []).filter((cat) => {
    if (!activeStoreSlug) return true;
    if (storeFromSlug?.id) {
      return cat.nicheId === storeFromSlug.id || cat.niche?.slug === activeStoreSlug || cat.niche?.id === storeFromSlug.id;
    }
    return true;
  });

  const storeProducts = (homeData?.featuredProducts || []).filter((p) => {
    if (!activeStoreSlug) return true;
    const pNiche = extractProductNiche(p);
    if (activeStoreSlug === 'pet-shop') {
      return pNiche?.toLowerCase().includes('pet') || p.brand?.toLowerCase().includes('felino');
    }
    if (activeStoreSlug === 'romance') {
      return pNiche?.toLowerCase().includes('romance') || p.name?.toLowerCase().includes('carimbo');
    }
    if (activeStoreSlug === 'sensora-intima') {
      return pNiche?.toLowerCase().includes('sensora') || pNiche?.toLowerCase().includes('íntima');
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 font-sans antialiased">
      {!isAffiliateCatalog && (
        <Header
          totalItems={totalItems}
          onNavigate={navigateTo}
          currentRoute={route}
          brandTitle={activeStoreSlug && homeData?.currentStore?.brandName ? homeData.currentStore.brandName : publicBrand}
          activeStoreSlug={activeStoreSlug}
          stores={homeData?.stores && homeData.stores.length > 0 ? homeData.stores : DEFAULT_STORES}
          onSelectStore={(slug) => {
            if (slug) {
              setActiveStoreSlug(slug);
              navigateTo(`/loja/${slug}`);
            } else {
              setActiveStoreSlug(null);
              navigateTo('/');
            }
          }}
        />
      )}

      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onSuccess={handleLoginSuccess}
          />
        </Suspense>
      )}

      <main className="flex-1">
        {/* ROUTE: HOME (PORTAL MULTILOJAS) */}
        {route === '/' && (
          <div className="bg-slate-50/60 pb-20">
            {/* Top Intro Section */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white pt-12 pb-24 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
              <div className="max-w-3xl mx-auto space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold tracking-wider uppercase text-slate-300 border border-white/10">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> PLATAFORMA MULTILOJAS • KUBO STUDIO
                </span>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  Nossos Nichos Especializados
                </h1>
                <p className="text-slate-300 text-xs sm:text-base max-w-xl mx-auto leading-relaxed">
                  Selecione um nicho abaixo para acessar a loja dedicada, navegar por categorias e catálogos exclusivos ou divulgar como afiliado parceiro.
                </p>
              </div>
            </div>

            {/* Grid dos Cards de Nicho com Cores Distintas */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 space-y-12">
              <MultiStoreCards
                stores={homeData?.stores && homeData.stores.length > 0 ? homeData.stores : DEFAULT_STORES}
                onSelectStore={(slug) => {
                  setActiveStoreSlug(slug);
                  navigateTo(`/loja/${slug}`);
                }}
                onSelectCatalog={(catSlug) => navigateTo(`/catalogos/${catSlug}`)}
                onNavigateAffiliate={(slug) => {
                  navigateTo(slug ? `/affiliate?niche=${encodeURIComponent(slug)}` : '/affiliate');
                }}
              />

              {/* Informações de Confiança e Segurança (sem listar nenhum produto) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-2xl shrink-0">
                    🚚
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Envio para Todo o Brasil</h3>
                    <p className="text-xs text-slate-500">Rastreamento e entrega rápida garantida</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-2xl shrink-0">
                    ✨
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Curadoria & Fabricação Própria</h3>
                    <p className="text-xs text-slate-500">Alta precisão, design autoral e testes rigorosos</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-2xl shrink-0">
                    🔒
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Pagamento 100% Seguro</h3>
                    <p className="text-xs text-slate-500">Checkout transparente processado via Mercado Pago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ROUTE: LOJA ESPECÍFICA (/loja/:storeSlug) */}
        {route.startsWith('/loja/') && (() => {
          const activeTheme = getStoreTheme(activeStoreSlug);
          return (
            <div>
              {/* Store Hero Banner Customizado com o Tema do Card */}
              <div className={`py-14 sm:py-20 px-4 sm:px-6 lg:px-8 text-white text-center relative overflow-hidden ${activeTheme.heroGradient}`}>
                {/* Ambient Orbs */}
                <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-black/25 blur-3xl pointer-events-none" />

                <div className="max-w-4xl mx-auto space-y-4 relative z-10">
                  {/* Top Bar com Navegação e Badge do Nicho */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStoreSlug(null);
                        navigateTo('/');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition cursor-pointer backdrop-blur-xs border border-white/20"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Portal Multilojas
                    </button>
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-xs border ${activeTheme.pillBg}`}>
                      {activeTheme.icon}
                      {activeTheme.badge}
                    </span>
                    <span className="text-xs font-black bg-black/30 text-white backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/15">
                      {storeProducts.length} {storeProducts.length === 1 ? 'item disponível' : 'itens disponíveis'}
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white drop-shadow-sm">
                    {publicBrand}
                  </h1>

                  <p className="text-white/90 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
                    {homeData?.currentStore?.description || storeFromSlug?.description || activeTheme.tagline}
                  </p>

                  {/* Highlights Pills do Card */}
                  {activeTheme.featuredItems.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      {activeTheme.featuredItems.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/15 text-white/95 border border-white/20 backdrop-blur-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-white/90" />
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTA Buttons da Loja */}
                  <div className="pt-3 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => navigateTo(`/produtos?niche=${encodeURIComponent(activeStoreSlug || '')}`)}
                      className="px-6 py-3 bg-white text-slate-900 rounded-xl font-extrabold text-xs sm:text-sm hover:bg-slate-50 transition shadow-lg shadow-black/10 flex items-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Ver Todos os Produtos ({storeProducts.length})
                    </button>
                    <button
                      onClick={() => navigateTo(`/affiliate?niche=${encodeURIComponent(activeStoreSlug || '')}`)}
                      className="px-5 py-3 bg-black/25 hover:bg-black/35 text-white border border-white/25 rounded-xl font-bold text-xs sm:text-sm transition backdrop-blur-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-amber-300" />
                      Programa de Afiliados desta Loja
                    </button>
                  </div>
                </div>
              </div>

              {/* Store Content */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
                {/* Categorias da Loja com Tema Personalizado */}
                {storeCategories.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeTheme.accentBg} ${activeTheme.accentText}`}>
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-extrabold text-slate-900">Categorias de {publicBrand}</h2>
                          <p className="text-xs text-slate-500">Linhas exclusivas e coleções segmentadas</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {storeCategories.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => navigateTo(`/produtos?category=${c.slug}&niche=${encodeURIComponent(activeStoreSlug || '')}`)}
                          className={`p-4 bg-white rounded-2xl border border-gray-100 ${activeTheme.hoverBorder} hover:shadow-md transition text-center cursor-pointer group flex flex-col items-center justify-center min-h-[90px]`}
                        >
                          <span className={`text-xs font-bold text-slate-800 ${activeTheme.groupHoverText}`}>
                            {c.name}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
                            Explorar <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Catálogos da Loja com Tema Personalizado */}
                {storeCatalogs.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeTheme.accentBg} ${activeTheme.accentText}`}>
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-extrabold text-slate-900">Catálogos & Curadorias</h2>
                          <p className="text-xs text-slate-500">Acesse curadorias temáticas prontas para compra ou divulgação</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {storeCatalogs.map((cat) => (
                        <div
                          key={cat.id}
                          onClick={() => handleSelectCatalog(cat.slug)}
                          className={`p-6 bg-white rounded-2xl border border-gray-100 ${activeTheme.hoverBorder} hover:shadow-md transition cursor-pointer flex flex-col justify-between group`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-md ${activeTheme.accentBg} ${activeTheme.accentText}`}>
                                Catálogo Oficial
                              </span>
                              <Layers className={`w-4 h-4 ${activeTheme.accentText}`} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 group-hover:text-black">{cat.name}</h3>
                            {cat.description && (
                              <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                                {cat.description}
                              </p>
                            )}
                          </div>
                          <div className={`mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-bold ${activeTheme.accentText}`}>
                            <span>Acessar Catálogo</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Produtos em Destaque da Loja (100% isolados pelo nicho ativo) */}
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${activeTheme.accentBg} ${activeTheme.accentText}`}>
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-slate-900">Destaques de {publicBrand}</h2>
                        <p className="text-xs text-slate-500">Pronta entrega e curadoria exclusiva do nicho</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigateTo(`/produtos?niche=${encodeURIComponent(activeStoreSlug || '')}`)}
                      className={`text-xs font-bold ${activeTheme.accentText} hover:underline flex items-center gap-1`}
                    >
                      Ver todos os produtos ({storeProducts.length}) <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {storeProducts.length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-gray-100">
                      Nenhum produto cadastrado nesta loja no momento.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                      {storeProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          cardBorderClass={activeTheme.hoverBorder}
                          quickAddClass={activeTheme.quickAddColor}
                          onSelect={handleSelectProduct}
                          onQuickAdd={(prod) =>
                            handleAddToCart({
                              productId: prod.id,
                              name: prod.name,
                              unitPrice: prod.basePrice ? Number(prod.basePrice) : 0,
                              quantity: 1,
                              imageUrl: prod.media?.find((m) => m.isPrimary)?.url || prod.media?.[0]?.url || null,
                              nicheName: extractProductNiche(prod),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Trust Pillars personalizados para a Loja */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200/60">
                  {activeTheme.trustPillars.map((tp, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-xs hover:border-gray-200 transition">
                      <div className={`w-12 h-12 rounded-xl ${activeTheme.accentBg} ${activeTheme.accentText} flex items-center justify-center font-bold text-2xl shrink-0`}>
                        {tp.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{tp.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{tp.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ROUTE: PRODUTOS OU COLEÇÕES (LISTAGEM) */}
        {(route.startsWith('/produtos') || route.startsWith('/colecoes/')) && !selectedProduct && (
          <div ref={catalogSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {route.startsWith('/colecoes/') && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Vitrine Exclusiva de Afiliado
                  </span>
                )}
                <h1 className="text-2xl font-black text-slate-900">
                  {route.startsWith('/colecoes/') ? 'Vitrine de Produtos Selecionados' : 'Catálogo de Produtos'}
                </h1>
                <p className="text-xs text-slate-500">
                  {route.startsWith('/colecoes/')
                    ? 'Esta seleção de produtos foi montada especialmente pelo nosso parceiro'
                    : 'Explore itens disponíveis e curadorias prontas para compra'}
                </p>
              </div>

              {/* Botão para limpar filtros se algum estiver ativo */}
              {route.includes('?') && (
                <button
                  type="button"
                  onClick={() => navigateTo('/produtos')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer w-fit"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Filtros Visuais de Categorias */}
            {homeData?.categories && homeData.categories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                  <Filter className="w-3.5 h-3.5" /> Categorias:
                </span>
                <button
                  onClick={() => navigateTo('/produtos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer ${
                    route === '/produtos'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-gray-200 hover:border-slate-800'
                  }`}
                >
                  Todas
                </button>
                {homeData.categories.map((cat) => {
                  const isActive = route.includes(`category=${cat.slug}`) || route.includes(`categoryId=${cat.id}`);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const searchPart = route.includes('?') ? route.substring(route.indexOf('?')) : '';
                        const currentParams = new URLSearchParams(searchPart);
                        currentParams.set('categoryId', cat.id);
                        currentParams.delete('category');
                        currentParams.set('page', '1');
                        navigateTo(`/produtos?${currentParams.toString()}`);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-gray-200 hover:border-indigo-400'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}

            {loading && productsList.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
                    <div className="aspect-square bg-slate-100 rounded-lg w-full" />
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-100 rounded-md w-3/4" />
                      <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                    </div>
                    <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                      <div className="h-5 bg-slate-100 rounded-md w-20" />
                      <div className="h-8 w-8 bg-slate-100 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : productsList.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-gray-100 space-y-3">
                <p>Nenhum produto encontrado nesta seleção.</p>
                {route.includes('?') && (
                  <button
                    onClick={() => navigateTo('/produtos')}
                    className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                  >
                    Ver todos os produtos
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                {loading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-2xs z-10 flex flex-col items-center justify-center rounded-2xl min-h-[300px]">
                    <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-xs font-semibold text-slate-700">Atualizando produtos...</span>
                  </div>
                )}
                <div
                  className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 transition-opacity duration-200 ${
                    loading ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  {productsList.map((p) => {
                    const itemTheme = getStoreTheme(activeStoreSlug || extractProductNiche(p));
                    return (
                      <ProductCard
                        key={p.id}
                        product={p}
                        cardBorderClass={itemTheme.hoverBorder}
                        quickAddClass={itemTheme.quickAddColor}
                        onSelect={handleSelectProduct}
                        onQuickAdd={(prod) =>
                          handleAddToCart({
                            productId: prod.id,
                            name: prod.name,
                            unitPrice: prod.basePrice ? Number(prod.basePrice) : 0,
                            quantity: 1,
                            imageUrl: prod.media?.find((m) => m.isPrimary)?.url || prod.media?.[0]?.url || null,
                            nicheName: extractProductNiche(prod),
                          })
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paginação do Catálogo Público da Loja */}
            {productsMeta && (
              <Pagination
                currentPage={productsMeta.page}
                totalPages={productsMeta.totalPages}
                totalItems={productsMeta.total}
                itemsPerPage={productsMeta.limit}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleLimitChange}
                itemsPerPageOptions={[12, 24, 48]}
                itemLabel="produtos na loja"
                onScrollToTop={() => {
                  if (catalogSectionRef.current) {
                    catalogSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            )}
          </div>
        )}

        {/* ROUTE: PRODUTO ESPECÍFICO */}
        {selectedProduct && route.startsWith('/produtos/') && (
          <ProductDetail
            product={selectedProduct}
            onBack={() => {
              setSelectedProduct(null);
              navigateTo('/produtos');
            }}
            onAddToCart={handleAddToCart}
          />
        )}

        {/* ROUTE: PÁGINA DE CATÁLOGO / VITRINE DO AFILIADO */}
        {isAffiliateCatalog && (
          <AffiliateCatalogView
            code={route.replace(/^\/(catalogo|afiliado)\//, '').split('?')[0]}
            cartCount={totalItems}
            onAddToCart={(item) => {
              handleAddToCart(item);
              navigateTo('/carrinho');
            }}
            onNavigate={navigateTo}
          />
        )}

        {/* ROUTE: CATÁLOGO ESPECÍFICO */}
        {selectedCatalog && route.startsWith('/catalogos/') && (
          <CatalogView
            catalog={selectedCatalog}
            onSelectProduct={handleSelectProduct}
            onQuickAdd={(prod) =>
              handleAddToCart({
                productId: prod.id,
                name: prod.name,
                unitPrice: prod.basePrice ? Number(prod.basePrice) : 0,
                quantity: 1,
                imageUrl: prod.media?.find((m) => m.isPrimary)?.url || prod.media?.[0]?.url || null,
                nicheName: extractProductNiche(prod) || extractCatalogNiche(selectedCatalog),
              })
            }
            onBack={() => {
              setSelectedCatalog(null);
              navigateTo('/');
            }}
          />
        )}

        {/* ROUTE: CARRINHO */}
        {route === '/carrinho' && (
          <CartView
            items={cartItems}
            subtotal={subtotal}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onSwapVariant={swapVariant}
            onNavigate={navigateTo}
          />
        )}

        {/* ROUTE: CHECKOUT */}
        {route === '/checkout' && (
          <CheckoutView
            items={cartItems}
            subtotal={subtotal}
            onClearCart={clearCart}
            onNavigate={navigateTo}
            onOrderPlaced={handleOrderPlaced}
          />
        )}

        {/* ROUTE: CONFIRMAÇÃO DO PEDIDO */}
        {route.startsWith('/pedido/') && (
          <OrderConfirmation
            order={completedOrder}
            orderId={route.replace('/pedido/', '')}
            onNavigate={navigateTo}
          />
        )}

        {/* ROUTE: PORTAL DO AFILIADO */}
        {route === '/affiliate' && (
          <Suspense fallback={<ViewFallback />}>
            <AffiliatePortalView onNavigate={navigateTo} />
          </Suspense>
        )}

        {/* ROUTE: PRODUTO NÃO ENCONTRADO */}
        {!loading && !selectedProduct && route.startsWith('/produtos/') && (
          <div className="max-w-xl mx-auto px-4 py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <span className="text-2xl font-bold">?</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Produto não encontrado</h2>
            <p className="text-sm text-slate-500 mb-6">
              O produto que você procura pode ter sido descontinuado ou o link está incorreto.
            </p>
            <button
              onClick={() => navigateTo('/produtos')}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition cursor-pointer"
            >
              Ver todos os produtos
            </button>
          </div>
        )}

        {/* ROTA NÃO ENCONTRADA (404) */}
        {!loading &&
          route !== '/' &&
          !route.startsWith('/produtos') &&
          !route.startsWith('/colecoes/') &&
          !isAffiliateCatalog &&
          !route.startsWith('/catalogos/') &&
          route !== '/carrinho' &&
          route !== '/checkout' &&
          !route.startsWith('/pedido/') &&
          route !== '/affiliate' &&
          !route.startsWith('/admin') &&
          !route.startsWith('/embed/product/') && (
            <div className="max-w-xl mx-auto px-4 py-24 text-center">
              <h1 className="text-5xl font-black text-slate-900 mb-3">404</h1>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Página não encontrada</h2>
              <p className="text-sm text-slate-500 mb-6">
                O endereço acessado não existe ou foi movido.
              </p>
              <button
                onClick={() => navigateTo('/')}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition cursor-pointer"
              >
                Voltar para o Início
              </button>
            </div>
          )}
      </main>

      {!isAffiliateCatalog && <Footer onNavigate={navigateTo} brandTitle={publicBrand} />}
    </div>
  );
}

export default App;
