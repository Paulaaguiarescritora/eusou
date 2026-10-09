import React, { useEffect, useState } from 'react';
import { Catalog, Theme, Niche, Category, Tag, Product, Collection } from '../types';
import { fetchApi } from '../api';
import {
  ArrowLeft,
  Save,
  Package,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Palette,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  X,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface AdminCatalogFormProps {
  catalogId?: string;
  onNavigate: (route: string) => void;
}

export const AdminCatalogForm: React.FC<AdminCatalogFormProps> = ({
  catalogId,
  onNavigate,
}) => {
  const isEditing = Boolean(catalogId);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Aux data
  const [themes, setThemes] = useState<Theme[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    status: 'ACTIVE' as 'DRAFT' | 'ACTIVE' | 'INACTIVE',
    type: 'MANUAL' as 'MANUAL' | 'AUTOMATIC',
    nicheId: '',
    themeId: '',
  });

  // Manual Products Selection & Ordering
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Collections Linked to Catalog
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);

  // Automatic Rules
  const [rules, setRules] = useState<{ type: 'NICHE' | 'CATEGORY' | 'TAG'; value: string }[]>([]);

  // Resolved dynamic preview products (for AUTOMATIC type)
  const [resolvedProducts, setResolvedProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Load metadata
    Promise.all([
      fetchApi<{ data: Theme[] }>('/themes').then((r) => setThemes(r.data || [])),
      fetchApi<{ data: Niche[] }>('/niches').then((r) => setNiches(r.data || [])),
      fetchApi<{ data: Category[] }>('/categories').then((r) => setCategories(r.data || [])),
      fetchApi<{ data: Tag[] }>('/tags').then((r) => setTags(r.data || [])),
      fetchApi<{ data: Product[] }>('/products?limit=100').then((r) => setAllProducts(r.data || [])),
      fetchApi<{ data: Collection[] }>('/collections?limit=50').then((r) => setAllCollections(r.data || [])),
    ]).catch((err) => console.error('Erro ao carregar metadados:', err));

    if (isEditing && catalogId) {
      loadCatalog(catalogId);
    }
  }, [catalogId]);

  const loadCatalog = async (id: string) => {
    try {
      setLoading(true);
      const cat = await fetchApi<Catalog>(`/catalogs/${id}`);
      setFormData({
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        status: (cat.status as any) || 'ACTIVE',
        type: cat.type || 'MANUAL',
        nicheId: cat.nicheId || '',
        themeId: cat.themeId || '',
      });
      const prodIds = (cat.items || []).map((i: any) => i.productId || i.product?.id).filter(Boolean);
      setSelectedProductIds(prodIds);

      const colIds = (cat.collections || []).map((c: any) => c.collectionId || c.collection?.id).filter(Boolean);
      setSelectedCollectionIds(colIds);

      if (cat.rules && cat.rules.length > 0) {
        setRules(cat.rules.map((r: any) => ({ type: r.type, value: r.value })));
      }

      // If automatic, resolve products preview
      if (cat.type === 'AUTOMATIC') {
        const resProds = await fetchApi<Product[]>(`/catalogs/${id}/resolve-products`);
        setResolvedProducts(resProds || []);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar catálogo.');
    } finally {
      setLoading(false);
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

  const handleToggleCollectionSelection = (colId: string) => {
    if (selectedCollectionIds.includes(colId)) {
      setSelectedCollectionIds(selectedCollectionIds.filter((id) => id !== colId));
    } else {
      setSelectedCollectionIds([...selectedCollectionIds, colId]);
    }
  };

  const handleAddRule = () => {
    // Default to first niche or category
    const defValue = niches.length > 0 ? niches[0].id : '';
    setRules([...rules, { type: 'NICHE', value: defValue }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: 'type' | 'value', val: string) => {
    const updated = [...rules];
    if (field === 'type') {
      updated[index].type = val as any;
      // Reset value to first matching entity
      if (val === 'NICHE' && niches.length > 0) updated[index].value = niches[0].id;
      if (val === 'CATEGORY' && categories.length > 0) updated[index].value = categories[0].id;
      if (val === 'TAG' && tags.length > 0) updated[index].value = tags[0].id;
    } else {
      updated[index].value = val;
    }
    setRules(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        status: formData.status,
        type: formData.type,
        nicheId: formData.nicheId || null,
        themeId: formData.themeId || null,
      };
      if (formData.slug.trim()) payload.slug = formData.slug.trim();

      if (formData.type === 'AUTOMATIC') {
        payload.rules = rules;
      }

      let savedId: string;
      if (isEditing && catalogId) {
        savedId = catalogId;
        await fetchApi(`/catalogs/${catalogId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        const created = await fetchApi<Catalog>('/catalogs', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedId = created.id;
      }

      // Reconciliate manual products if MANUAL type
      if (formData.type === 'MANUAL') {
        if (isEditing && catalogId) {
          const cat = await fetchApi<Catalog>(`/catalogs/${savedId}`);
          const existingIds = (cat.items || []).map((i: any) => i.productId || i.product?.id);
          const toRemove = existingIds.filter((id: string) => !selectedProductIds.includes(id));
          for (const remId of toRemove) {
            try {
              await fetchApi(`/catalogs/${savedId}/products/${remId}`, { method: 'DELETE' });
            } catch (e) {}
          }
        }

        // Add selected products
        for (const prodId of selectedProductIds) {
          try {
            await fetchApi(`/catalogs/${savedId}/products`, {
              method: 'POST',
              body: JSON.stringify({ productId: prodId }),
            });
          } catch (e) {}
        }

        // Reorder products
        if (selectedProductIds.length > 0) {
          try {
            await fetchApi(`/catalogs/${savedId}/products/reorder`, {
              method: 'POST',
              body: JSON.stringify({
                items: selectedProductIds.map((pId, idx) => ({ productId: pId, position: idx })),
              }),
            });
          } catch (e) {}
        }
      }

      // Reconciliate collections in catalog
      if (isEditing && catalogId) {
        const cat = await fetchApi<Catalog>(`/catalogs/${savedId}`);
        const existingColIds = (cat.collections || []).map((c: any) => c.collectionId || c.collection?.id);
        const toRemCol = existingColIds.filter((id: string) => !selectedCollectionIds.includes(id));
        for (const remId of toRemCol) {
          try {
            await fetchApi(`/catalogs/${savedId}/collections/${remId}`, { method: 'DELETE' });
          } catch (e) {}
        }
      }

      for (const colId of selectedCollectionIds) {
        try {
          await fetchApi(`/catalogs/${savedId}/collections`, {
            method: 'POST',
            body: JSON.stringify({ collectionId: colId }),
          });
        } catch (e) {}
      }

      onNavigate('/admin/catalogs');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar catálogo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Carregando informações do catálogo...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/admin/catalogs')}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {isEditing ? `Editar Catálogo: ${formData.name}` : 'Criar Novo Catálogo'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina tipo (Manual ou Automático), tema, regras e coleções vinculadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing && formData.slug && (
            <a
              href={`/catalogos/${formData.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <ExternalLink size={14} /> Ver Vitrine Pública
            </a>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Catálogo'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BLOCO 1: IDENTIFICAÇÃO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center">
              1
            </span>
            Identificação
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Catálogo *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Casa & Decoração"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Slug URL</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="ex: casa-decoracao"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Descrição do Catálogo</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição exibida no topo da vitrine..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status de Publicação</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="ACTIVE">Ativo (Público na loja)</option>
                <option value="DRAFT">Rascunho (Oculto)</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nicho Principal (opcional)</label>
              <select
                value={formData.nicheId}
                onChange={(e) => setFormData({ ...formData, nicheId: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="">Nenhum nicho associado</option>
                {niches.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* BLOCO 2: APARÊNCIA & TEMA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center">
              2
            </span>
            Aparência & Tema
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tema da Vitrine</label>
              <select
                value={formData.themeId}
                onChange={(e) => setFormData({ ...formData, themeId: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="">Tema Padrão do Sistema</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.font} • {t.cardStyle})
                  </option>
                ))}
              </select>
            </div>

            {formData.themeId && (
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex items-center gap-3">
                {(() => {
                  const currentTheme = themes.find((t) => t.id === formData.themeId);
                  if (!currentTheme) return null;
                  return (
                    <>
                      <span
                        className="w-8 h-8 rounded-lg shrink-0 border border-slate-200"
                        style={{ backgroundColor: currentTheme.primaryColor }}
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">{currentTheme.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {currentTheme.productsPerRow} colunas • {currentTheme.buttonStyle}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* BLOCO 3: TIPO DO CATÁLOGO & REGRAS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center">
              3
            </span>
            Modo de Composição
          </h2>

          {/* Seleção do Modo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setFormData({ ...formData, type: 'MANUAL' })}
              className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                formData.type === 'MANUAL'
                  ? 'border-slate-900 bg-slate-50/80 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="type"
                checked={formData.type === 'MANUAL'}
                onChange={() => {}}
                className="mt-1"
              />
              <div>
                <span className="font-bold text-slate-900 text-xs block">Manual</span>
                <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                  Você escolhe individualmente os produtos e define a ordem exata de exibição.
                </span>
              </div>
            </div>

            <div
              onClick={() => setFormData({ ...formData, type: 'AUTOMATIC' })}
              className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                formData.type === 'AUTOMATIC'
                  ? 'border-slate-900 bg-slate-50/80 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="type"
                checked={formData.type === 'AUTOMATIC'}
                onChange={() => {}}
                className="mt-1"
              />
              <div>
                <span className="font-bold text-slate-900 text-xs block">Automático (Regras)</span>
                <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                  Os produtos entram dinamicamente baseados em regras de nicho, categoria ou tags.
                </span>
              </div>
            </div>
          </div>

          {/* Se AUTOMÁTICO: Construtor de Regras */}
          {formData.type === 'AUTOMATIC' && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Regras de Inclusão Automática
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Produtos com status ATIVO que combinem com qualquer das regras abaixo serão incluídos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus size={14} /> Adicionar Regra
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                  Nenhuma regra específica cadastrada. Se o catálogo possuir um Nicho associado, os produtos do nicho serão usados por padrão.
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <select
                        value={rule.type}
                        onChange={(e) => handleRuleChange(idx, 'type', e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                      >
                        <option value="NICHE">Nicho é igual a</option>
                        <option value="CATEGORY">Categoria é igual a</option>
                        <option value="TAG">Tag é igual a</option>
                      </select>

                      <div className="flex-1">
                        {rule.type === 'NICHE' && (
                          <select
                            value={rule.value}
                            onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                          >
                            {niches.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                          </select>
                        )}

                        {rule.type === 'CATEGORY' && (
                          <select
                            value={rule.value}
                            onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}

                        {rule.type === 'TAG' && (
                          <select
                            value={rule.value}
                            onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                          >
                            {tags.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview dos Produtos Resolvidos */}
              {isEditing && resolvedProducts.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    Prévia de Produtos Ativos Resolvidos ({resolvedProducts.length}):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {resolvedProducts.map((rp) => (
                      <div
                        key={rp.id}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] truncate"
                      >
                        <span className="font-semibold block truncate">{rp.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{rp.sku}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Se MANUAL: Seleção & Ordenação de Produtos */}
          {formData.type === 'MANUAL' && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Produtos no Catálogo ({selectedProductIds.length} selecionados)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Use as setas para ajustar a ordem de apresentação
                  </span>
                </div>
              </div>

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
                            title="Remover do catálogo"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Seletor de busca de produtos */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Adicionar Produtos à Vitrine
                </label>
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900"
                />

                <div className="border border-slate-200 rounded-2xl max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white">
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
                              onChange={() => {}}
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
          )}
        </div>

        {/* BLOCO 4: COLEÇÕES INCLUÍDAS NO CATÁLOGO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center">
              4
            </span>
            Coleções Associadas
          </h2>
          <p className="text-xs text-slate-500">
            Selecione quais coleções temáticas (ex: "Mais Vendidos", "Presentes") aparecerão em destaque dentro desta vitrine.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allCollections.map((col) => {
              const isSelected = selectedCollectionIds.includes(col.id);
              return (
                <div
                  key={col.id}
                  onClick={() => handleToggleCollectionSelection(col.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 mt-0.5 rounded text-slate-900"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{col.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">/{col.slug}</span>
                    {col.description && (
                      <span className="text-[11px] text-slate-500 line-clamp-1 mt-1 block">
                        {col.description}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => onNavigate('/admin/catalogs')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Catálogo'}
          </button>
        </div>
      </form>
    </div>
  );
};
