import React, { useEffect, useState } from 'react';
import { Catalog, Theme, Niche, Category, Tag } from '../types';
import { fetchApi } from '../api';
import {
  BookOpen,
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
  Sparkles,
  SlidersHorizontal,
  Palette,
} from 'lucide-react';

interface AdminCatalogsViewProps {
  onNavigate: (route: string) => void;
}

export const AdminCatalogsView: React.FC<AdminCatalogsViewProps> = ({ onNavigate }) => {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const loadCatalogs = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<{ data: Catalog[] }>('/catalogs?limit=50');
      setCatalogs(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar catálogos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, []);

  const handleDuplicate = async (id: string) => {
    try {
      await fetchApi(`/catalogs/${id}/duplicate`, { method: 'POST' });
      await loadCatalogs();
    } catch (err: any) {
      alert(err.message || 'Erro ao duplicar catálogo.');
    }
  };

  const handleToggleStatus = async (c: Catalog) => {
    try {
      const nextStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await fetchApi(`/catalogs/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadCatalogs();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status.');
    }
  };

  const handleDelete = async (c: Catalog) => {
    if (!window.confirm(`Deseja realmente arquivar/excluir o catálogo "${c.name}"?`)) return;
    try {
      await fetchApi(`/catalogs/${c.id}`, { method: 'DELETE' });
      await loadCatalogs();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir catálogo.');
    }
  };

  const filteredCatalogs = catalogs.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'ALL' || c.type === filterType;
    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Catálogos & Vitrines</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie vitrines publicáveis manuais ou automatizadas por regras de nicho, categoria e tags.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCatalogs}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
            title="Atualizar lista"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => onNavigate('/admin/catalogs/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Plus size={16} /> Novo Catálogo
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-700 outline-none"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTOMATIC">Automático (Regras)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-700 outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="DRAFT">Rascunhos</option>
            <option value="INACTIVE">Inativos</option>
          </select>
        </div>
      </div>

      {/* Grid de Catálogos */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Carregando catálogos...</div>
      ) : filteredCatalogs.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Nenhum catálogo encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCatalogs.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Header Card */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      c.type === 'AUTOMATIC'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {c.type === 'AUTOMATIC' ? 'Automático' : 'Curadoria Manual'}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {c.status === 'ACTIVE' ? 'Ativo' : c.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{c.name}</h3>
                <span className="text-[11px] font-mono text-slate-400 block mb-2">
                  /catalogos/{c.slug}
                </span>

                {c.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>
                )}

                {/* Métricas e Detalhes */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Package size={14} className="text-slate-400" />
                    <span>
                      <strong className="text-slate-900">{c._count?.items ?? 0}</strong> produtos
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers size={14} className="text-slate-400" />
                    <span>
                      <strong className="text-slate-900">{c._count?.collections ?? 0}</strong> coleções
                    </span>
                  </div>
                  {c.theme && (
                    <div className="flex items-center gap-1.5 col-span-2 text-[11px] text-slate-500 mt-1">
                      <Palette size={13} className="text-slate-400" />
                      <span>Tema: <strong className="text-slate-800">{c.theme.name}</strong></span>
                    </div>
                  )}
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
                    title={c.status === 'ACTIVE' ? 'Inativar catálogo' : 'Ativar catálogo'}
                  >
                    {c.status === 'ACTIVE' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </button>
                  <button
                    onClick={() => handleDuplicate(c.id)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Duplicar catálogo"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => onNavigate(`/admin/catalogs/${c.id}`)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Editar catálogo"
                  >
                    <Edit2 size={16} />
                  </button>
                  <a
                    href={`/catalogos/${c.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Acessar vitrine pública"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>

                <button
                  onClick={() => handleDelete(c)}
                  className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                  title="Excluir/Arquivar catálogo"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
