import React, { useState } from 'react';
import { ShoppingBag, Search, Menu, X, Store as StoreIcon, ChevronDown } from 'lucide-react';
import { Store } from '../types';

interface HeaderProps {
  totalItems: number;
  onNavigate: (route: string) => void;
  currentRoute: string;
  brandTitle?: string | null;
  activeStoreSlug?: string | null;
  stores?: Store[];
  onSelectStore?: (storeSlug: string | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalItems,
  onNavigate,
  brandTitle,
  activeStoreSlug,
  stores = [],
  onSelectStore,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storesMenuOpen, setStoresMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isInsideStore = Boolean(activeStoreSlug);
  const displayBrand = brandTitle?.trim() || (isInsideStore ? 'Loja Especializada' : 'KUBO STUDIO');
  const brandInitial = displayBrand.charAt(0).toUpperCase();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const nicheQuery = activeStoreSlug ? `&niche=${encodeURIComponent(activeStoreSlug)}` : '';
      onNavigate(`/produtos?search=${encodeURIComponent(searchQuery.trim())}${nicheQuery}`);
    }
  };

  const handleStoreClick = (slug: string | null | undefined) => {
    setStoresMenuOpen(false);
    setMobileMenuOpen(false);
    const resolvedSlug = slug || null;
    if (onSelectStore) {
      onSelectStore(resolvedSlug);
    } else {
      if (resolvedSlug) {
        onNavigate(`/loja/${resolvedSlug}`);
      } else {
        onNavigate('/');
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Store Switcher */}
          <div className="flex items-center space-x-3">
            <div
              className="flex items-center space-x-2.5 cursor-pointer"
              onClick={() => (isInsideStore ? handleStoreClick(activeStoreSlug) : onNavigate('/'))}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg tracking-wider ${
                  activeStoreSlug === 'romance'
                    ? 'bg-rose-600'
                    : activeStoreSlug === 'sensora-intima'
                    ? 'bg-purple-600'
                    : activeStoreSlug === 'pet-shop'
                    ? 'bg-indigo-600'
                    : 'bg-slate-900'
                }`}
              >
                {brandInitial}
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 leading-tight">
                  {displayBrand}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase -mt-0.5">
                  {isInsideStore ? 'Loja Ativa' : 'Hub Multilojas'}
                </span>
              </div>
            </div>

            {/* Switcher Pill when inside a store */}
            {isInsideStore && (
              <button
                type="button"
                onClick={() => handleStoreClick(null)}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-full transition cursor-pointer border border-slate-200"
                title="Voltar ao portal de todas as lojas"
              >
                <StoreIcon className="w-3 h-3 text-slate-500" />
                <span>Todas as Lojas</span>
              </button>
            )}
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder={
                  isInsideStore
                    ? `Buscar em ${displayBrand}...`
                    : 'Buscar produtos, categorias...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-slate-800 transition"
              />
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
            </form>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <button
              onClick={() => onNavigate('/')}
              className="text-sm font-medium text-gray-700 hover:text-black transition cursor-pointer"
            >
              Início
            </button>

            {/* Dropdown de Lojas */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setStoresMenuOpen(!storesMenuOpen)}
                className="text-sm font-medium text-gray-700 hover:text-black transition flex items-center gap-1 cursor-pointer"
              >
                <span>Lojas</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {storesMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                    Lojas Especializadas
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStoreClick(null)}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Todas as Lojas (Portal)</span>
                    {!activeStoreSlug && <span className="text-[10px] text-slate-400 font-bold">Ativo</span>}
                  </button>
                  <div className="border-t border-gray-50 my-1"></div>
                  <button
                    type="button"
                    onClick={() => handleStoreClick('pet-shop')}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50/50 flex items-center justify-between"
                  >
                    <span>🐾 Felinodélia (Pet)</span>
                    {activeStoreSlug === 'pet-shop' && <span className="text-[10px] text-indigo-600 font-bold">Ativo</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStoreClick('romance')}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-rose-50/50 flex items-center justify-between"
                  >
                    <span>💖 Romance (Confeitaria)</span>
                    {activeStoreSlug === 'romance' && <span className="text-[10px] text-rose-600 font-bold">Ativo</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStoreClick('sensora-intima')}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-purple-50/50 flex items-center justify-between"
                  >
                    <span>✨ Sensora Íntima</span>
                    {activeStoreSlug === 'sensora-intima' && <span className="text-[10px] text-purple-600 font-bold">Ativo</span>}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (activeStoreSlug) {
                  onNavigate(`/produtos?niche=${encodeURIComponent(activeStoreSlug)}`);
                } else {
                  onNavigate('/produtos');
                }
              }}
              className="text-sm font-medium text-gray-700 hover:text-black transition cursor-pointer"
            >
              Produtos
            </button>

            <button
              onClick={() => {
                const affiliateRoute = activeStoreSlug
                  ? `/affiliate?niche=${encodeURIComponent(activeStoreSlug)}`
                  : '/affiliate';
                onNavigate(affiliateRoute);
              }}
              className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/20 font-semibold hover:bg-amber-500/20 transition cursor-pointer"
            >
              Seja um Afiliado
            </button>
          </nav>

          {/* Cart & Mobile Toggle */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate('/carrinho')}
              className="relative p-2 rounded-full hover:bg-gray-100 transition cursor-pointer flex items-center justify-center"
              aria-label="Carrinho de Compras"
            >
              <ShoppingBag className="w-6 h-6 text-slate-800" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-xs">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-black hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-gray-100 space-y-3">
            <form onSubmit={handleSearchSubmit} className="relative w-full mb-3">
              <input
                type="text"
                placeholder={isInsideStore ? `Buscar em ${displayBrand}...` : 'Buscar produtos...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
              />
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
            </form>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Lojas do Ecossistema:
              </span>
              <button
                onClick={() => handleStoreClick(null)}
                className="block w-full text-left py-1.5 px-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-white"
              >
                🏠 Todas as Lojas (Portal)
              </button>
              <button
                onClick={() => handleStoreClick('pet-shop')}
                className="block w-full text-left py-1.5 px-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-white"
              >
                🐾 Felinodélia (Pet & Design)
              </button>
              <button
                onClick={() => handleStoreClick('romance')}
                className="block w-full text-left py-1.5 px-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-white"
              >
                💖 Romance (Confeitaria Artesanal)
              </button>
              <button
                onClick={() => handleStoreClick('sensora-intima')}
                className="block w-full text-left py-1.5 px-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-white"
              >
                ✨ Sensora Íntima (Bem-Estar & Autocuidado)
              </button>
            </div>

            <div className="space-y-1 pt-1">
              <button
                onClick={() => {
                  onNavigate('/');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left py-2 px-2 text-sm font-medium text-gray-800"
              >
                Início
              </button>
              <button
                onClick={() => {
                  if (activeStoreSlug) {
                    onNavigate(`/produtos?niche=${encodeURIComponent(activeStoreSlug)}`);
                  } else {
                    onNavigate('/produtos');
                  }
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left py-2 px-2 text-sm font-medium text-gray-800"
              >
                Produtos
              </button>
              <button
                onClick={() => {
                  const affiliateRoute = activeStoreSlug
                    ? `/affiliate?niche=${encodeURIComponent(activeStoreSlug)}`
                    : '/affiliate';
                  onNavigate(affiliateRoute);
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left py-2 px-2 text-sm font-medium text-amber-900"
              >
                Seja um Afiliado
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

interface FooterProps {
  onNavigate?: (route: string) => void;
  brandTitle?: string | null;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, brandTitle }) => {
  const displayBrand = brandTitle?.trim() || 'KUBO STUDIO';
  const brandInitial = displayBrand.charAt(0).toUpperCase();

  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center space-x-2 text-white font-bold text-lg mb-3">
            <div className="w-7 h-7 rounded-full bg-white text-slate-900 flex items-center justify-center font-black text-sm">
              {brandInitial}
            </div>
            <span>{displayBrand}</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Ecossistema de lojas especializadas: Felinodélia (Pet), Romance (Confeitaria) e Sensora Íntima (Bem-Estar).
          </p>
        </div>
        <div>
          <h4 className="text-white text-sm font-semibold mb-3 tracking-wider uppercase">Lojas Oficiais</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/loja/pet-shop')}
                className="hover:text-white transition cursor-pointer text-left flex items-center gap-1.5"
              >
                <span>🐾 Felinodélia (Pet Shop)</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/loja/romance')}
                className="hover:text-white transition cursor-pointer text-left flex items-center gap-1.5"
              >
                <span>💖 Romance (Confeitaria)</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/loja/sensora-intima')}
                className="hover:text-white transition cursor-pointer text-left flex items-center gap-1.5"
              >
                <span>✨ Sensora Íntima</span>
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white text-sm font-semibold mb-3 tracking-wider uppercase">Navegação</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/')}
                className="hover:text-white transition cursor-pointer text-left"
              >
                Início (Todas as Lojas)
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/produtos')}
                className="hover:text-white transition cursor-pointer text-left"
              >
                Todos os Produtos
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/affiliate')}
                className="hover:text-white transition cursor-pointer text-left text-amber-400 font-medium"
              >
                Programa de Afiliados
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/admin')}
                className="hover:text-white transition cursor-pointer text-left text-xs opacity-75 hover:opacity-100"
              >
                Painel Administrativo
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white text-sm font-semibold mb-3 tracking-wider uppercase">Segurança & Confiança</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ambiente com criptografia de ponta a ponta e processamento de pedidos auditado. Suas compras e dados são 100% protegidos.
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} {displayBrand}. Todos os direitos reservados.
      </div>
    </footer>
  );
};
