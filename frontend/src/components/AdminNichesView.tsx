import React, { useEffect, useState } from 'react';
import { Niche, Theme } from '../types';
import { fetchApi } from '../api';
import { Layers, Plus, Search, Edit2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export const AdminNichesView: React.FC = () => {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingNiche, setEditingNiche] = useState<Niche | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    themeId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nichesRes, themesRes] = await Promise.all([
        fetchApi<{ data: Niche[] }>('/niches').catch(() => ({ data: [] })),
        fetchApi<any>('/themes').catch(() => ({ data: [] })),
      ]);
      setNiches(Array.isArray(nichesRes.data) ? nichesRes.data : []);
      const themeList = Array.isArray(themesRes) ? themesRes : Array.isArray(themesRes?.data) ? themesRes.data : [];
      setThemes(themeList);
    } catch {
      setNiches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingNiche(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      status: 'ACTIVE',
      themeId: '',
    });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (niche: Niche) => {
    setEditingNiche(niche);
    setFormData({
      name: niche.name,
      slug: niche.slug,
      description: niche.description || '',
      status: niche.status,
      themeId: niche.themeId || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: any = {
      name: formData.name.trim(),
    };
    if (formData.slug.trim()) {
      payload.slug = formData.slug.trim();
    }
    if (formData.description.trim()) {
      payload.description = formData.description.trim();
    }
    if (formData.status) {
      payload.status = formData.status;
    }

    try {
      if (editingNiche) {
        await fetchApi(`/niches/${editingNiche.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi('/niches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar nicho.');
    } finally {
      setSaving(false);
    }
  };

  const filteredNiches = niches.filter((n) =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-500" /> Nichos de Mercado
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Segmentação estratégica de produtos e catálogos temáticos
          </p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Nicho
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="relative max-w-md w-full">
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
        <span className="text-xs text-slate-500 font-semibold">
          {filteredNiches.length} {filteredNiches.length === 1 ? 'nicho' : 'nichos'}
        </span>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Carregando nichos...</div>
        ) : filteredNiches.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Nenhum nicho encontrado. Clique em "+ Novo Nicho" para cadastrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nome / Slug</th>
                  <th className="py-3 px-4">Categorias Vinculadas</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNiches.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{n.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">/{n.slug}</span>
                    </td>
                    <td className="py-3 px-4">
                      {n.categories && n.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {n.categories.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80 text-[10px] font-semibold"
                            >
                              <span>{c.name}</span>
                              {c._count?.products !== undefined && (
                                <span className="text-[9px] bg-amber-200/70 text-amber-950 px-1 rounded-full font-bold">
                                  {c._count.products}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Nenhuma categoria</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {n.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {n.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle className="w-3 h-3" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openEdit(n)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                        title="Editar nicho"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingNiche ? 'Editar Nicho' : 'Novo Nicho'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Preencha os dados do nicho para categorização estratégica de produtos.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Colecionáveis & Geek"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slug (URL amigável)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Ex: colecionaveis-geek"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição do nicho..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tema Visual</label>
                  <select
                    value={formData.themeId}
                    onChange={(e) => setFormData({ ...formData, themeId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-slate-900"
                  >
                    <option value="">Padrão da Loja</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition shadow-xs"
                >
                  {saving ? 'Salvando...' : 'Salvar Nicho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
