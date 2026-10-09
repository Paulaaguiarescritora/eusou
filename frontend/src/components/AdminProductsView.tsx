import React, { useEffect, useState } from 'react';
import { Product, Niche, Category, Tag } from '../types';
import { fetchApi } from '../api';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Eye,
  CheckCircle2,
  XCircle,
  Archive,
  Image as ImageIcon,
  DollarSign,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface AdminProductsViewProps {
  onNavigate: (route: string) => void;
}

export const AdminProductsView: React.FC<AdminProductsViewProps> = ({ onNavigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsRes, nichesRes, catsRes] = await Promise.all([
        fetchApi<{ data: Product[] }>('/products').catch(() => ({ data: [] })),
        fetchApi<{ data: Niche[] }>('/niches').catch(() => ({ data: [] })),
        fetchApi<{ data: Category[] }>('/categories').catch(() => ({ data: [] })),
      ]);
      setProducts(prodsRes.data || []);
      setNiches(nichesRes.data || []);
      setCategories(catsRes.data || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      await fetchApi(`/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status do produto');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      p.slug.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    const matchesCategory =
      categoryFilter === 'ALL' ||
      (p.categories && p.categories.some((c) => c.category.id === categoryFilter));

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-500" /> Catálogo de Produtos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Fonte central da verdade de produtos, precificação e metadados
          </p>
        </div>

        <button
          onClick={() => onNavigate('/admin/products/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <input
            type="text"
            placeholder="Buscar por nome, SKU ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
            >
              <option value="ALL">Todos os status</option>
              <option value="ACTIVE">Ativos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="INACTIVE">Inativos</option>
              <option value="ARCHIVED">Arquivados</option>
            </select>
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
          >
            <option value="ALL">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 font-semibold pl-2">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Carregando catálogo de produtos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">
            Nenhum produto cadastrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Preço Base</th>
                  <th className="py-3 px-4">Categorias / Nichos</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const primaryImg =
                    p.media?.find((m) => m.isPrimary)?.url ||
                    (p.media && p.media.length > 0 ? p.media[0].url : null);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      {/* Product Name & Thumb */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                            {primaryImg ? (
                              <img src={primaryImg} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block hover:text-amber-600 transition cursor-pointer" onClick={() => onNavigate(`/admin/products/${p.id}`)}>
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">/{p.slug}</span>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {p.sku || <span className="text-slate-400 italic">Sem SKU</span>}
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {p.basePrice ? `R$ ${Number(p.basePrice).toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                      </td>

                      {/* Categories / Niches */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {p.categories && p.categories.length > 0 ? (
                            p.categories.map((c, i) => (
                              <span key={i} className="inline-block mr-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                                {c.category.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Sem categoria</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {p.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Ativo
                          </span>
                        )}
                        {p.status === 'DRAFT' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Rascunho
                          </span>
                        )}
                        {p.status === 'INACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3" /> Inativo
                          </span>
                        )}
                        {p.status === 'ARCHIVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <Archive className="w-3 h-3" /> Arquivado
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onNavigate(`/admin/products/${p.id}`)}
                            title="Visualizar / Editar"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onNavigate(`/produtos/${p.slug}`)}
                            title="Ver na loja"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
  );
};
