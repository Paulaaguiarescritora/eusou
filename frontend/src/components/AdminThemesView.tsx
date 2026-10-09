import React, { useEffect, useState } from 'react';
import { Theme } from '../types';
import { fetchApi } from '../api';
import {
  Palette,
  Plus,
  Edit2,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Type,
  Layout,
  RefreshCw,
  Search,
} from 'lucide-react';

export const AdminThemesView: React.FC = () => {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    primaryColor: '#0f172a',
    secondaryColor: '#f8fafc',
    font: 'Inter',
    buttonStyle: 'rounded',
    cardStyle: 'elevated',
    bannerStyle: 'full-width',
    productsPerRow: 4,
    showCategories: true,
    showHighlights: true,
    showNewProducts: true,
    showOffers: true,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const loadThemes = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<{ data: Theme[] }>('/themes');
      setThemes(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar temas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, []);

  const handleOpenCreate = () => {
    setEditingTheme(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      primaryColor: '#0f172a',
      secondaryColor: '#f8fafc',
      font: 'Inter',
      buttonStyle: 'rounded',
      cardStyle: 'elevated',
      bannerStyle: 'full-width',
      productsPerRow: 4,
      showCategories: true,
      showHighlights: true,
      showNewProducts: true,
      showOffers: true,
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Theme) => {
    setEditingTheme(t);
    setFormData({
      name: t.name,
      slug: t.slug,
      description: t.description || '',
      primaryColor: t.primaryColor || '#0f172a',
      secondaryColor: t.secondaryColor || '#f8fafc',
      font: t.font || 'Inter',
      buttonStyle: t.buttonStyle || 'rounded',
      cardStyle: t.cardStyle || 'elevated',
      bannerStyle: t.bannerStyle || 'full-width',
      productsPerRow: t.productsPerRow || 4,
      showCategories: t.showCategories ?? true,
      showHighlights: t.showHighlights ?? true,
      showNewProducts: t.showNewProducts ?? true,
      showOffers: t.showOffers ?? true,
      status: (t.status as any) || 'ACTIVE',
    });
    setModalOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    try {
      await fetchApi(`/themes/${id}/duplicate`, { method: 'POST' });
      await loadThemes();
    } catch (err: any) {
      alert(err.message || 'Erro ao duplicar tema.');
    }
  };

  const handleToggleStatus = async (t: Theme) => {
    try {
      const nextStatus = t.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await fetchApi(`/themes/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadThemes();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status.');
    }
  };

  const handleDelete = async (t: Theme) => {
    if (t.isPreset) {
      alert('Temas preset do sistema não podem ser excluídos.');
      return;
    }
    if (!window.confirm(`Deseja realmente inativar/remover o tema "${t.name}"?`)) return;
    try {
      await fetchApi(`/themes/${t.id}`, { method: 'DELETE' });
      await loadThemes();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir tema.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTheme) {
        await fetchApi(`/themes/${editingTheme.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        });
      } else {
        await fetchApi('/themes', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setModalOpen(false);
      await loadThemes();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar tema.');
    }
  };

  const filteredThemes = themes.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Temas & Vitrines</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure paletas, tipografias e comportamento visual das vitrines e catálogos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadThemes}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
            title="Atualizar lista"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Plus size={16} /> Novo Tema
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
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
          Total: <span className="text-slate-900 font-bold">{filteredThemes.length}</span> temas
        </div>
      </div>

      {/* Grid de Temas com Prévia Visual */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Carregando temas...</div>
      ) : filteredThemes.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Nenhum tema encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredThemes.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              {/* Mini Preview do Tema */}
              <div
                style={{ backgroundColor: t.primaryColor, color: t.secondaryColor }}
                className="p-5 h-36 relative flex flex-col justify-between select-none"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: t.secondaryColor, color: t.primaryColor }}
                  >
                    {t.font}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {t.isPreset && (
                      <span className="text-[10px] bg-white/20 backdrop-blur-xs text-white px-2 py-0.5 rounded-full font-semibold">
                        Preset
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        t.status === 'ACTIVE'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {t.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs opacity-70 uppercase tracking-widest font-mono">
                    Visualização
                  </div>
                  <div
                    style={{ fontFamily: t.font }}
                    className="text-lg font-bold tracking-tight truncate"
                  >
                    {t.name}
                  </div>
                </div>

                {/* Exibição rápida das cores */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                  <span className="w-3.5 h-3.5 rounded-full border border-white/30" style={{ backgroundColor: t.primaryColor }} title="Primária" />
                  <span className="w-3.5 h-3.5 rounded-full border border-white/30" style={{ backgroundColor: t.secondaryColor }} title="Secundária" />
                  <span className="text-[10px] opacity-80 font-mono ml-auto">
                    {t.productsPerRow} prod/linha • {t.cardStyle}
                  </span>
                </div>
              </div>

              {/* Informações e Ações */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400">/{t.slug}</span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                  )}

                  {/* Resumo de Configurações */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                    <div>Botão: <span className="font-semibold text-slate-900">{t.buttonStyle}</span></div>
                    <div>Banner: <span className="font-semibold text-slate-900">{t.bannerStyle}</span></div>
                    <div>Categorias: <span className="font-semibold text-slate-900">{t.showCategories ? 'Sim' : 'Não'}</span></div>
                    <div>Ofertas: <span className="font-semibold text-slate-900">{t.showOffers ? 'Sim' : 'Não'}</span></div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(t)}
                      className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                        t.status === 'ACTIVE'
                          ? 'text-emerald-700 hover:bg-emerald-50'
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                      title={t.status === 'ACTIVE' ? 'Inativar tema' : 'Ativar tema'}
                    >
                      {t.status === 'ACTIVE' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    </button>
                    <button
                      onClick={() => handleDuplicate(t.id)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Duplicar tema"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Editar tema"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>

                  {!t.isPreset && (
                    <button
                      onClick={() => handleDelete(t)}
                      className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                      title="Excluir tema"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Formulário Tema */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {editingTheme ? `Editar Tema: ${editingTheme.name}` : 'Criar Novo Tema'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personalize as propriedades visuais sem necessidade de programação.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Identificação */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  1. Identificação
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Tema *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Minimalista Dark"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Slug (opcional)</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="ex: minimalista-dark"
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
                    placeholder="Descrição para controle da equipe..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Cores e Tipografia */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  2. Cores & Tipografia
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cor Primária</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-9 h-9 p-0.5 border border-slate-300 rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cor Secundária</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-9 h-9 p-0.5 border border-slate-300 rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tipografia</label>
                    <select
                      value={formData.font}
                      onChange={(e) => setFormData({ ...formData, font: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="Inter">Inter (Sans)</option>
                      <option value="Poppins">Poppins (Moderna)</option>
                      <option value="Playfair Display">Playfair Display (Serifada Elegante)</option>
                      <option value="Lora">Lora (Editorial)</option>
                      <option value="Nunito">Nunito (Amigável)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Estilo dos Elementos */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  3. Estilo dos Componentes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Estilo de Botão</label>
                    <select
                      value={formData.buttonStyle}
                      onChange={(e) => setFormData({ ...formData, buttonStyle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="rounded">Arredondado</option>
                      <option value="full-rounded">Pílula (Full)</option>
                      <option value="sharp">Reto / Sharp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Estilo de Card</label>
                    <select
                      value={formData.cardStyle}
                      onChange={(e) => setFormData({ ...formData, cardStyle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="elevated">Elevado (Sombra)</option>
                      <option value="flat">Flat</option>
                      <option value="bordered">Com Borda Fina</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Banner</label>
                    <select
                      value={formData.bannerStyle}
                      onChange={(e) => setFormData({ ...formData, bannerStyle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="full-width">Largura Total</option>
                      <option value="contained">Contido</option>
                      <option value="split">Dividido (Split)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Prod. por Linha</label>
                    <input
                      type="number"
                      min={2}
                      max={6}
                      value={formData.productsPerRow}
                      onChange={(e) => setFormData({ ...formData, productsPerRow: Number(e.target.value) || 4 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Visibilidade das Seções */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  4. Seções Visíveis na Vitrine
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showCategories}
                      onChange={(e) => setFormData({ ...formData, showCategories: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Exibir Categorias</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showHighlights}
                      onChange={(e) => setFormData({ ...formData, showHighlights: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Exibir Destaques</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showNewProducts}
                      onChange={(e) => setFormData({ ...formData, showNewProducts: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Exibir Novidades</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showOffers}
                      onChange={(e) => setFormData({ ...formData, showOffers: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Exibir Ofertas</span>
                  </label>
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
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
                  {editingTheme ? 'Atualizar Tema' : 'Salvar Tema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
