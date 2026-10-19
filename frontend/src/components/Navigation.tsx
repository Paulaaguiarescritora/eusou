import React, { useState } from 'react';
import { ShoppingBag, Search, Menu, X, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  totalItems: number;
  onNavigate: (route: string) => void;
  currentRoute: string;
  brandTitle?: string | null;
}

export const Header: React.FC<HeaderProps> = ({ totalItems, onNavigate, brandTitle }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const displayBrand = brandTitle?.trim() || 'EuSou';
  const brandInitial = displayBrand.charAt(0).toUpperCase();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate(`/produtos?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-lg tracking-wider">
              {brandInitial}
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">{displayBrand}</span>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="Buscar produtos, categorias..."
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
              className="text-sm font-medium text-gray-700 hover:text-black transition"
            >
              Início
            </button>
            <button
              onClick={() => onNavigate('/produtos')}
              className="text-sm font-medium text-gray-700 hover:text-black transition"
            >
              Produtos
            </button>
            <button
              onClick={() => onNavigate('/affiliate')}
              className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/20 font-semibold hover:bg-amber-500/20 transition"
            >
              Seja um Afiliado
            </button>
          </nav>

          {/* Cart & Mobile Toggle */}
          <div className="flex items-center space-x-4">
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
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-slate-800"
              />
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
            </form>
            <button
              onClick={() => {
                onNavigate('/');
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left py-2 text-sm font-medium text-gray-800"
            >
              Início
            </button>
            <button
              onClick={() => {
                onNavigate('/produtos');
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left py-2 text-sm font-medium text-gray-800"
            >
              Produtos
            </button>
            <button
              onClick={() => {
                onNavigate('/affiliate');
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left py-2 text-sm font-medium text-amber-900"
            >
              Seja um Afiliado
            </button>
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
  const displayBrand = brandTitle?.trim() || 'Loja Especializada';
  const brandInitial = displayBrand.charAt(0).toUpperCase();

  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center space-x-2 text-white font-bold text-lg mb-3">
            <div className="w-7 h-7 rounded-full bg-white text-slate-900 flex items-center justify-center font-black text-sm">
              {brandInitial}
            </div>
            <span>{displayBrand}</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Curadorias exclusivas, catálogos temáticos e compras com entrega segura.
          </p>
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
                Início
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
                onClick={() => onNavigate && onNavigate('/')}
                className="hover:text-white transition cursor-pointer text-left"
              >
                Catálogos Temáticos
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
