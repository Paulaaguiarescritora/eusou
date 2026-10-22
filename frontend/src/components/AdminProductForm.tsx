import { renderFormattedDescription } from '../formatDescription';
import React, { useEffect, useState } from 'react';
import {
  Product,
  Niche,
  Category,
  Tag,
  AttributeDefinition,
  ProductVariant,
  ProductChannelItem,
} from '../types';
import { fetchApi, resolveMediaUrl } from '../api';
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
  Tag as TagIcon,
  FolderTree,
  Globe,
  PauseCircle,
  Archive,
  Info,
  DollarSign,
  Edit2,
  X,
  Bold,
  Italic,
  List,
  Heading2,
  Eye,
} from 'lucide-react';

interface PricingSummaryData {
  productId: string;
  cost: number | null;
  commercialCost?: number | null;
  productionCost?: number | null;
  manualCost?: number | null;
  wholesalePrice?: number | null;
  retailPrice?: number | null;
  selectedCostSource?: 'COST_FROM_F7' | 'MANUAL';
  costSource: string;
  hasValidCost: boolean;
  hasValidWholesalePrice?: boolean;
  statusLabel: string;
  ownStorePrice: number | null;
  channelPrices: Array<{
    channelId: string;
    channelName: string;
    channelType: string;
    isEnabled: boolean;
    effectivePrice: number | null;
    mode: string;
    status: string;
  }>;
}

interface AdminProductFormProps {
  productId?: string;
  onNavigate: (route: string) => void;
}

export const AdminProductForm: React.FC<AdminProductFormProps> = ({
  productId,
  onNavigate,
}) => {
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
  const [status, setStatus] = useState<
    'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  >('ACTIVE');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [showDescPreview, setShowDescPreview] = useState(false);

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('product-description-textarea') as HTMLTextAreaElement | null;
    if (!textarea) {
      setDescription((prev) => `${prev}${prefix}${suffix}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = description.substring(start, end);
    const replacement = `${prefix}${selectedText || 'texto'}${suffix}`;
    const newText = description.substring(0, start) + replacement + description.substring(end);
    setDescription(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText ? selectedText.length : 5),
      );
    }, 50);
  };
  const [basePrice, setBasePrice] = useState('');
  const [costSource, setCostSource] = useState<'COST_FROM_F7' | 'MANUAL'>('MANUAL');
  const [manualCost, setManualCost] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [pricingSummary, setPricingSummary] = useState<PricingSummaryData | null>(null);

  // Hierarquia Comercial em Cascata (Nicho -> Categoria -> Subcategoria)
  const [selectedNicheId, setSelectedNicheId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Canais Comerciais Disponíveis
  const [productChannels, setProductChannels] = useState<ProductChannelItem[]>([]);

  // Media
  const [mediaList, setMediaList] = useState<
    { id?: string; url: string; isPrimary: boolean; sortOrder: number }[]
  >([]);
  const [newMediaUrl, setNewMediaUrl] = useState('');

  // Variants
  const [variantsList, setVariantsList] = useState<ProductVariant[]>([]);
  const [newVariantSku, setNewVariantSku] = useState('');
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');

  // Variant Edit & Archive State
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editVariantSku, setEditVariantSku] = useState('');
  const [editVariantName, setEditVariantName] = useState('');
  const [editVariantStock, setEditVariantStock] = useState('0');
  const [allMaterials, setAllMaterials] = useState<any[]>([]);
  const [editVariantMaterialId, setEditVariantMaterialId] = useState<string>('');
  const [isSavingVariantEdit, setIsSavingVariantEdit] = useState(false);
  const [variantEditError, setVariantEditError] = useState<string | null>(null);

  const [archivingVariant, setArchivingVariant] = useState<ProductVariant | null>(null);
  const [isArchivingVariant, setIsArchivingVariant] = useState(false);

  // Initial stock for base product (when no variants)
  const [initialStock, setInitialStock] = useState('');

  // Quick tag
  const [newTagInput, setNewTagInput] = useState('');

  // Archive Modal State
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // --- MODAIS DE CRIAÇÃO INLINE DE TAXONOMIA ---
  const [showNicheModal, setShowNicheModal] = useState(false);
  const [nicheModalName, setNicheModalName] = useState('');
  const [nicheModalSlug, setNicheModalSlug] = useState('');
  const [nicheModalLoading, setNicheModalLoading] = useState(false);
  const [nicheModalError, setNicheModalError] = useState<string | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalName, setCategoryModalName] = useState('');
  const [categoryModalSlug, setCategoryModalSlug] = useState('');
  const [categoryModalLoading, setCategoryModalLoading] = useState(false);
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);

  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [subcategoryModalName, setSubcategoryModalName] = useState('');
  const [subcategoryModalSlug, setSubcategoryModalSlug] = useState('');
  const [subcategoryModalLoading, setSubcategoryModalLoading] = useState(false);
  const [subcategoryModalError, setSubcategoryModalError] = useState<string | null>(null);

  const toSlug = (text: string) => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // --- HIERARQUIA COMERCIAL FILTERS ---
  // Categorias pai pertencentes exclusivamente ao Nicho selecionado
  const availableCategories = allCategories.filter(
    (c) => c.nicheId === selectedNicheId && !c.parentId
  );

  // Subcategorias filhas pertencentes exclusivamente à Categoria selecionada
  const availableSubcategories = allCategories.filter(
    (c) => c.parentId === selectedCategoryId
  );

  const handleNicheChange = (newNicheId: string) => {
    setSelectedNicheId(newNicheId);
    // Ao trocar o nicho, invalida/limpa imediatamente categorias e subcategorias incompatíveis
    setSelectedCategoryId('');
    setSelectedSubcategoryId('');
  };

  const handleCategoryChange = (newCatId: string) => {
    setSelectedCategoryId(newCatId);
    // Ao trocar a categoria, invalida/limpa a subcategoria filha anterior
    setSelectedSubcategoryId('');
  };

  // Handlers para Abertura dos Modais
  const openNewNicheModal = () => {
    setNicheModalName('');
    setNicheModalSlug('');
    setNicheModalError(null);
    setShowNicheModal(true);
  };

  const openNewCategoryModal = () => {
    if (!selectedNicheId) {
      alert('Selecione primeiro o Nicho para criar uma Categoria.');
      return;
    }
    setCategoryModalName('');
    setCategoryModalSlug('');
    setCategoryModalError(null);
    setShowCategoryModal(true);
  };

  const openNewSubcategoryModal = () => {
    if (!selectedCategoryId) {
      alert('Selecione primeiro a Categoria para criar uma Subcategoria.');
      return;
    }
    setSubcategoryModalName('');
    setSubcategoryModalSlug('');
    setSubcategoryModalError(null);
    setShowSubcategoryModal(true);
  };

  // Detecção de Duplicidade em Tempo Real
  const existingNicheMatch = nicheModalName.trim()
    ? allNiches.find(
        (n) => n.name.trim().toLowerCase() === nicheModalName.trim().toLowerCase()
      )
    : null;

  const existingCategoryMatch = categoryModalName.trim()
    ? availableCategories.find(
        (c) => c.name.trim().toLowerCase() === categoryModalName.trim().toLowerCase()
      )
    : null;

  const existingSubcategoryMatch = subcategoryModalName.trim()
    ? availableSubcategories.find(
        (sc) => sc.name.trim().toLowerCase() === subcategoryModalName.trim().toLowerCase()
      )
    : null;

  // Criação de Nicho
  const handleCreateNiche = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicheModalName.trim()) return;
    if (existingNicheMatch) {
      handleNicheChange(existingNicheMatch.id);
      setShowNicheModal(false);
      return;
    }
    setNicheModalLoading(true);
    setNicheModalError(null);
    try {
      const created = await fetchApi<Niche>('/niches', {
        method: 'POST',
        body: JSON.stringify({
          name: nicheModalName.trim(),
          slug: nicheModalSlug.trim() || toSlug(nicheModalName),
        }),
      });
      setAllNiches((prev) => [...prev, created]);
      handleNicheChange(created.id);
      setShowNicheModal(false);
    } catch (err: any) {
      setNicheModalError(err.message || 'Erro ao criar nicho');
    } finally {
      setNicheModalLoading(false);
    }
  };

  // Criação de Categoria
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryModalName.trim()) return;
    if (existingCategoryMatch) {
      handleCategoryChange(existingCategoryMatch.id);
      setShowCategoryModal(false);
      return;
    }
    setCategoryModalLoading(true);
    setCategoryModalError(null);
    try {
      const created = await fetchApi<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryModalName.trim(),
          slug: categoryModalSlug.trim() || toSlug(categoryModalName),
          nicheId: selectedNicheId,
          parentId: null,
        }),
      });
      setAllCategories((prev) => [...prev, created]);
      handleCategoryChange(created.id);
      setShowCategoryModal(false);
    } catch (err: any) {
      setCategoryModalError(err.message || 'Erro ao criar categoria');
    } finally {
      setCategoryModalLoading(false);
    }
  };

  // Criação de Subcategoria
  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcategoryModalName.trim()) return;
    if (existingSubcategoryMatch) {
      setSelectedSubcategoryId(existingSubcategoryMatch.id);
      setShowSubcategoryModal(false);
      return;
    }
    setSubcategoryModalLoading(true);
    setSubcategoryModalError(null);
    try {
      const created = await fetchApi<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: subcategoryModalName.trim(),
          slug: subcategoryModalSlug.trim() || toSlug(subcategoryModalName),
          nicheId: selectedNicheId,
          parentId: selectedCategoryId,
        }),
      });
      setAllCategories((prev) => [...prev, created]);
      setSelectedSubcategoryId(created.id);
      setShowSubcategoryModal(false);
    } catch (err: any) {
      setSubcategoryModalError(err.message || 'Erro ao criar subcategoria');
    } finally {
      setSubcategoryModalLoading(false);
    }
  };

  // --- CANAIS COMERCIAIS HELPERS ---
  const handleToggleChannelAssignment = (channelId: string) => {
    if (status === 'ARCHIVED') return;
    setProductChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId
          ? {
              ...ch,
              isAssigned: !ch.isAssigned,
              isEnabled: !ch.isAssigned ? true : ch.isEnabled,
            }
          : ch
      )
    );
  };

  const handleToggleChannelEnabled = (channelId: string) => {
    if (status === 'ARCHIVED') return;
    setProductChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId
          ? {
              ...ch,
              isEnabled: !ch.isEnabled,
            }
          : ch
      )
    );
  };

  const handleSelectAllChannels = () => {
    if (status === 'ARCHIVED') return;
    setProductChannels((prev) =>
      prev.map((ch) => ({ ...ch, isAssigned: true, isEnabled: true }))
    );
  };

  const handleDeselectAllChannels = () => {
    if (status === 'ARCHIVED') return;
    setProductChannels((prev) =>
      prev.map((ch) => ({ ...ch, isAssigned: false, isEnabled: false }))
    );
  };

  // --- CÁLCULO DE COMPLETUDE DO DOSSIÊ COMERCIAL ---
  const dossier = (() => {
    const missing: string[] = [];
    let score = 0;
    const totalPoints = 7;

    // 1. Identificação básica
    if (name.trim().length >= 3) score += 1;
    else missing.push('Nome do produto');

    // 2. SKU
    if (sku.trim().length >= 3) score += 1;
    else missing.push('SKU (Código único)');

    // 3. Descrição comercial
    if (
      (description && description.trim().length > 10) ||
      (shortDescription && shortDescription.trim().length > 5)
    ) {
      score += 1;
    } else {
      missing.push('Descrição comercial');
    }

    // 4. Preço comercial base (Atacado ou Base)
    const hasPrice =
      (wholesalePrice !== null && wholesalePrice !== '' && Number(wholesalePrice.replace(',', '.')) > 0) ||
      (basePrice !== null && basePrice !== '' && Number(basePrice.replace(',', '.')) > 0);
    if (hasPrice) score += 1;
    else missing.push('Preço base / atacado');

    // 5. Fotos / Mídias
    if (mediaList.length > 0) score += 1;
    else missing.push('Fotos/Mídias');

    // 6. Categoria
    if (selectedCategoryId) score += 1;
    else missing.push('Categoria');

    // 7. Nicho
    if (selectedNicheId) score += 1;
    else missing.push('Nicho');

    const percentage = Math.round((score / totalPoints) * 100);
    return {
      percentage,
      isReady: percentage >= 80,
      missingFields: missing,
    };
  })();

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
                slug:
                  cleanSlug ||
                  `tag-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      setSelectedTagIds((prev) =>
        Array.from(new Set([...prev, ...createdIds]))
      );
      setNewTagInput('');
    } catch (err: any) {
      alert(err.message || 'Erro ao processar tags');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [nichesRes, catsRes, tagsRes, attrsRes, materialsRes] = await Promise.all([
        fetchApi<{ data: Niche[] }>('/niches?limit=1000').catch(() => ({ data: [] })),
        fetchApi<{ data: Category[] }>('/categories?limit=1000').catch(() => ({
          data: [],
        })),
        fetchApi<{ data: Tag[] }>('/tags').catch(() => ({ data: [] })),
        fetchApi<{ data: AttributeDefinition[] }>('/attributes').catch(() => ({
          data: [],
        })),
        fetchApi<any>('/admin/materials?activeOnly=true').catch(() => []),
      ]);

      const loadedNiches = nichesRes.data || [];
      const loadedCats = catsRes.data || [];
      setAllNiches(loadedNiches);
      setAllCategories(loadedCats);
      setAllTags(tagsRes.data || []);
      setAllAttributes(attrsRes.data || []);
      const matList = Array.isArray(materialsRes) ? materialsRes : materialsRes?.data || [];
      setAllMaterials(matList);

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
        setCostSource(prod.costSource || 'MANUAL');
        setManualCost(prod.manualCost !== undefined && prod.manualCost !== null ? String(prod.manualCost) : '');
        setWholesalePrice(prod.wholesalePrice !== undefined && prod.wholesalePrice !== null ? String(prod.wholesalePrice) : '');

        fetchApi<PricingSummaryData>(`/products/${productId}/pricing-summary`)
          .then((summary) => setPricingSummary(summary))
          .catch(() => setPricingSummary(null));

        // Relational binds com resolução de hierarquia em cascata
        let foundNicheId = '';
        if (prod.niches && prod.niches.length > 0) {
          foundNicheId = prod.niches[0].niche.id;
        }

        let foundCatId = '';
        let foundSubcatId = '';
        if (prod.categories && prod.categories.length > 0) {
          for (const item of prod.categories) {
            const cat = loadedCats.find((c: Category) => c.id === item.category.id);
            if (cat) {
              if (cat.parentId) {
                foundSubcatId = cat.id;
                foundCatId = cat.parentId;
                if (!foundNicheId && cat.nicheId) foundNicheId = cat.nicheId;
              } else {
                if (!foundCatId) foundCatId = cat.id;
                if (!foundNicheId && cat.nicheId) foundNicheId = cat.nicheId;
              }
            }
          }
        }

        setSelectedNicheId(foundNicheId);
        setSelectedCategoryId(foundCatId);
        setSelectedSubcategoryId(foundSubcatId);

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
        if (prod.variants && prod.variants.length > 0) {
          setVariantsList(prod.variants);
        } else {
          setVariantsList([]);
          const currentBaseStock =
            (prod as any).availableStock !== undefined
              ? (prod as any).availableStock
              : (prod as any).stock !== undefined
                ? (prod as any).stock
                : 0;
          setInitialStock(String(currentBaseStock));
        }

        // Carregar canais comerciais vinculados ao produto
        try {
          const chanRes = await fetchApi<any>(`/products/${productId}/channels`);
          if (chanRes && Array.isArray(chanRes.channels)) {
            const mapped = chanRes.channels.map((ch: any) =>
              ch.type === 'OWN_STORE'
                ? { ...ch, isAssigned: true, isEnabled: true }
                : ch
            );
            setProductChannels(mapped);
          }
        } catch (e) {
          console.warn('Erro ao carregar canais do produto:', e);
        }
      } else {
        // Modo criação: carregar lista de todos os canais cadastrados no sistema
        try {
          const allChans = await fetchApi<any>('/marketplace/channels');
          const chanList = Array.isArray(allChans) ? allChans : allChans?.data || [];
          setProductChannels(
            chanList.map((ch: any) => ({
              id: ch.id,
              name: ch.name,
              type: ch.type,
              channelIsActive: ch.isActive,
              isAssigned: ch.type === 'OWN_STORE' ? true : false,
              isEnabled: ch.type === 'OWN_STORE' ? true : false,
              assignedAt: null,
            }))
          );
        } catch (e) {
          console.warn('Erro ao carregar canais disponíveis:', e);
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
        const createdMedia = await fetchApi<any>(
          `/products/${productId}/media`,
          {
            method: 'POST',
            body: JSON.stringify({
              url: newMediaUrl.trim(),
              type: 'IMAGE',
              isPrimary: mediaList.length === 0,
              sortOrder: mediaList.length,
            }),
          }
        );
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
            const createdMedia = await fetchApi<any>(
              `/products/${productId}/media/upload`,
              {
                method: 'POST',
                body: JSON.stringify({
                  fileBase64: resultUrl,
                  originalName: file.name,
                  isPrimary: mediaList.length === 0,
                }),
              }
            );
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
        await fetchApi(`/products/${productId}/media/${item.id}`, {
          method: 'DELETE',
        });
      } catch (err: any) {
        alert(err.message || 'Erro ao remover imagem');
        return;
      }
    }
    const updated = mediaList.filter((_, i) => i !== index);
    setMediaList(updated);
  };

  const handleAddVariant = async () => {
    if (!newVariantSku.trim()) {
      alert('Informe o SKU da variante.');
      return;
    }

    const initialStockNum = newVariantStock !== '' ? Number(newVariantStock) : 0;
    const payload = {
      sku: newVariantSku.trim(),
      name: newVariantName.trim() || undefined,
      initialStock: isNaN(initialStockNum) ? 0 : Math.max(0, initialStockNum),
    };

    if (isEditing && productId) {
      try {
        const created = await fetchApi<ProductVariant>(
          `/products/${productId}/variants`,
          {
            method: 'POST',
            body: JSON.stringify({
              sku: payload.sku,
              name: payload.name,
              stock: payload.initialStock,
              isActive: true,
            }),
          }
        );

        if (payload.initialStock > 0) {
          await fetchApi('/admin/inventory/adjust', {
            method: 'POST',
            body: JSON.stringify({
              productId,
              variantId: created.id,
              quantity: payload.initialStock,
              mode: 'SET',
              reason: `Estoque inicial na criação da variante: ${created.sku}`,
            }),
          }).catch((err) =>
            console.warn('Falha ao definir estoque inicial da variante via adjust:', err)
          );
        }

        const enrichedCreated: ProductVariant = {
          ...created,
          stock: created.stock !== undefined ? created.stock : payload.initialStock,
          availableStock:
            created.availableStock !== undefined
              ? created.availableStock
              : payload.initialStock,
          initialStock: payload.initialStock,
        };

        setVariantsList([...variantsList, enrichedCreated]);
        setNewVariantSku('');
        setNewVariantName('');
        setNewVariantStock('');
      } catch (err: any) {
        alert(err.message || 'Erro ao cadastrar variante.');
      }
    } else {
      setVariantsList([
        ...variantsList,
        {
          id: `temp-${Date.now()}`,
          sku: payload.sku,
          name: payload.name,
          isActive: true,
          initialStock: payload.initialStock,
          stock: payload.initialStock,
          availableStock: payload.initialStock,
        } as any,
      ]);
      setNewVariantSku('');
      setNewVariantName('');
      setNewVariantStock('');
    }
  };

  // --- EDIÇÃO E ARQUIVAMENTO DE VARIANTES ---
  const handleStartEditVariant = (v: ProductVariant) => {
    setEditingVariant(v);
    setEditVariantSku(v.sku || '');
    setEditVariantName(v.name || '');
    const inv = (v as any).inventories?.find((i: any) => i.variantId === v.id) || (v as any).inventories?.[0];
    const invStock = inv ? Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)) : undefined;
    const currentStock =
      v.availableStock !== undefined
        ? v.availableStock
        : invStock !== undefined
        ? invStock
        : v.stock !== undefined
        ? v.stock
        : (v as any).initialStock !== undefined
        ? (v as any).initialStock
        : 0;
    setEditVariantStock(String(currentStock));
    setEditVariantMaterialId(v.isMaterialCustom && v.materialId ? v.materialId : '');
    setVariantEditError(null);
  };

  const handleSaveVariantEdit = async () => {
    if (!editingVariant) return;

    const trimmedSku = editVariantSku.trim();
    const trimmedName = editVariantName.trim();

    if (!trimmedSku) {
      setVariantEditError('O SKU da variante não pode ser vazio.');
      return;
    }

    if (!trimmedName) {
      setVariantEditError('O Nome/Rótulo da variante não pode ser vazio.');
      return;
    }

    // Validação de duplicidade local
    const duplicate = variantsList.find(
      (v) =>
        v.id !== editingVariant.id &&
        v.sku?.toLowerCase() === trimmedSku.toLowerCase()
    );
    if (duplicate) {
      setVariantEditError(`Já existe outra variante com o SKU "${trimmedSku}".`);
      return;
    }

    let parsedStock = 0;
    if (editVariantStock.trim()) {
      const stockNum = parseInt(editVariantStock, 10);
      if (isNaN(stockNum) || stockNum < 0) {
        setVariantEditError('O estoque da variante deve ser um número inteiro maior ou igual a zero.');
        return;
      }
      parsedStock = stockNum;
    }

    setIsSavingVariantEdit(true);
    setVariantEditError(null);

    try {
      if (isEditing && productId && !editingVariant.id.startsWith('temp-')) {
        const updated = await fetchApi<ProductVariant>(
          `/products/${productId}/variants/${editingVariant.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              sku: trimmedSku,
              name: trimmedName,
              stock: parsedStock,
              materialId: editVariantMaterialId ? editVariantMaterialId : null,
            }),
          }
        );

        setVariantsList((prev) =>
          prev.map((item) =>
            item.id === editingVariant.id
              ? {
                  ...item,
                  ...updated,
                  stock: parsedStock,
                  availableStock: parsedStock,
                }
              : item
          )
        );
      } else {
        // Variante staged (antes de salvar o produto)
        const selectedMat = allMaterials.find((m) => m.id === editVariantMaterialId);
        setVariantsList((prev) =>
          prev.map((item) =>
            item.id === editingVariant.id
              ? {
                  ...item,
                  sku: trimmedSku,
                  name: trimmedName,
                  stock: parsedStock,
                  availableStock: parsedStock,
                  initialStock: parsedStock,
                  materialId: editVariantMaterialId || null,
                  materialName: selectedMat?.name || item.materialName,
                  materialCostPerUnit: selectedMat?.costPerUnit || item.materialCostPerUnit,
                  isMaterialCustom: Boolean(editVariantMaterialId),
                }
              : item
          )
        );
      }
      setEditingVariant(null);
    } catch (err: any) {
      setVariantEditError(
        err.message || 'Erro ao salvar alterações da variante.'
      );
    } finally {
      setIsSavingVariantEdit(false);
    }
  };

  const handleStartArchiveVariant = (v: ProductVariant) => {
    setArchivingVariant(v);
  };

  const handleConfirmArchiveVariant = async () => {
    if (!archivingVariant) return;

    setIsArchivingVariant(true);
    try {
      if (isEditing && productId && !archivingVariant.id.startsWith('temp-')) {
        await fetchApi(
          `/products/${productId}/variants/${archivingVariant.id}`,
          {
            method: 'DELETE',
          }
        );

        // Inativa localmente preservando os dados no histórico
        setVariantsList((prev) =>
          prev.map((item) =>
            item.id === archivingVariant.id
              ? { ...item, isActive: false }
              : item
          )
        );
      } else {
        // Variante staged não salva no banco: remove diretamente
        setVariantsList((prev) =>
          prev.filter((item) => item.id !== archivingVariant.id)
        );
      }
      setArchivingVariant(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao arquivar variante.');
    } finally {
      setIsArchivingVariant(false);
    }
  };

  // --- ARQUIVAMENTO COM CONFIRMAÇÃO EXPLÍCITA ---
  const handleConfirmArchive = async () => {
    if (!isEditing || !productId) return;
    setArchiving(true);
    try {
      await fetchApi(`/products/${productId}`, {
        method: 'DELETE',
      });
      setStatus('ARCHIVED');
      // Revoga imediatamente a disponibilidade de todos os canais na interface
      setProductChannels((prev) =>
        prev.map((ch) => ({ ...ch, isAssigned: false, isEnabled: false }))
      );
      setShowArchiveModal(false);
      setSuccess(
        'Produto arquivado com sucesso. Sua presença em todos os canais de venda comerciais foi revogada.'
      );
    } catch (err: any) {
      alert(err.message || 'Erro ao arquivar produto.');
    } finally {
      setArchiving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const parsedManualCost =
      costSource === 'MANUAL' && manualCost && manualCost.trim().length > 0
        ? Number(manualCost.replace(',', '.'))
        : null;

    if (costSource === 'MANUAL' && (!parsedManualCost || parsedManualCost <= 0)) {
      setError('Por favor, informe um custo de produção manual válido maior que zero.');
      setSaving(false);
      return;
    }

    const parsedWholesalePrice =
      wholesalePrice && wholesalePrice.trim().length > 0
        ? Number(wholesalePrice.replace(',', '.'))
        : null;

    if (wholesalePrice && wholesalePrice.trim().length > 0 && (!parsedWholesalePrice || parsedWholesalePrice <= 0)) {
      setError('Por favor, informe um preço de atacado válido maior que zero.');
      setSaving(false);
      return;
    }

    const payload: any = {
      name: name.trim(),
      slug: slug || undefined,
      sku: sku || undefined,
      brand: brand || undefined,
      status,
      shortDescription: shortDescription || undefined,
      description: description || undefined,
      basePrice: basePrice ? Number(basePrice) : undefined,
      costSource,
      manualCost: parsedManualCost,
      wholesalePrice: parsedWholesalePrice,
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

      if (savedProdId) {
        // Sincronizar taxonomia e nichos
        const finalNicheIds = selectedNicheId ? [selectedNicheId] : [];
        const finalCategoryIds = [
          selectedCategoryId,
          selectedSubcategoryId,
        ].filter(Boolean) as string[];

        await Promise.all([
          finalNicheIds.length > 0
            ? fetchApi(`/products/${savedProdId}/niches`, {
                method: 'POST',
                body: JSON.stringify({ nicheIds: finalNicheIds }),
              })
            : Promise.resolve(),
          finalCategoryIds.length > 0
            ? fetchApi(`/products/${savedProdId}/categories`, {
                method: 'POST',
                body: JSON.stringify({ categoryIds: finalCategoryIds }),
              })
            : Promise.resolve(),
          selectedTagIds.length > 0
            ? fetchApi(`/products/${savedProdId}/tags`, {
                method: 'POST',
                body: JSON.stringify({ tagIds: selectedTagIds }),
              })
            : Promise.resolve(),
        ]);

        // Sincronizar Mídias staged no modo criação
        if (!isEditing && mediaList.length > 0) {
          for (const m of mediaList) {
            try {
              if (m.url.startsWith('data:')) {
                await fetchApi(`/products/${savedProdId}/media/upload`, {
                  method: 'POST',
                  body: JSON.stringify({
                    fileBase64: m.url,
                    isPrimary: m.isPrimary,
                  }),
                });
              } else {
                await fetchApi(`/products/${savedProdId}/media`, {
                  method: 'POST',
                  body: JSON.stringify({
                    url: m.url,
                    type: 'IMAGE',
                    isPrimary: m.isPrimary,
                    sortOrder: m.sortOrder,
                  }),
                });
              }
            } catch (err) {
              console.warn('Erro ao salvar mídia staged:', err);
            }
          }
        }

        // Sincronizar Canais Comerciais Disponíveis
        if (status !== 'ARCHIVED') {
          const assignedChannels = productChannels
            .filter((ch) => ch.isAssigned || ch.type === 'OWN_STORE')
            .map((ch) => ({
              channelId: ch.id,
              isEnabled: ch.type === 'OWN_STORE' ? true : ch.isEnabled,
            }));

          await fetchApi(`/products/${savedProdId}/channels`, {
            method: 'POST',
            body: JSON.stringify({ channels: assignedChannels }),
          }).catch((err) =>
            console.warn('Erro ao sincronizar canais comerciais:', err)
          );
        }

        // Variantes staged no modo criação
        if (!isEditing && variantsList.length > 0) {
          for (const staged of variantsList) {
            try {
              const varStock = Number(
                (staged as any).initialStock !== undefined
                  ? (staged as any).initialStock
                  : (staged as any).stock !== undefined
                  ? (staged as any).stock
                  : 0
              );

              const createdVariant = await fetchApi<ProductVariant>(
                `/products/${savedProdId}/variants`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    sku: staged.sku,
                    name: staged.name || undefined,
                    price:
                      staged.price !== undefined
                        ? Number(staged.price)
                        : undefined,
                    stock: varStock,
                    isActive: true,
                  }),
                }
              );
              if (varStock > 0) {
                await fetchApi('/admin/inventory/adjust', {
                  method: 'POST',
                  body: JSON.stringify({
                    productId: savedProdId,
                    variantId: createdVariant.id,
                    quantity: varStock,
                    mode: 'SET',
                    reason: `Estoque inicial no cadastro: variante ${createdVariant.sku}`,
                  }),
                }).catch((err) =>
                  console.warn('Erro ao criar estoque da variante:', err)
                );
              }
            } catch (err) {
              console.error('Falha ao persistir variante staged:', err);
            }
          }
        }

        // Estoque base para produto sem variantes
        if (variantsList.length === 0 && initialStock !== '') {
          const baseStockQty = Number(initialStock);
          if (!isNaN(baseStockQty) && baseStockQty >= 0) {
            try {
              await fetchApi('/admin/inventory/adjust', {
                method: 'POST',
                body: JSON.stringify({
                  productId: savedProdId,
                  quantity: baseStockQty,
                  mode: 'SET',
                  reason: isEditing
                    ? 'Ajuste de estoque físico no formulário de produto'
                    : 'Estoque físico inicial registrado no cadastro do produto',
                }),
              });
            } catch (err) {
              console.warn('Erro ao definir estoque físico base:', err);
            }
          }
        }

        setSuccess('Produto e canais comerciais salvos com sucesso!');
        if (!isEditing) {
          setTimeout(() => {
            onNavigate(`/admin/products/${savedProdId}`);
          }, 800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar o produto');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-400">
        Carregando dados do produto e canais comerciais...
      </div>
    );
  }

  const assignedChannelsCount = productChannels.filter((c) => c.isAssigned).length;

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/admin/products')}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {isEditing ? `Editar Produto: ${name}` : 'Cadastrar Novo Produto'}
              </h1>
              {status === 'ARCHIVED' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  Arquivado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Produto central único com disponibilidade seletiva por canal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && status !== 'ARCHIVED' && (
            <button
              type="button"
              onClick={() => setShowArchiveModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" /> Arquivar Produto
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* AVISO DE PRODUTO ARQUIVADO */}
      {status === 'ARCHIVED' && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
          <Archive className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">
              Este produto está Arquivado (Disponibilidade Comercial Revogada)
            </span>
            <p className="text-rose-700 leading-relaxed">
              O produto foi retirado de todos os canais comerciais. O histórico de pedidos, estoque físico e movimentações passadas está rigorosamente preservado. Para voltar a comercializá-lo em canais, altere o status para Ativo ou Rascunho.
            </p>
          </div>
        </div>
      )}

      {/* DOSSIÊ COMERCIAL */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Dossiê Comercial Central
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                dossier.isReady
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {dossier.isReady
                ? 'Pronto para comercialização'
                : 'Dossiê incompleto'}
            </span>
          </div>
          <span className="text-xs font-black text-slate-900">
            {dossier.percentage}% completo
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              dossier.isReady ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${dossier.percentage}%` }}
          />
        </div>

        {/* Missing fields alert */}
        {dossier.missingFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-600">Campos pendentes:</span>
            {dossier.missingFields.map((field, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold"
              >
                {field}
              </span>
            ))}
          </div>
        )}
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
        {/* 1. IDENTIFICAÇÃO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            1. Identificação do Produto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Produto *
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SKU (Código Interno) *
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex: FEL-GAT-001"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Slug (URL)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: porta-chaves-gatinho-3d"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Marca
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="EuSou"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          {/* PAINEL DE PRECIFICAÇÃO INTEGRADA: CUSTO DE PRODUÇÃO → PREÇO DE ATACADO → PREÇO DE VAREJO → PREÇOS POR CANAL */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-600" />
                Precificação F12
              </label>
              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
                Estrutura Comercial: Custo ≠ Atacado (Base) ≠ Varejo ≠ Marketplace
              </span>
            </div>

            {/* GRID PRINCIPAL: 1. CUSTO DE PRODUÇÃO E 2. PREÇO DE ATACADO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* BLOCO 1: CUSTO DE PRODUÇÃO */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    1. Custo de Produção
                  </span>
                  <span className="text-[9px] font-medium text-slate-400">
                    "Quanto custa produzir?"
                  </span>
                </div>

                {/* Rádios de Escolha da Origem */}
                <div className="flex flex-col sm:flex-row gap-2.5 text-xs">
                  <label className={`inline-flex items-center gap-2 cursor-pointer font-medium p-2.5 rounded-xl border transition flex-1 ${
                    costSource === 'COST_FROM_F7'
                      ? 'bg-white border-slate-900 text-slate-900 shadow-xs'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="costSourceRadio"
                      checked={costSource === 'COST_FROM_F7'}
                      onChange={() => setCostSource('COST_FROM_F7')}
                      className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-0 cursor-pointer"
                    />
                    <span>F7 — calcular pela ficha técnica</span>
                  </label>

                  <label className={`inline-flex items-center gap-2 cursor-pointer font-medium p-2.5 rounded-xl border transition flex-1 ${
                    costSource === 'MANUAL'
                      ? 'bg-white border-slate-900 text-slate-900 shadow-xs'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="costSourceRadio"
                      checked={costSource === 'MANUAL'}
                      onChange={() => setCostSource('MANUAL')}
                      className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Manual — informar diretamente</span>
                  </label>
                </div>

                {/* Exibição do Custo de Produção Conforme a Origem */}
                {costSource === 'COST_FROM_F7' ? (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                        Custo F7 Calculado
                      </span>
                      {pricingSummary?.productionCost && pricingSummary.productionCost > 0 ? (
                        <span className="text-base font-black text-slate-900">
                          R$ {pricingSummary.productionCost.toFixed(2).replace('.', ',')}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">
                          Aguardando ficha técnica F7
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                      Origem: F7
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] text-slate-700 uppercase font-bold block mb-1">
                          Custo de produção (R$) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="Ex: 1,30"
                            value={manualCost}
                            onChange={(e) => setManualCost(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm font-black text-slate-900 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                        Origem: Manual
                      </span>
                    </div>
                    {pricingSummary?.productionCost && pricingSummary.productionCost > 0 && (
                      <span className="text-[10px] text-slate-400 block">
                        Referência F7: R$ {pricingSummary.productionCost.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block">
                  {costSource === 'MANUAL'
                    ? 'Custo informado diretamente pela administradora. Ficha técnica F7 é opcional.'
                    : 'Custo apurado automaticamente a partir dos materiais e tempo de impressão da ficha F7.'}
                </span>
              </div>

              {/* BLOCO 2: PREÇO DE ATACADO (BASE COMERCIAL) */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                      2. Preço de Atacado (Base Comercial)
                    </span>
                    <span className="text-[9px] font-medium text-amber-700">
                      "Por quanto vendo para revenda?"
                    </span>
                  </div>

                  <label className="text-[10px] text-amber-800 uppercase font-bold block mb-1">
                    Preço de Atacado (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-semibold text-amber-600">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ex: 7,27"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-amber-300 bg-white rounded-lg text-base font-black text-slate-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500 shadow-sm"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                  <span className="font-semibold block">
                    Informado pela administradora.
                  </span>
                  <span className="text-[10px] text-amber-700 block">
                    Base comercial para formação de Varejo e Canais pelo motor F12.
                  </span>
                </div>
              </div>
            </div>

            {/* BLOCO 3: PREÇO DE VAREJO (LOJA PRÓPRIA) */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                      3. Preço de Varejo (Loja Própria)
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase font-semibold">
                      F12 Calculado
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700">
                    Regra: Atacado / (1 - Margem 50% - Imposto 4%) com final ,90
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  {(() => {
                    if (pricingSummary?.ownStorePrice && Number(pricingSummary.ownStorePrice) > 0) {
                      return (
                        <>
                          <span className="text-xs font-bold text-emerald-700">R$</span>
                          <span className="text-2xl font-black text-emerald-950">
                            {Number(pricingSummary.ownStorePrice).toFixed(2).replace('.', ',')}
                          </span>
                        </>
                      );
                    }
                    const numWholesale = wholesalePrice && Number(wholesalePrice.replace(',', '.')) > 0
                      ? Number(wholesalePrice.replace(',', '.'))
                      : null;
                    if (numWholesale) {
                      const rawRetail = numWholesale / 0.46;
                      const floorVal = Math.floor(rawRetail);
                      let cand = floorVal + 0.90;
                      if (cand < rawRetail) {
                        cand = floorVal + 1.90;
                      }
                      return (
                        <>
                          <span className="text-xs font-bold text-emerald-700">R$</span>
                          <span className="text-2xl font-black text-emerald-950">
                            {cand.toFixed(2).replace('.', ',')}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold ml-1">(estimado)</span>
                        </>
                      );
                    }
                    return (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold">
                        {costSource === 'MANUAL' && (!manualCost || Number(manualCost.replace(',', '.')) <= 0)
                          ? 'Aguardando custo de produção'
                          : pricingSummary?.statusLabel || 'Aguardando atacado'}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* BLOCO 4: PREÇOS POR CANAL COMERCIAL */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800 block">
                    4. Preços por Canal Comercial Habilitado
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Calculados a partir do Preço de Atacado com margem de marketplace e comissões
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {pricingSummary?.channelPrices?.filter((cp) => cp.isEnabled).length || 0} canais habilitados
                </span>
              </div>

              <div className="p-3.5">
                {pricingSummary?.channelPrices && pricingSummary.channelPrices.filter((cp) => cp.isEnabled).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {pricingSummary.channelPrices
                      .filter((cp) => cp.isEnabled)
                      .map((cp) => (
                        <div
                          key={cp.channelId}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {cp.channelName}
                            </span>
                            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-200/80 text-slate-600 uppercase">
                              {cp.channelType}
                            </span>
                          </div>
                          <div className="mt-2">
                            {cp.effectivePrice && Number(cp.effectivePrice) > 0 ? (
                              <div>
                                <span className="text-[10px] text-slate-400 block">Preço Final</span>
                                <span className="font-black text-base text-slate-900">
                                  R$ {Number(cp.effectivePrice).toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                {cp.status || 'Não calculado'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum canal comercial habilitado para este produto.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estoque Físico Inicial (Opcional)
              </label>
              <input
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-900"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {variantsList.length > 0
                  ? 'Sobrescrito por variantes se informado'
                  : 'Saldo físico único central compartilhado'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status Operacional
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
              >
                <option value="ACTIVE">Ativo (visível nos canais habilitados)</option>
                <option value="DRAFT">Rascunho</option>
                <option value="INACTIVE">Inativo</option>
                <option value="ARCHIVED">Arquivado (canais revogados)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. CANAIS COMERCIAIS DISPONÍVEIS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-500" /> 2. Canais Comerciais Disponíveis
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina em quais canais comerciais este produto estará à venda. A disponibilidade é imediata e independente de credenciais OAuth ou integrações técnicas.
              </p>
            </div>

            {status !== 'ARCHIVED' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllChannels}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllChannels}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {productChannels.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum canal comercial cadastrado no sistema.
              </div>
            ) : (
              productChannels.map((ch) => {
                const isAvailable = ch.isAssigned && ch.isEnabled;
                const isPaused = ch.isAssigned && !ch.isEnabled;

                return (
                  <div
                    key={ch.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      ch.isAssigned ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        disabled={status === 'ARCHIVED'}
                        checked={ch.isAssigned}
                        onChange={() => handleToggleChannelAssignment(ch.id)}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer disabled:opacity-50"
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {ch.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 uppercase">
                            {ch.type}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          {ch.isAssigned
                            ? 'Vinculado ao produto central'
                            : 'Não disponibilizado neste canal'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {/* Badge de Situação Visual */}
                      {!ch.isAssigned && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          Não disponível
                        </span>
                      )}
                      {isAvailable && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Disponível
                        </span>
                      )}
                      {isPaused && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <PauseCircle className="w-3 h-3 text-amber-600" /> Pausado
                        </span>
                      )}

                      {/* Ações de Canal */}
                      {ch.isAssigned && status !== 'ARCHIVED' && (
                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleToggleChannelEnabled(ch.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              ch.isEnabled
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {ch.isEnabled ? 'Pausar no canal' : 'Reativar no canal'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleChannelAssignment(ch.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            Retirar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              <strong>Nota Comercial:</strong> Retirar um canal remove a oferta apenas daquele canal. O produto continua existindo no cadastro central e ativo nos demais canais.
            </span>
          </div>
        </div>

        {/* 3. HIERARQUIA COMERCIAL & TAXONOMIA */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-amber-500" /> 3. Hierarquia Comercial
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estrutura progressiva vinculada: Nicho → Categoria → Subcategoria → Produto.
            </p>
          </div>

          {/* Breadcrumb visual da classificação comercial */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center gap-2 text-slate-600 font-medium">
            <span className="text-[10px] uppercase font-bold text-slate-400">Classificação:</span>
            <span className="font-bold text-slate-900">
              {allNiches.find((n) => n.id === selectedNicheId)?.name || '(Selecione o Nicho)'}
            </span>
            <span className="text-slate-300">→</span>
            <span className="font-bold text-slate-900">
              {availableCategories.find((c) => c.id === selectedCategoryId)?.name ||
                allCategories.find((c) => c.id === selectedCategoryId)?.name ||
                '(Selecione a Categoria)'}
            </span>
            <span className="text-slate-300">→</span>
            <span className="text-slate-700">
              {availableSubcategories.find((s) => s.id === selectedSubcategoryId)?.name ||
                'Nenhuma subcategoria'}
            </span>
            <span className="text-slate-300">→</span>
            <span className="font-semibold text-amber-700 truncate max-w-[200px]">
              {name || 'Produto Atual'}
            </span>
          </div>

          {/* Cascata Nicho -> Categoria -> Subcategoria */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Nicho */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  1. Nicho Comercial *
                </label>
                <button
                  type="button"
                  onClick={openNewNicheModal}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                  title="Criar novo nicho sem sair do cadastro"
                >
                  <Plus className="w-3 h-3" /> Novo
                </button>
              </div>
              <select
                value={selectedNicheId}
                onChange={(e) => handleNicheChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900 font-medium"
              >
                <option value="">-- Selecione o Nicho Comercial --</option>
                {allNiches.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Categoria */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  2. Categoria Principal *
                </label>
                <button
                  type="button"
                  disabled={!selectedNicheId}
                  onClick={openNewCategoryModal}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={selectedNicheId ? 'Criar nova categoria neste nicho' : 'Selecione primeiro o nicho'}
                >
                  <Plus className="w-3 h-3" /> Nova
                </button>
              </div>
              <select
                value={selectedCategoryId}
                disabled={!selectedNicheId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400 font-medium"
              >
                <option value="">
                  {selectedNicheId
                    ? availableCategories.length > 0
                      ? '-- Selecione a Categoria --'
                      : 'Nenhuma categoria para este nicho'
                    : 'Selecione primeiro o Nicho...'}
                </option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Subcategoria */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  3. Subcategoria (Especialização)
                </label>
                <button
                  type="button"
                  disabled={!selectedCategoryId}
                  onClick={openNewSubcategoryModal}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={selectedCategoryId ? 'Criar nova subcategoria nesta categoria' : 'Selecione primeiro a categoria'}
                >
                  <Plus className="w-3 h-3" /> Nova
                </button>
              </div>
              <select
                value={selectedSubcategoryId}
                disabled={!selectedCategoryId || availableSubcategories.length === 0}
                onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400 font-medium"
              >
                <option value="">
                  {selectedCategoryId
                    ? availableSubcategories.length > 0
                      ? '-- Selecione a Subcategoria (Opcional) --'
                      : 'Nenhuma subcategoria para esta categoria'
                    : 'Selecione primeiro a Categoria...'}
                </option>
                {availableSubcategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-amber-500" /> Tags Comerciais & Palavras-chave
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-200 text-xs mb-2">
              {allTags.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic block p-1">
                  Nenhuma tag cadastrada ainda. Adicione abaixo:
                </span>
              ) : (
                allTags.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedTagIds([...selectedTagIds, t.id]);
                        else
                          setSelectedTagIds(
                            selectedTagIds.filter((id) => id !== t.id)
                          );
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

        {/* 4. DESCRIÇÃO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            4. Descrição Comercial
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Breve Descrição (Destaque nos canais)
            </label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Ex: Fabricado em bio-polímero com acabamento acetinado"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Descrição Completa (Suporta Formatação, Negrito, Espaçamento e HTML)
              </label>
              <button
                type="button"
                onClick={() => setShowDescPreview(!showDescPreview)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  showDescPreview
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {showDescPreview ? 'Voltar para Edição' : 'Pré-visualizar Como o Cliente Verá'}
              </button>
            </div>

            {!showDescPreview ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Inserir:</span>
                  <button
                    type="button"
                    onClick={() => insertFormatting('<b>', '</b>')}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Adicionar Negrito (HTML)"
                  >
                    <Bold className="w-3 h-3" /> Negrito &lt;b&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('<i>', '</i>')}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Adicionar Itálico (HTML)"
                  >
                    <Italic className="w-3 h-3" /> Itálico &lt;i&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('<h3>', '</h3>')}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Adicionar Subtítulo"
                  >
                    <Heading2 className="w-3 h-3" /> Título &lt;h3&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('<ul>\n  <li>', '</li>\n  <li>Segundo ponto</li>\n</ul>')}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Adicionar Lista com Marcadores"
                  >
                    <List className="w-3 h-3" /> Lista &lt;ul&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('<br />\n')}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer shadow-2xs"
                    title="Adicionar Quebra de Linha / Espaçamento"
                  >
                    + Espaço &lt;br&gt;
                  </button>
                </div>

                <textarea
                  id="product-description-textarea"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Cole ou digite aqui a descrição. Você pode colar textos com tags HTML (<b>, <br>, <ul>, <li>) ou negrito **assim**. O espaçamento e as quebras de linha serão preservados na loja."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900 font-mono leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  💡 Você pode colar textos formatados do Word, Docs ou ChatGPT. Tags HTML e quebras de linha são renderizadas automaticamente. Clique em &quot;Pré-visualizar&quot; acima para conferir o resultado final.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl min-h-[140px] space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  Visualização em tempo real (como o cliente verá na loja):
                </div>
                <div
                  className="text-xs text-slate-700 leading-relaxed whitespace-pre-line formatted-description bg-white p-4 rounded-lg border border-slate-200"
                  dangerouslySetInnerHTML={{ __html: renderFormattedDescription(description) }}
                />
              </div>
            )}
          </div>
        </div>

        {/* 5. MÍDIA / FOTOS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            5. Galeria de Imagens
          </h2>

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
              <div
                key={i}
                className="group relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
              >
                <img
                  src={resolveMediaUrl(m.url)}
                  alt={`Mídia ${i}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
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

        {/* 6. VARIANTES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                6. Variantes do Produto (Cores / Dimensões)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cada cor possui controle físico de estoque independente e herda a precificação comercial (F12) do produto.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600 font-semibold bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {variantsList.filter((v) => v.isActive !== false).length} ativa(s)
              </span>
              {variantsList.filter((v) => v.isActive === false).length > 0 && (
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-medium border border-amber-200">
                  {variantsList.filter((v) => v.isActive === false).length} arquivada(s)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input
              type="text"
              value={newVariantSku}
              onChange={(e) => setNewVariantSku(e.target.value)}
              placeholder="SKU da Variante (ex: FEL-GAT-001-AZU) *"
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono bg-white focus:outline-none focus:border-slate-900"
            />
            <input
              type="text"
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              placeholder="Cor / Rótulo (ex: Azul) *"
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
            />
            <input
              type="number"
              min="0"
              value={newVariantStock}
              onChange={(e) => setNewVariantStock(e.target.value)}
              placeholder="Estoque inicial (opcional)"
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
            />
            <button
              type="button"
              onClick={handleAddVariant}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Variante
            </button>
          </div>

          {variantsList.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden mt-3 text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Cor</th>
                      <th className="py-2.5 px-3">Material de produção</th>
                      <th className="py-2.5 px-3">Custo F7</th>
                      <th className="py-2.5 px-3">Estoque</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variantsList.map((v) => {
                      const inv = (v as any).inventories?.find((i: any) => i.variantId === v.id) || (v as any).inventories?.[0];
                      const invStock = inv ? Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)) : undefined;
                      const avail =
                        v.availableStock !== undefined
                          ? v.availableStock
                          : invStock !== undefined
                          ? invStock
                          : v.stock !== undefined
                          ? v.stock
                          : (v as any).initialStock !== undefined
                          ? (v as any).initialStock
                          : 0;
                      const isArchived = v.isActive === false;
                      const effectiveProductCost =
                        pricingSummary?.productionCost && pricingSummary.productionCost > 0
                          ? pricingSummary.productionCost
                          : (costSource === 'MANUAL' && manualCost && Number(manualCost) > 0 ? Number(manualCost) : 0);
                      const costDisplay =
                        v.productionCost !== null &&
                        v.productionCost !== undefined
                          ? `R$ ${Number(v.productionCost)
                              .toFixed(2)
                              .replace('.', ',')}`
                          : effectiveProductCost > 0
                          ? `R$ ${Number(effectiveProductCost)
                              .toFixed(2)
                              .replace('.', ',')}`
                          : '-';

                      return (
                        <tr
                          key={v.id}
                          className={`hover:bg-slate-50/80 transition ${
                            isArchived ? 'opacity-60 bg-slate-50/50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {v.sku}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                              {v.name || 'Sem rótulo'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {v.isMaterialCustom ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                {v.materialName || 'Configurado'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200 font-medium" title="Herdando ficha padrão do produto">
                                Herdado / material específico não configurado
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-bold font-mono text-[11px]">
                            {costDisplay}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs border ${
                                avail > 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {avail} un
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {isArchived ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                Arquivado
                              </span>
                            ) : v.isMaterialCustom ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Configurado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="Material específico não configurado">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditVariant(v)}
                                className="px-2.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-bold text-xs transition flex items-center gap-1 border border-slate-200 cursor-pointer shadow-2xs"
                                title="Editar variante"
                              >
                                <Edit2 className="w-3 h-3 text-slate-500" />
                                Editar
                              </button>
                              {!isArchived && (
                                <button
                                  type="button"
                                  onClick={() => handleStartArchiveVariant(v)}
                                  className="px-2.5 py-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg font-bold text-xs transition flex items-center gap-1 border border-amber-200 cursor-pointer shadow-2xs"
                                  title="Arquivar variante"
                                >
                                  <Archive className="w-3 h-3 text-amber-600" />
                                  Arquivar
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
            </div>
          ) : (
            <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              Nenhuma variante cadastrada no momento.
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div>
            {isEditing && status !== 'ARCHIVED' && (
              <button
                type="button"
                onClick={() => setShowArchiveModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" /> Arquivar Produto
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/admin/products')}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Confirmação Explícita de Arquivamento */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Arquivar produto?
                </h3>
                <p className="text-xs text-slate-500 font-semibold">{name}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              Este produto será removido de todos os canais comerciais em que estiver disponível. O histórico de pedidos, estoque, movimentações e demais registros será preservado.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={archiving}
                onClick={() => setShowArchiveModal(false)}
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

      {/* Modal Inline: NOVO NICHO */}
      {showNicheModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">NOVO NICHO</h3>
                <p className="text-[11px] text-slate-500">Crie o nicho e continue o cadastro</p>
              </div>
            </div>

            <form onSubmit={handleCreateNiche} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Nicho *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pet Shop, Decoração, Eletrônicos..."
                  value={nicheModalName}
                  onChange={(e) => {
                    setNicheModalName(e.target.value);
                    setNicheModalSlug(toSlug(e.target.value));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900 font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Slug (Identificador URL) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="gerado-automaticamente"
                  value={nicheModalSlug}
                  onChange={(e) => setNicheModalSlug(toSlug(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900 font-mono text-slate-600"
                />
              </div>

              {existingNicheMatch && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>Já existe um nicho com esse nome: <strong>{existingNicheMatch.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      handleNicheChange(existingNicheMatch.id);
                      setShowNicheModal(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    Selecionar existente
                  </button>
                </div>
              )}

              {nicheModalError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{nicheModalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={nicheModalLoading}
                  onClick={() => setShowNicheModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={nicheModalLoading || !nicheModalName.trim() || Boolean(existingNicheMatch)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {nicheModalLoading ? 'Criando...' : 'Criar Nicho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inline: NOVA CATEGORIA */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">NOVA CATEGORIA</h3>
                <p className="text-[11px] text-slate-500">Adicione uma categoria ao nicho selecionado</p>
              </div>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nicho Comercial (Fixo)
                </label>
                <input
                  type="text"
                  disabled
                  value={allNiches.find((n) => n.id === selectedNicheId)?.name || 'Nenhum'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-100 font-semibold text-slate-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acessórios, Brinquedos, Decoração..."
                  value={categoryModalName}
                  onChange={(e) => {
                    setCategoryModalName(e.target.value);
                    setCategoryModalSlug(toSlug(e.target.value));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900 font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Slug (Identificador URL) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="gerado-automaticamente"
                  value={categoryModalSlug}
                  onChange={(e) => setCategoryModalSlug(toSlug(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900 font-mono text-slate-600"
                />
              </div>

              {existingCategoryMatch && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>Já existe uma categoria com esse nome: <strong>{existingCategoryMatch.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      handleCategoryChange(existingCategoryMatch.id);
                      setShowCategoryModal(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    Selecionar existente
                  </button>
                </div>
              )}

              {categoryModalError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{categoryModalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={categoryModalLoading}
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={categoryModalLoading || !categoryModalName.trim() || Boolean(existingCategoryMatch)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {categoryModalLoading ? 'Criando...' : 'Criar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inline: NOVA SUBCATEGORIA */}
      {showSubcategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">NOVA SUBCATEGORIA</h3>
                <p className="text-[11px] text-slate-500">Especialize a categoria selecionada</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubcategory} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Nicho (Fixo)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={allNiches.find((n) => n.id === selectedNicheId)?.name || 'Nenhum'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-100 font-semibold text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Categoria Pai (Fixa)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={availableCategories.find((c) => c.id === selectedCategoryId)?.name || 'Nenhuma'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-100 font-semibold text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Subcategoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Porta-Chaves, Coleiras, Pingentes..."
                  value={subcategoryModalName}
                  onChange={(e) => {
                    setSubcategoryModalName(e.target.value);
                    setSubcategoryModalSlug(toSlug(e.target.value));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900 font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Slug (Identificador URL) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="gerado-automaticamente"
                  value={subcategoryModalSlug}
                  onChange={(e) => setSubcategoryModalSlug(toSlug(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900 font-mono text-slate-600"
                />
              </div>

              {existingSubcategoryMatch && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>Já existe uma subcategoria com esse nome: <strong>{existingSubcategoryMatch.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubcategoryId(existingSubcategoryMatch.id);
                      setShowSubcategoryModal(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    Selecionar existente
                  </button>
                </div>
              )}

              {subcategoryModalError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{subcategoryModalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={subcategoryModalLoading}
                  onClick={() => setShowSubcategoryModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={subcategoryModalLoading || !subcategoryModalName.trim() || Boolean(existingSubcategoryMatch)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {subcategoryModalLoading ? 'Criando...' : 'Criar Subcategoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE VARIANTE */}
      {editingVariant && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Editar Variante (Cor / Opção)
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  ID: {editingVariant.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingVariant(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SKU da Variante *
                </label>
                <input
                  type="text"
                  required
                  value={editVariantSku}
                  onChange={(e) => setEditVariantSku(e.target.value)}
                  placeholder="Ex: FEL-GAT-001-AZU"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono bg-white focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cor / Rótulo da Variante *
                </label>
                <input
                  type="text"
                  required
                  value={editVariantName}
                  onChange={(e) => setEditVariantName(e.target.value)}
                  placeholder="Ex: Azul Pastel, Rosa, Vermelho, etc."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estoque Físico Disponível (unidades)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editVariantStock}
                  onChange={(e) => setEditVariantStock(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono bg-white focus:outline-none focus:border-slate-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Saldo físico exclusivo desta variante. Pedidos e reservas afetam apenas esta cor.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Material de Produção
                </label>

                {/* Indicação do status atual do material */}
                <div className="mb-2">
                  {editingVariant.isMaterialCustom ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                      <div>
                        <span className="font-bold">Material específico da variante:</span>{' '}
                        <span>{editingVariant.materialName}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0 mt-1"></span>
                      <div>
                        <span className="font-bold block">Material específico não configurado</span>
                        <span className="text-[11px] text-amber-700">
                          Herdando ficha padrão do produto ({editingVariant.materialName || 'PLA Padrão'}).
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <select
                  value={editVariantMaterialId}
                  onChange={(e) => setEditVariantMaterialId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900 cursor-pointer font-medium"
                >
                  <option value="">
                    [ Herdado do produto ] (Material específico não configurado)
                  </option>
                  {allMaterials
                    .filter(
                      (m) =>
                        m.category === 'PRODUCTION' ||
                        (!m.category && ['PLA', 'PETG', 'ABS', 'RESIN'].includes(m.type))
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (R$ {Number(m.costPerUnit).toFixed(4).replace('.', ',')}/g)
                      </option>
                    ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Selecione o material específico para esta variante. Se mantiver herdado, a ausência de material específico é considerada válida (estado: &quot;Material específico não configurado&quot;).
                </span>
              </div>

              {/* Box de Custo F7 Calculado */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Custo F7 Calculado
                  </span>
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    {(() => {
                      const selectedMat = allMaterials.find((m) => m.id === editVariantMaterialId);
                      if (selectedMat && editingVariant.materialId === editVariantMaterialId && editingVariant.productionCost) {
                        return `R$ ${Number(editingVariant.productionCost).toFixed(2).replace('.', ',')}`;
                      }
                      if (selectedMat) {
                        // Consumo confirmado: 12,64g filamento + 56m03s Bambu Lab A1 Mini (R$ 0,33) + Argola (R$ 0,35) + Embalagem (R$ 0,30)
                        const filament = 12.64 * Number(selectedMat.costPerUnit || 0.09);
                        const machine = (3363 / 3600) * 0.35; // ~0,326958 -> 0,33
                        const comp = 0.35; // Argola
                        const pkg = 0.30;  // Embalagem
                        const estCost = Math.round(filament * 100 + 0.00001) / 100 + Math.round(machine * 100 + 0.00001) / 100 + comp + pkg;
                        return `R$ ${estCost.toFixed(2).replace('.', ',')}`;
                      }
                      if (editingVariant.productionCost !== null && editingVariant.productionCost !== undefined) {
                        return `R$ ${Number(editingVariant.productionCost).toFixed(2).replace('.', ',')} (herdado)`;
                      }
                      return pricingSummary?.productionCost && pricingSummary.productionCost > 0
                        ? `R$ ${Number(pricingSummary.productionCost).toFixed(2).replace('.', ',')} (herdado)`
                        : 'Calculado no salvamento';
                    })()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {editVariantMaterialId ? (
                    <span className="text-blue-700 font-medium">
                      Filamento específico selecionado: {allMaterials.find((m) => m.id === editVariantMaterialId)?.name || 'Selecionado'} (12,64g + 56m03s A1 Mini + Argola + Embalagem)
                    </span>
                  ) : (
                    <span>Ficha base herdada: 12,64g filamento + 56m03s Bambu Lab A1 Mini + Argola (R$ 0,35) + Embalagem (R$ 0,30)</span>
                  )}
                </div>
              </div>

              {/* Informação sobre Preço Comercial */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>Preço Comercial:</strong> Os preços de atacado, varejo e canais comerciais (Mercado Livre, Shopee, etc.) continuam gerenciados centralmente pelo motor F12 do produto. O custo de produção da variante orienta as margens sem alterar arbitrariamente o preço de venda.
              </div>

              {variantEditError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{variantEditError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isSavingVariantEdit}
                onClick={() => setEditingVariant(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingVariantEdit}
                onClick={handleSaveVariantEdit}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSavingVariantEdit ? 'Salvando...' : 'Salvar alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE ARQUIVAMENTO DE VARIANTE */}
      {archivingVariant && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 pb-2 border-b border-slate-100">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Archive className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Arquivar Variante?
                </h3>
                <p className="text-[11px] text-slate-500">
                  Confirmação de inativação segura
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
              <div>
                <strong className="font-mono">{archivingVariant.sku}</strong>
                <span className="mx-2 text-slate-300">|</span>
                <span>{archivingVariant.name || 'Sem rótulo'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              A variante será <strong>inativada</strong> e deixará de aparecer na lista de variantes ativas para comercialização. Todos os pedidos e históricos existentes vinculados a ela serão <strong>preservados</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isArchivingVariant}
                onClick={() => setArchivingVariant(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isArchivingVariant}
                onClick={handleConfirmArchiveVariant}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isArchivingVariant ? 'Arquivando...' : 'Sim, arquivar variante'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
