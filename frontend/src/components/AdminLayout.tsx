import React, { ReactNode } from 'react';
import {
  Package,
  Layers,
  FolderTree,
  Tag,
  SlidersHorizontal,
  Palette,
  BookOpen,
  Library,
  ShoppingBag,
  Cpu,
  Boxes,
  Share2,
  Users,
  Store,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  ChevronRight,
  Menu,
  X,
  DollarSign,
} from 'lucide-react';

interface AdminLayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
  userEmail: string;
  children: ReactNode;
}

interface NavItem {
  label: string;
  route: string;
  icon: any;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  onNavigate,
  onLogout,
  userEmail,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleMobileNavigate = (route: string) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  const navSections: NavSection[] = [
    {
      title: 'VISÃO GERAL',
      items: [
        {
          label: 'Dashboard',
          route: '/admin/dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'CATÁLOGO',
      items: [
        { label: 'Produtos', route: '/admin/products', icon: Package },
        { label: 'Nichos', route: '/admin/niches', icon: Layers },
        { label: 'Categorias', route: '/admin/categories', icon: FolderTree },
        { label: 'Tags', route: '/admin/tags', icon: Tag },
        { label: 'Atributos', route: '/admin/attributes', icon: SlidersHorizontal },
        { label: 'Temas', route: '/admin/themes', icon: Palette },
      ],
    },
    {
      title: 'PUBLICAÇÃO',
      items: [
        { label: 'Catálogos', route: '/admin/catalogs', icon: BookOpen },
        { label: 'Coleções', route: '/admin/collections', icon: Library },
      ],
    },
    {
      title: 'OPERAÇÃO',
      items: [
        { label: 'Pedidos', route: '/admin/orders', icon: ShoppingBag },
        { label: 'Precificação', route: '/admin/pricing', icon: DollarSign },
        { label: 'Produção 3D', route: '/admin/production', icon: Cpu },
        { label: 'Estoque', route: '/admin/inventory', icon: Boxes },
      ],
    },
    {
      title: 'DISTRIBUIÇÃO',
      items: [
        { label: 'Divulgação', route: '/admin/divulgacao', icon: Share2 },
        { label: 'Afiliados', route: '/admin/affiliates', icon: Users },
        { label: 'Marketplaces', route: '/admin/marketplaces', icon: Store },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs">
            E
          </div>
          <span className="font-extrabold text-sm tracking-tight">EuSou Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/')}
            title="Voltar à loja"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar (Desktop fixed + Mobile drawer) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-xs">
              E
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight block">EuSou</span>
              <span className="text-[10px] text-amber-400 font-bold tracking-wider uppercase block">
                Backoffice Admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate('/')}
              title="Voltar para a Loja"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentRoute === item.route || currentRoute.startsWith(`${item.route}/`);
                  return (
                    <button
                      key={item.route}
                      disabled={Boolean(item.badge)}
                      onClick={() => handleMobileNavigate(item.route)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : item.badge
                          ? 'text-slate-500 hover:bg-transparent cursor-not-allowed opacity-60'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                          {item.badge}
                        </span>
                      ) : (
                        isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="truncate mr-2">
            <span className="text-[10px] text-slate-500 block">Conectado como</span>
            <span className="text-xs font-bold text-slate-200 truncate block">{userEmail}</span>
          </div>
          <button
            onClick={onLogout}
            title="Encerrar sessão"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};
