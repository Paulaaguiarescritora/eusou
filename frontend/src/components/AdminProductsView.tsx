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

  // Archive Confirmation Modal State
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);
  const [archiving, setArchiving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsRes, nichesRes, catsRes] = await Promise.all([
        fetchApi<{ data: Product[] }>('/products?limit=100').catch(() => ({ data: [] })),
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

  const handleConfirmArchive = async () => {
    if (!productToArchive) return;
    setArchiving(true);
    try {
      await fetchApi(`/products/${productToArchive.id}`, {
        method: 'DELETE',
      });
      setProductToArchive(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao arquivar produto');
    } finally {
      setArchiving(false);
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
                  <th className="py-3 px-4">Preço Varejo (Loja)</th>
                  <th className="py-3 px-4">Categorias / Nichos</th>
                  <th className="py-3 px-4">Canais Comerciais</th>
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

                      {/* Preço de Varejo (Loja Própria via F12) */}
                      <td className="py-3 px-4">
                        {(() => {
                          const ownPrice = (p as any).productChannelPrices?.find(
                            (pcp: any) => pcp.channel?.type === 'OWN_STORE'
                          )?.effectivePrice;

                          // Validação de custo de produção (MANUAL vs F7)
                          const isManual = p.costSource === 'MANUAL';
                          const hasManualCost =
                            isManual &&
                            p.manualCost !== null &&
                            p.manualCost !== undefined &&
                            Number(p.manualCost) > 0;
                          const hasF7Cost =
                            !isManual &&
                            Boolean(
                              p.productionProfiles &&
                                p.productionProfiles.length > 0
                            );
                          const hasValidCost =
                            p.hasValidCost !== undefined
                              ? p.hasValidCost
                              : isManual
                              ? hasManualCost
                              : hasF7Cost;

                          // Validação de preço de atacado
                          const hasWholesale =
                            p.wholesalePrice !== null &&
                            p.wholesalePrice !== undefined &&
                            Number(p.wholesalePrice) > 0;

                          // 1. Preço de varejo calculado pela Loja Própria
                          if (ownPrice && Number(ownPrice) > 0) {
                            return (
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  R$ {Number(ownPrice).toFixed(2).replace('.', ',')}
                                </span>
                                {hasWholesale && (
                                  <span className="text-[10px] text-slate-400 block">
                                    Atacado: R$ {Number(p.wholesalePrice).toFixed(2).replace('.', ',')}
                                  </span>
                                )}
                              </div>
                            );
                          }

                          // 2. Sem custo de produção definido
                          if (!hasValidCost) {
                            return (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Aguardando custo
                              </span>
                            );
                          }

                          // 3. Custo definido, aguardando definição de atacado
                          if (!hasWholesale) {
                            return (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Aguardando atacado
                                </span>
                                <span className="text-[10px] text-slate-500 block font-medium">
                                  Custo: R$ {Number(isManual ? p.manualCost : 0).toFixed(2).replace('.', ',')} {isManual ? '(Manual)' : ''}
                                </span>
                              </div>
                            );
                          }

                          // 4. Custo e atacado presentes, mas canal da loja ainda não sincronizado
                          return (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                Não calculado
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Atacado: R$ {Number(p.wholesalePrice).toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          );
                        })()}
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

                      {/* Canais Comerciais */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {p.status === 'ARCHIVED' ? (
                            <span className="text-slate-400 text-[10px] italic">Revogados (Arquivado)</span>
                          ) : p.productChannels && p.productChannels.length > 0 ? (
                            p.productChannels.map((pc) => (
                              <span
                                key={pc.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                  pc.isEnabled
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {pc.channel.name} {pc.isEnabled ? '' : '(Pausado)'}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Nenhum canal ativo</span>
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
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onNavigate(`/produtos/${p.slug}`)}
                            title="Ver na loja"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          {p.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => setProductToArchive(p)}
                              title="Arquivar produto (remove de todos os canais)"
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Modal de Confirmação Explícita de Arquivamento */}
      {productToArchive && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Arquivar produto?</h3>
                <p className="text-xs text-slate-500 font-semibold">{productToArchive.name}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              Este produto será removido de todos os canais comerciais em que estiver disponível. O histórico de pedidos, estoque, movimentações e demais registros será preservado.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={archiving}
                onClick={() => setProductToArchive(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={handleConfirmArchive}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {archiving ? 'Arquivando...' : 'Confirmar arquivamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
