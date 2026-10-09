import React, { useEffect, useState } from 'react';
import { AttributeDefinition } from '../types';
import { fetchApi } from '../api';
import { SlidersHorizontal, Plus, Search, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AdminAttributesView: React.FC = () => {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAttr, setEditingAttr] = useState<AttributeDefinition | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: 'STRING' as 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SELECT',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const attrsRes = await fetchApi<{ data: AttributeDefinition[] }>('/attributes').catch(() => ({ data: [] }));
      setAttributes(attrsRes.data || []);
    } catch {
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingAttr(null);
    setFormData({
      name: '',
      slug: '',
      type: 'STRING',
      description: '',
    });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (attr: AttributeDefinition) => {
    setEditingAttr(attr);
    setFormData({
      name: attr.name,
      slug: attr.slug,
      type: attr.type,
      description: attr.description || '',
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
    } else {
      payload.slug = formData.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    }
    if (formData.description && formData.description.trim()) {
      payload.description = formData.description.trim();
    }

    try {
      if (editingAttr) {
        await fetchApi(`/attributes/${editingAttr.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi('/attributes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar definição de atributo.');
    } finally {
      setSaving(false);
    }
  };

  const filteredAttributes = attributes.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-amber-500" /> Definições de Atributos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Características estruturadas para especificações técnicas e variantes de produtos
          </p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Atributo
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
          {filteredAttributes.length} {filteredAttributes.length === 1 ? 'atributo' : 'atributos'}
        </span>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Carregando atributos...</div>
        ) : filteredAttributes.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Nenhum atributo cadastrado. Clique em "+ Novo Atributo" para cadastrar (ex: Cor, Material, Tamanho).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nome / Atributo</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttributes.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {a.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                      /{a.slug}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {a.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Ativo
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                        title="Editar atributo"
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
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingAttr ? 'Editar Atributo' : 'Novo Atributo'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Defina o nome e tipo do atributo (ex: Cor, Material, Dimensão).
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
                  placeholder="Ex: Cor, Material, Voltagem"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slug (URL amigável)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Ex: cor"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Finalidade do atributo..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
                />
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
                  {saving ? 'Salvando...' : 'Salvar Atributo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
