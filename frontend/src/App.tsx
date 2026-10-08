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
import { useCart } from './useCart';
import { fetchApi } from './api';
import { Product, Catalog, Category, Collection, Order } from './types';
import { Sparkles, ArrowRight, Layers, Tag, Grid } from 'lucide-react';

export function App() {
  const [route, setRoute] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/embed/')) {
      return window.location.pathname;
    }
    return '/';
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

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

  useEffect(() => {
    // Tracking de Afiliado via URL (?ref=CODIGO)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('eusou_ref_code', refCode);
      // Registra clique no backend de forma transparente
      fetchApi('/affiliates/track-click', {
        method: 'POST',
        body: JSON.stringify({
          code: refCode,
          sourceUrl: window.location.href,
        }),
      }).catch((e) => console.debug('Click tracking notice:', e));
    }

    // Load initial home data
    fetchApi<any>('/public/home')
      .then((data) => setHomeData(data))
      .catch((e) => console.error('Failed to load public home data', e));
  }, []);

  const navigateTo = (newRoute: string) => {
    setRoute(newRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (newRoute === '/produtos' || newRoute.startsWith('/produtos?')) {
      setLoading(true);
      fetchApi<{ data: Product[] }>('/public/products')
        .then((res) => setProductsList(res.data))
        .catch(() => setProductsList([]))
        .finally(() => setLoading(false));
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setRoute(`/produtos/${product.slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCatalog = async (catalogSlug: string) => {
    setLoading(true);
    try {
      const fullCatalog = await fetchApi<Catalog>(`/public/catalogs/${catalogSlug}`);
      setSelectedCatalog(fullCatalog);
      setRoute(`/catalogos/${catalogSlug}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error('Failed to load catalog', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderPlaced = (order: Order) => {
    setCompletedOrder(order);
    setRoute(`/pedido/${order.id}`);
  };

  // Standalone embed widget rendering (no global navbar/footer)
  if (route.startsWith('/embed/products/')) {
    const embedId = route.replace('/embed/products/', '').split('?')[0];
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <ProductEmbedView productId={embedId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 font-sans antialiased">
      <Header
        totalItems={totalItems}
        onNavigate={navigateTo}
        currentRoute={route}
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
                    className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-100 transition shadow-sm cursor-pointer"
                  >
                    Ver Todos os Produtos
                  </button>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
              {/* Categorias Principais */}
              {homeData?.categories && homeData.categories.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Categorias</h2>
                      <p className="text-xs text-slate-500">Navegue pelas divisões do catálogo</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {homeData.categories.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => navigateTo(`/produtos?category=${c.id}`)}
                        className="p-5 bg-white rounded-xl border border-gray-100 hover:border-slate-300 transition cursor-pointer text-center group"
                      >
                        <h4 className="font-bold text-sm text-slate-800 group-hover:text-black">
                          {c.name}
                        </h4>
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

        {/* ROUTE: ADMIN PEDIDOS */}
        {route === '/admin/orders' && (
          <AdminOrdersView />
        )}

        {/* ROUTE: ADMIN PRODUÇÃO */}
        {route === '/admin/production' && (
          <ProductionView />
        )}

        {/* ROUTE: ADMIN ESTOQUE */}
        {route === '/admin/inventory' && (
          <InventoryView />
        )}

        {/* ROUTE: ADMIN AFILIADOS */}
        {route === '/admin/affiliates' && (
          <AdminAffiliatesView onNavigate={navigateTo} />
        )}

        {/* ROUTE: ADMIN DIVULGAÇÃO */}
        {route === '/admin/divulgacao' && (
          <PromoHubView onNavigate={navigateTo} />
        )}

        {/* ROUTE: ADMIN MARKETPLACES */}
        {route === '/admin/marketplaces' && (
          <MarketplacesView token={localStorage.getItem('token') || ''} />
        )}

        {/* ROUTE: PORTAL DO AFILIADO */}
        {route === '/affiliate' && (
          <AffiliatePortalView onNavigate={navigateTo} />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
