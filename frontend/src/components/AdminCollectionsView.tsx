import React, { useEffect, useState } from 'react';
import { Collection, Product } from '../types';
import { fetchApi } from '../api';
import {
  Library,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Package,
  Layers,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  X,
} from 'lucide-react';

interface AdminCollectionsViewProps {
  onNavigate?: (route: string) => void;
}

export const AdminCollectionsView: React.FC<AdminCollectionsViewProps> = ({ onNavigate }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  // Products available to add to collection
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    status: 'ACTIVE' as 'DRAFT' | 'ACTIVE' | 'INACTIVE',
  });

  const loadCollections = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<{ data: Collection[] }>('/collections');
      setCollections(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar coleções:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetchApi<{ data: Product[] }>('/products?limit=100');
      setAllProducts(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar produtos para coleção:', err);
    }
  };

  useEffect(() => {
    loadCollections();
    loadProducts();
  }, []);

  const handleOpenCreate = () => {
    setEditingCollection(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      status: 'ACTIVE',
    });
    setSelectedProductIds([]);
    setModalOpen(true);
  };

  const handleOpenEdit = async (c: Collection) => {
    try {
      // Fetch fresh collection details with items
      const full = await fetchApi<Collection>(`/collections/${c.id}`);
      setEditingCollection(full);
      setFormData({
        name: full.name,
        slug: full.slug,
        description: full.description || '',
        status: (full.status as any) || 'ACTIVE',
      });
      const ids = (full.items || []).map((i: any) => i.productId || i.product?.id).filter(Boolean);
      setSelectedProductIds(ids);
      setModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar detalhes da coleção.');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await fetchApi(`/collections/${id}/duplicate`, { method: 'POST' });
      await loadCollections();
    } catch (err: any) {
      alert(err.message || 'Erro ao duplicar coleção.');
    }
  };

  const handleToggleStatus = async (c: Collection) => {
    try {
      const nextStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await fetchApi(`/collections/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadCollections();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status.');
    }
  };

  const handleDelete = async (c: Collection) => {
    if (!window.confirm(`Deseja realmente excluir/arquivar a coleção "${c.name}"?`)) return;
    try {
      await fetchApi(`/collections/${c.id}`, { method: 'DELETE' });
      await loadCollections();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir coleção.');
    }
  };

  const handleMoveProduct = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedProductIds.length) return;
    const newList = [...selectedProductIds];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    setSelectedProductIds(newList);
  };

  const handleToggleProductSelection = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== productId));
    } else {
      setSelectedProductIds([...selectedProductIds, productId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let savedCollectionId: string;
      if (editingCollection) {
        savedCollectionId = editingCollection.id;
        await fetchApi(`/collections/${savedCollectionId}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        });
      } else {
        const created = await fetchApi<Collection>('/collections', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        savedCollectionId = created.id;
      }

      // Reconciliate products in collection
      if (editingCollection) {
        // Find items to remove
        const existingIds = (editingCollection.items || []).map((i: any) => i.productId || i.product?.id);
        const toRemove = existingIds.filter((id: string) => !selectedProductIds.includes(id));
        for (const remId of toRemove) {
          try {
            await fetchApi(`/collections/${savedCollectionId}/products/${remId}`, { method: 'DELETE' });
          } catch (e) {}
        }
      }

      // Add newly selected products
      for (const prodId of selectedProductIds) {
        try {
          await fetchApi(`/collections/${savedCollectionId}/products`, {
            method: 'POST',
            body: JSON.stringify({ productId: prodId }),
          });
        } catch (e) {}
      }

      // Update ordering if items exist
      if (selectedProductIds.length > 0) {
        const orderPayload = {
          items: selectedProductIds.map((pId, idx) => ({ productId: pId, position: idx })),
        };
        try {
          await fetchApi(`/collections/${savedCollectionId}/products/reorder`, {
            method: 'POST',
            body: JSON.stringify(orderPayload),
          });
        } catch (e) {}
      }

      setModalOpen(false);
      await loadCollections();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar coleção.');
    }
  };

  const filteredCollections = collections.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Coleções Temáticas</h1>
          <p className="text-xs text-slate-500 mt-1">
            Crie agrupamentos reutilizáveis de produtos (ex: "Mais Vendidos", "Presentes", "Ofertas").
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCollections}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
            title="Atualizar lista"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Plus size={16} /> Nova Coleção
          </button>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Total: <span className="text-slate-900 font-bold">{filteredCollections.length}</span> coleções
        </div>
      </div>

      {/* Grid de Coleções */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Carregando coleções...</div>
      ) : filteredCollections.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Nenhuma coleção encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {c.status === 'ACTIVE' ? 'Ativa' : c.status}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">/{c.slug}</span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{c.name}</h3>
                {c.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                )}

                {/* Métricas */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Package size={14} className="text-slate-400" />
                    <span>
                      <strong className="text-slate-900">{c._count?.items ?? 0}</strong> produtos
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers size={14} className="text-slate-400" />
                    <span>
                      <strong className="text-slate-900">{c._count?.catalogs ?? 0}</strong> catálogos vinculados
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleStatus(c)}
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                      c.status === 'ACTIVE'
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title={c.status === 'ACTIVE' ? 'Inativar coleção' : 'Ativar coleção'}
                  >
                    {c.status === 'ACTIVE' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </button>
                  <button
                    onClick={() => handleDuplicate(c.id)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Duplicar coleção"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Editar coleção"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>

                <button
                  onClick={() => handleDelete(c)}
                  className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                  title="Excluir coleção"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Formulário & Gestão de Produtos */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {editingCollection ? `Editar Coleção: ${editingCollection.name}` : 'Criar Nova Coleção'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina os detalhes e escolha quais produtos farão parte da vitrine.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Identificação */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  1. Dados Principais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Coleção *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Mais Vendidos"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Slug (opcional)</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="ex: mais-vendidos"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-slate-900 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição da curadoria..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Seleção & Ordenação de Produtos */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    2. Produtos na Coleção ({selectedProductIds.length} selecionados)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Use os botões de seta para ajustar a ordem de exibição
                  </span>
                </div>

                {/* Produtos Ordenados Atuais */}
                {selectedProductIds.length > 0 && (
                  <div className="space-y-1.5 border border-slate-200 rounded-2xl p-3 bg-slate-50/50 max-h-56 overflow-y-auto">
                    {selectedProductIds.map((pId, index) => {
                      const prod = allProducts.find((p) => p.id === pId);
                      if (!prod) return null;
                      const thumb = prod.media?.find((m) => m.isPrimary)?.url || (prod.media && prod.media[0]?.url);
                      return (
                        <div
                          key={pId}
                          className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-[10px] text-slate-400 w-4 text-center">
                              {index + 1}
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {thumb ? (
                                <img src={thumb} alt={prod.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package size={14} className="text-slate-400" />
                              )}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-slate-900 block truncate max-w-xs sm:max-w-md">
                                {prod.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {prod.sku || 'Sem SKU'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveProduct(index, 'up')}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                              title="Subir posição"
                            >
                              <MoveUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={index === selectedProductIds.length - 1}
                              onClick={() => handleMoveProduct(index, 'down')}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                              title="Descer posição"
                            >
                              <MoveDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleProductSelection(pId)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50 ml-1"
                              title="Remover da coleção"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Seletor de busca de produtos para adicionar */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Adicionar Produtos à Coleção
                  </label>
                  <input
                    type="text"
                    placeholder="Pesquisar catálogo por nome ou SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900"
                  />

                  <div className="border border-slate-200 rounded-2xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {allProducts
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                      )
                      .map((p) => {
                        const isSelected = selectedProductIds.includes(p.id);
                        const thumb = p.media?.find((m) => m.isPrimary)?.url || (p.media && p.media[0]?.url);
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleToggleProductSelection(p.id)}
                            className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                              isSelected ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by parent div
                                className="w-4 h-4 rounded text-slate-900"
                              />
                              <div className="w-7 h-7 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                {thumb ? (
                                  <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package size={12} className="text-slate-400" />
                                )}
                              </div>
                              <div>
                                <span className="font-medium text-slate-800 block">{p.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {p.sku || 'Sem SKU'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700">
                              R$ {Number(p.basePrice || 0).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
                >
                  {editingCollection ? 'Atualizar Coleção' : 'Criar Coleção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
