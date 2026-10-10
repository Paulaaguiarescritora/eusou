import React, { useEffect, useState } from 'react';
import { Header, Footer } from './components/Navigation';
import { ProductCard } from './components/ProductCard';
import { ProductDetail } from './components/ProductDetail';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { OrderConfirmation } from './components/OrderConfirmation';
import { CatalogView } from './components/CatalogView';
import { AdminOrdersView } from './components/AdminOrdersView';
import { AffiliatePortalView } from './components/AffiliatePortalView';
import { AdminAffiliatesView } from './components/AdminAffiliatesView';
import { ProductionView } from './components/ProductionView';
import { InventoryView } from './components/InventoryView';
import { PromoHubView } from './components/PromoHubView';
import { ProductEmbedView } from './components/ProductEmbedView';
import { MarketplacesView } from './components/MarketplacesView';
import { AdminLayout } from './components/AdminLayout';
import { AdminProductsView } from './components/AdminProductsView';
import { AdminProductForm } from './components/AdminProductForm';
import { AdminNichesView } from './components/AdminNichesView';
import { AdminCategoriesView } from './components/AdminCategoriesView';
import { AdminTagsView } from './components/AdminTagsView';
import { AdminAttributesView } from './components/AdminAttributesView';
import { AdminThemesView } from './components/AdminThemesView';
import { AdminCollectionsView } from './components/AdminCollectionsView';
import { AdminCatalogsView } from './components/AdminCatalogsView';
import { AdminCatalogForm } from './components/AdminCatalogForm';
import { CommercialDashboardView } from './components/CommercialDashboardView';
import { LoginModal } from './components/LoginModal';
import { useCart } from './useCart';
import { fetchApi } from './api';
import { Product, Catalog, Category, Collection, Order } from './types';
import { Sparkles, ArrowRight } from 'lucide-react';

export function App() {
  const [route, setRoute] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Auth state
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; roles: string[] } | null>(null);
  const isAdmin = currentUser?.roles?.includes('admin') ?? false;
  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    return typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  // Store data
  const [homeData, setHomeData] = useState<{
    categories: Category[];
    featuredProducts: Product[];
    catalogs: Catalog[];
    collections: Collection[];
  } | null>(null);

  const [productsList, setProductsList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    items: cartItems,
    addItem: addToCart,
    updateQuantity,
    removeItem,
    clearCart,
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
      setRoute(window.location.pathname || '/');
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
      fetchApi('/affiliates/track-click', {
        method: 'POST',
        body: JSON.stringify({
          code: refCode,
          sourceUrl: window.location.href,
        }),
      }).catch((e) => console.debug('Click tracking notice:', e));
    }

    fetchApi<any>('/public/home')
      .then((data) => setHomeData(data))
      .catch((e) => console.error('Failed to load public home data', e));
  }, []);

  // CORREÇÃO: Disparar fetch de /produtos quando a rota atual for /produtos
  useEffect(() => {
    if (route === '/produtos' || route.startsWith('/produtos?')) {
      setSelectedProduct(null);
      setLoading(true);
      const queryStr = route.includes('?') ? route.substring(route.indexOf('?')) : '';
      fetchApi<{ data: Product[] }>(`/public/products${queryStr}`)
        .then((res) => setProductsList(res.data || []))
        .catch(() => setProductsList([]))
        .finally(() => setLoading(false));
    } else if (route.startsWith('/produtos/')) {
      const slugFromRoute = route.replace('/produtos/', '').split('?')[0];
      if (slugFromRoute && (!selectedProduct || selectedProduct.slug !== slugFromRoute)) {
        setLoading(true);
        fetchApi<Product>(`/public/products/${slugFromRoute}`)
          .then((p) => setSelectedProduct(p))
          .catch(() => setSelectedProduct(null))
          .finally(() => setLoading(false));
      }
    } else if (route.startsWith('/catalogos/')) {
      const catSlug = route.replace('/catalogos/', '').split('?')[0];
      if (catSlug && (!selectedCatalog || selectedCatalog.slug !== catSlug)) {
        setLoading(true);
        fetchApi<Catalog>(`/public/catalogs/${catSlug}`)
          .then((c) => setSelectedCatalog(c))
          .catch(() => setSelectedCatalog(null))
          .finally(() => setLoading(false));
      }
    }
  }, [route]);

  // Route change handler
  const navigateTo = (newRoute: string) => {
    // Check if route is admin and requires auth
    if (newRoute.startsWith('/admin/')) {
      const isAdmin = currentUser?.roles?.includes('admin');
      if (!isAdmin) {
        setPendingRoute(newRoute);
        setShowLoginModal(true);
        return;
      }
    }

    setRoute(newRoute);
    if (typeof window !== 'undefined' && window.location.pathname !== newRoute) {
      window.history.pushState({}, '', newRoute);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (user: { id: string; email: string; roles: string[] }) => {
    setCurrentUser(user);
    if (user.roles.includes('admin')) {
      const target = pendingRoute || '/admin/products';
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
    navigateTo(`/produtos/${product.slug}`);
  };

  const handleSelectCatalog = async (catalogSlug: string) => {
    setLoading(true);
    try {
      const fullCatalog = await fetchApi<Catalog>(`/public/catalogs/${catalogSlug}`);
      setSelectedCatalog(fullCatalog);
      navigateTo(`/catalogos/${catalogSlug}`);
    } catch (e) {
      console.error('Failed to load catalog', e);
    } finally {
      setLoading(false);
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
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <ProductEmbedView productId={embedId} />
      </div>
    );
  }

  // 2. ADMIN BACKOFFICE ROUTE
  if (route.startsWith('/admin/')) {
    if (authChecking) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-xs">
          Verificando permissões de acesso...
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 text-slate-900 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 font-black flex items-center justify-center text-lg shadow-xs">
                E
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900">EuSou Backoffice</h2>
                <p className="text-xs text-slate-500">Acesso Restrito Administrativo</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-900">
              <span className="font-bold block mb-1">Credenciais de Acesso:</span>
              <span className="font-mono text-slate-700 block">E-mail: admin@eusou.com</span>
              <span className="font-mono text-slate-700 block">Senha: admin123</span>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const emailInput = (form.elements.namedItem('email') as HTMLInputElement).value;
                const passwordInput = (form.elements.namedItem('password') as HTMLInputElement).value;
                try {
                  const res = await fetchApi<{ accessToken: string }>('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: emailInput, password: passwordInput }),
                  });
                  localStorage.setItem('token', res.accessToken);
                  const me = await fetchApi<{ id: string; email: string; roles: string[] }>('/auth/me');
                  handleLoginSuccess(me);
                } catch (err: any) {
                  alert(err.message || 'Falha ao autenticar.');
                }
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
                  placeholder="admin@eusou.com"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
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
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Entrar no Backoffice
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    return (
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
        {route === '/admin/production' && <ProductionView />}
        {route === '/admin/inventory' && <InventoryView />}
        {route === '/admin/affiliates' && <AdminAffiliatesView onNavigate={navigateTo} />}
        {route === '/admin/divulgacao' && <PromoHubView onNavigate={navigateTo} />}
        {route === '/admin/marketplaces' && (
          <MarketplacesView token={localStorage.getItem('token') || ''} />
        )}
      </AdminLayout>
    );
  }

  // 3. PUBLIC STORE ROUTE
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 font-sans antialiased">
      <Header
        totalItems={totalItems}
        onNavigate={navigateTo}
        currentRoute={route}
      />

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />

      <main className="flex-1">
        {/* ROUTE: HOME */}
        {route === '/' && (
          <div>
            {/* Hero Banner */}
            <div className="bg-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
              <div className="max-w-3xl mx-auto space-y-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-xs font-semibold tracking-wider uppercase text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" /> Plataforma EuSou
                </span>
                <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
                  Descubra Produtos Autênticos & Curadorias Exclusivas
                </h1>
                <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                  Explore catálogos inteligentes, seleções temáticas e finalize seu pedido com total agilidade e segurança.
                </p>
                <div className="pt-4 flex justify-center gap-4">
                  <button
                    onClick={() => navigateTo('/produtos')}
                    className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-100 transition shadow-xs cursor-pointer"
                  >
                    Ver Todos os Produtos
                  </button>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
              {/* Categorias em Destaque */}
              {homeData?.categories && homeData.categories.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Categorias</h2>
                      <p className="text-xs text-slate-500">Navegue pelas principais áreas de produto</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {homeData.categories.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => navigateTo(`/produtos?category=${c.slug}`)}
                        className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-slate-800 hover:shadow-xs transition text-center cursor-pointer group"
                      >
                        <span className="text-xs font-bold text-slate-800 group-hover:text-black">
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catálogos Ativos em Destaque */}
              {homeData?.catalogs && homeData.catalogs.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Catálogos em Destaque</h2>
                      <p className="text-xs text-slate-500">Curadorias ativas e temáticas</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {homeData.catalogs.map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => handleSelectCatalog(cat.slug)}
                        className="p-6 bg-white rounded-2xl border border-gray-100 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block mb-1">
                            {cat.type === 'AUTOMATIC' ? 'Catálogo Dinâmico' : 'Curadoria Manual'}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900">{cat.name}</h3>
                          {cat.description && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                              {cat.description}
                            </p>
                          )}
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span>Acessar Catálogo</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Produtos Recentes / Destaques */}
              {homeData?.featuredProducts && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Produtos em Destaque</h2>
                      <p className="text-xs text-slate-500">Seleção com disponibilidade imediata</p>
                    </div>
                    <button
                      onClick={() => navigateTo('/produtos')}
                      className="text-xs font-bold text-slate-800 hover:underline flex items-center"
                    >
                      Ver todos <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>

                  {homeData.featuredProducts.length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-gray-100">
                      Nenhum produto cadastrado no momento.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                      {homeData.featuredProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          onSelect={handleSelectProduct}
                          onQuickAdd={(prod) =>
                            addToCart({
                              productId: prod.id,
                              name: prod.name,
                              unitPrice: prod.basePrice ? Number(prod.basePrice) : 0,
                              quantity: 1,
                              imageUrl: prod.media && prod.media[0] ? prod.media[0].url : null,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTE: PRODUTOS (LISTAGEM) */}
        {route.startsWith('/produtos') && !selectedProduct && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl font-black text-slate-900 mb-6">Todos os Produtos</h1>
            {loading ? (
              <div className="py-20 text-center text-xs text-slate-400">Carregando catálogo...</div>
            ) : productsList.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-gray-100">
                Nenhum produto encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {productsList.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onSelect={handleSelectProduct}
                    onQuickAdd={(prod) =>
                      addToCart({
                        productId: prod.id,
                        name: prod.name,
                        unitPrice: prod.basePrice ? Number(prod.basePrice) : 0,
                        quantity: 1,
                        imageUrl: prod.media && prod.media[0] ? prod.media[0].url : null,
                      })
                    }
                  />
                ))}
              </div>
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
            onAddToCart={addToCart}
          />
        )}

        {/* ROUTE: CATÁLOGO ESPECÍFICO */}
        {selectedCatalog && route.startsWith('/catalogos/') && (
          <CatalogView
            catalog={selectedCatalog}
            onSelectProduct={handleSelectProduct}
            onQuickAdd={(prod) =>
              addToCart({
                productId: prod.id,
                name: prod.name,
                unitPrice: prod.basePrice ? Number(prod.basePrice) : 0,
                quantity: 1,
                imageUrl: prod.media && prod.media[0] ? prod.media[0].url : null,
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
        {completedOrder && route.startsWith('/pedido/') && (
          <OrderConfirmation
            order={completedOrder}
            onNavigate={navigateTo}
          />
        )}

        {/* ROUTE: PORTAL DO AFILIADO */}
        {route === '/affiliate' && (
          <AffiliatePortalView onNavigate={navigateTo} />
        )}
      </main>

      <Footer onNavigate={navigateTo} />
    </div>
  );
}

export default App;
