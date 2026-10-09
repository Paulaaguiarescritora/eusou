import React, { useEffect, useState } from 'react';
import { Product, Niche, Category, Tag, AttributeDefinition, ProductVariant } from '../types';
import { fetchApi } from '../api';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  Star,
  CheckCircle2,
  AlertCircle,
  Layers,
  Tag as TagIcon,
  FolderTree,
  DollarSign,
  Package,
} from 'lucide-react';

interface AdminProductFormProps {
  productId?: string;
  onNavigate: (route: string) => void;
}

export const AdminProductForm: React.FC<AdminProductFormProps> = ({ productId, onNavigate }) => {
  const isEditing = Boolean(productId && productId !== 'new');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Aux data
  const [allNiches, setAllNiches] = useState<Niche[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allAttributes, setAllAttributes] = useState<AttributeDefinition[]>([]);

  // Main Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [brand, setBrand] = useState('EuSou');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');

  // Relation selections
  const [selectedNicheIds, setSelectedNicheIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Media
  const [mediaList, setMediaList] = useState<{ id?: string; url: string; isPrimary: boolean; sortOrder: number }[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState('');

  // Variants
  const [variantsList, setVariantsList] = useState<ProductVariant[]>([]);
  const [newVariantSku, setNewVariantSku] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantName, setNewVariantName] = useState('');

  // Quick tag
  const [newTagInput, setNewTagInput] = useState('');

  const handleCreateQuickTag = async () => {
    if (!newTagInput.trim()) return;
    const rawTags = newTagInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (rawTags.length === 0) return;

    try {
      const createdIds: string[] = [];
      const createdTags: Tag[] = [];

      for (const tagText of rawTags) {
        // Check if already in allTags
        const existing = allTags.find(
          (t) => t.name.toLowerCase() === tagText.toLowerCase()
        );
        if (existing) {
          createdIds.push(existing.id);
        } else {
          try {
            const cleanSlug = tagText
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, '-')
              .replace(/[^\w-]/g, '')
              .slice(0, 50);

            const created = await fetchApi<Tag>('/tags', {
              method: 'POST',
              body: JSON.stringify({
                name: tagText,
                slug: cleanSlug || `tag-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                status: 'ACTIVE',
              }),
            });
            createdTags.push(created);
            createdIds.push(created.id);
          } catch (e) {
            console.error('Failed to create individual tag', tagText, e);
          }
        }
      }

      if (createdTags.length > 0) {
        setAllTags((prev) => [...prev, ...createdTags]);
      }
      setSelectedTagIds((prev) => Array.from(new Set([...prev, ...createdIds])));
      setNewTagInput('');
    } catch (err: any) {
      alert(err.message || 'Erro ao processar tags');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [nichesRes, catsRes, tagsRes, attrsRes] = await Promise.all([
        fetchApi<{ data: Niche[] }>('/niches').catch(() => ({ data: [] })),
        fetchApi<{ data: Category[] }>('/categories').catch(() => ({ data: [] })),
        fetchApi<{ data: Tag[] }>('/tags').catch(() => ({ data: [] })),
        fetchApi<{ data: AttributeDefinition[] }>('/attributes').catch(() => ({ data: [] })),
      ]);

      setAllNiches(nichesRes.data || []);
      setAllCategories(catsRes.data || []);
      setAllTags(tagsRes.data || []);
      setAllAttributes(attrsRes.data || []);

      if (isEditing && productId) {
        const prod = await fetchApi<Product>(`/products/${productId}`);
        setName(prod.name || '');
        setSlug(prod.slug || '');
        setSku(prod.sku || '');
        setBrand(prod.brand || 'EuSou');
        setStatus(prod.status || 'ACTIVE');
        setShortDescription(prod.shortDescription || '');
        setDescription(prod.description || '');
        setBasePrice(prod.basePrice ? String(prod.basePrice) : '');

        // Relational binds
        if (prod.niches) {
          setSelectedNicheIds(prod.niches.map((n) => n.niche.id));
        }
        if (prod.categories) {
          setSelectedCategoryIds(prod.categories.map((c) => c.category.id));
        }
        if (prod.tags) {
          setSelectedTagIds(prod.tags.map((t) => t.tag.id));
        }
        if (prod.media) {
          const sortedMedia = [...prod.media].sort((a, b) => {
            if (a.isPrimary) return -1;
            if (b.isPrimary) return 1;
            return (a.sortOrder || 0) - (b.sortOrder || 0);
          });
          setMediaList(
            sortedMedia.map((m, idx) => ({
              id: m.id,
              url: m.url,
              isPrimary: m.isPrimary || idx === 0,
              sortOrder: m.sortOrder || idx,
            }))
          );
        }
        if (prod.variants) {
          setVariantsList(prod.variants);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do produto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [productId]);

  const handleAddMedia = async () => {
    if (!newMediaUrl.trim()) return;

    if (isEditing && productId) {
      try {
        const createdMedia = await fetchApi<any>(`/products/${productId}/media`, {
          method: 'POST',
          body: JSON.stringify({
            url: newMediaUrl.trim(),
            type: 'IMAGE',
            isPrimary: mediaList.length === 0,
            sortOrder: mediaList.length,
          }),
        });
        setMediaList([...mediaList, createdMedia]);
        setNewMediaUrl('');
      } catch (err: any) {
        alert(err.message || 'Erro ao adicionar imagem');
      }
    } else {
      setMediaList([
        ...mediaList,
        {
          url: newMediaUrl.trim(),
          isPrimary: mediaList.length === 0,
          sortOrder: mediaList.length,
        },
      ]);
      setNewMediaUrl('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const resultUrl = event.target?.result as string;
        if (!resultUrl) return;

        if (isEditing && productId) {
          try {
            const createdMedia = await fetchApi<any>(`/products/${productId}/media/upload`, {
              method: 'POST',
              body: JSON.stringify({
                fileBase64: resultUrl,
                originalName: file.name,
                isPrimary: mediaList.length === 0,
              }),
            });
            setMediaList((prev) => [...prev, createdMedia]);
          } catch (err: any) {
            alert(err.message || 'Erro ao enviar imagem.');
          }
        } else {
          setMediaList((prev) => [
            ...prev,
            {
              url: resultUrl,
              isPrimary: prev.length === 0,
              sortOrder: prev.length,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleSetPrimaryMedia = async (index: number) => {
    const item = mediaList[index];
    if (isEditing && productId && item.id) {
      try {
        await fetchApi(`/products/${productId}/media/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isPrimary: true, sortOrder: 0 }),
        });
      } catch (err: any) {
        alert(err.message || 'Erro ao definir imagem principal');
        return;
      }
    }
    // Reorder so that selected primary is index 0
    const selected = mediaList[index];
    const rest = mediaList.filter((_, i) => i !== index);
    const updated = [
      { ...selected, isPrimary: true, sortOrder: 0 },
      ...rest.map((m, idx) => ({ ...m, isPrimary: false, sortOrder: idx + 1 })),
    ];
    setMediaList(updated);
  };

  const handleRemoveMedia = async (index: number) => {
    const item = mediaList[index];
    if (isEditing && productId && item.id) {
      try {
        await fetchApi(`/products/${productId}/media/${item.id}`, { method: 'DELETE' });
      } catch (err: any) {
        alert(err.message || 'Erro ao remover imagem');
        return;
      }
    }
    const updated = mediaList.filter((_, i) => i !== index);
    setMediaList(updated);
  };

  const handleAddVariant = async () => {
    if (!newVariantSku.trim()) return;

    if (isEditing && productId) {
      try {
        const createdVariant = await fetchApi<ProductVariant>(`/products/${productId}/variants`, {
          method: 'POST',
          body: JSON.stringify({
            sku: newVariantSku.trim(),
            name: newVariantName.trim() || undefined,
            isActive: true,
          }),
        });
        setVariantsList([...variantsList, createdVariant]);
        setNewVariantSku('');
        setNewVariantName('');
        setNewVariantPrice('');
      } catch (err: any) {
        alert(err.message || 'Erro ao criar variante');
      }
    } else {
      alert('Salve o produto primeiro para cadastrar variantes formalmente.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    const payload = {
      name,
      slug: generatedSlug,
      sku: sku || undefined,
      brand: brand || undefined,
      status,
      shortDescription: shortDescription || undefined,
      description: description || undefined,
      basePrice: basePrice ? Number(basePrice) : undefined,
    };

    try {
      let savedProdId = productId;
      if (isEditing && productId) {
        await fetchApi(`/products/${productId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        const created = await fetchApi<Product>('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedProdId = created.id;
      }

      // Sync relationships
      if (savedProdId) {
        await Promise.all([
          selectedNicheIds.length > 0
            ? fetchApi(`/products/${savedProdId}/niches`, {
                method: 'POST',
                body: JSON.stringify({ nicheIds: selectedNicheIds }),
              })
            : Promise.resolve(),
          selectedCategoryIds.length > 0
            ? fetchApi(`/products/${savedProdId}/categories`, {
                method: 'POST',
                body: JSON.stringify({ categoryIds: selectedCategoryIds }),
              })
            : Promise.resolve(),
          selectedTagIds.length > 0
            ? fetchApi(`/products/${savedProdId}/tags`, {
                method: 'POST',
                body: JSON.stringify({ tagIds: selectedTagIds }),
              })
            : Promise.resolve(),
        ]);

        // If creating new, add media
        if (!isEditing && mediaList.length > 0) {
          for (let i = 0; i < mediaList.length; i++) {
            const item = mediaList[i];
            if (item.url.startsWith('data:')) {
              await fetchApi(`/products/${savedProdId}/media/upload`, {
                method: 'POST',
                body: JSON.stringify({
                  fileBase64: item.url,
                  isPrimary: i === 0,
                }),
              }).catch(() => null);
            } else {
              await fetchApi(`/products/${savedProdId}/media`, {
                method: 'POST',
                body: JSON.stringify({
                  url: item.url,
                  type: 'IMAGE',
                  isPrimary: i === 0,
                  sortOrder: i,
                }),
              }).catch(() => null);
            }
          }
        }
      }

      setSuccess('Produto salvo com sucesso!');
      setTimeout(() => {
        onNavigate('/admin/products');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-16 text-center text-xs text-slate-400">Carregando dados do produto...</div>;
  }

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/admin/products')}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {isEditing ? `Editar Produto: ${name}` : 'Cadastrar Novo Produto'}
            </h1>
            <p className="text-xs text-slate-500">Definições centrais, precificação e taxonomia</p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Produto'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* IDENTIFICAÇÃO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Identificação</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Produto *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Porta-Chaves Gatinho 3D"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU (Código Interno)</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex: FEL-GAT-001"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Slug (URL)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: porta-chaves-gatinho-3d"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="EuSou"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Preço Base (R$) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="39.90"
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-900"
                />
                <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">R$</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status do Produto</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
              >
                <option value="ACTIVE">Ativo (visível na loja e canais)</option>
                <option value="DRAFT">Rascunho</option>
                <option value="INACTIVE">Inativo</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>
            </div>
          </div>
        </div>

        {/* DESCRIÇÃO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Descrições</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição Curta (chamada rápida)</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Ex: Porta-chaves decorativo com acabamento suave."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição Completa</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes de material, processo produtivo e orientações..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* ORGANIZAÇÃO (NICHOS, CATEGORIAS, TAGS) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">3. Organização & Taxonomia</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Categorias */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-amber-500" /> Categorias
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-200 text-xs">
                {allCategories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCategoryIds([...selectedCategoryIds, c.id]);
                        else setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== c.id));
                      }}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nichos */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-500" /> Nichos
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-200 text-xs">
                {allNiches.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNicheIds.includes(n.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedNicheIds([...selectedNicheIds, n.id]);
                        else setSelectedNicheIds(selectedNicheIds.filter((id) => id !== n.id));
                      }}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span className="truncate">{n.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5 text-amber-500" /> Tags
              </label>
              <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-200 text-xs mb-2">
                {allTags.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic block p-1">Nenhuma tag cadastrada ainda. Crie uma abaixo:</span>
                ) : (
                  allTags.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTagIds([...selectedTagIds, t.id]);
                          else setSelectedTagIds(selectedTagIds.filter((id) => id !== t.id));
                        }}
                        className="rounded border-slate-300 text-slate-900"
                      />
                      <span className="truncate">{t.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Cole tags separadas por vírgula (ex: gato, chaveiro, resina)..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateQuickTag();
                    }
                  }}
                  className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={handleCreateQuickTag}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MÍDIA / FOTOS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">4. Galeria de Imagens</h2>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={newMediaUrl}
              onChange={(e) => setNewMediaUrl(e.target.value)}
              placeholder="Cole a URL pública da imagem (ex: https://...)"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
            />
            <button
              type="button"
              onClick={handleAddMedia}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar por Link
            </button>
            <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Enviar do Computador</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 pt-2">
            {mediaList.map((m, i) => (
              <div key={i} className="group relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                <img
                  src={m.url}
                  alt={`Mídia ${i}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Visual fallback for broken external links
                    (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                  }}
                />
                {i === 0 ? (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black shadow-xs flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-current" /> Principal
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryMedia(i)}
                    title="Definir como Principal"
                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition hover:bg-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Star className="w-2.5 h-2.5" /> Tornar Capa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(i)}
                  title="Excluir Imagem"
                  className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition hover:bg-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* VARIANTES */}
        {isEditing && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">5. Variantes de Produto</h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newVariantSku}
                onChange={(e) => setNewVariantSku(e.target.value)}
                placeholder="SKU da Variante (ex: FEL-GAT-AZUL)"
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900"
              />
              <input
                type="text"
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                placeholder="Nome / Rótulo (ex: Azul Pastel)"
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
              />
              <input
                type="number"
                step="0.01"
                value={newVariantPrice}
                onChange={(e) => setNewVariantPrice(e.target.value)}
                placeholder="Preço diferenciado (opcional)"
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
              />
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Criar Variante
              </button>
            </div>

            {variantsList.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden mt-4 text-xs">
                {variantsList.map((v) => (
                  <div key={v.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <span className="font-mono font-bold text-slate-800 mr-2">{v.sku}</span>
                      <span className="text-slate-600">{v.name || 'Sem rótulo'}</span>
                    </div>
                    <div className="font-semibold text-slate-900">
                      {v.price ? `R$ ${Number(v.price).toFixed(2).replace('.', ',')}` : 'Preço Base'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
