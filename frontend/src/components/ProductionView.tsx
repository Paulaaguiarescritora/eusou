import React, { useEffect, useState } from 'react';
import { 
  Printer, 
  Material, 
  ProductionJob, 
  ProductionProfile, 
  Product 
} from '../types';
import { fetchApi } from '../api';
import { 
  Cpu, 
  Layers, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Wrench, 
  Clock, 
  DollarSign, 
  Zap, 
  Sparkles,
  Search,
  AlertTriangle
} from 'lucide-react';

export const ProductionView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'printers' | 'materials' | 'profiles'>('jobs');
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [profiles, setProfiles] = useState<ProductionProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [newJobProductId, setNewJobProductId] = useState('');
  const [newJobPrinterId, setNewJobPrinterId] = useState('');
  const [newJobQuantity, setNewJobQuantity] = useState(1);
  const [newJobNotes, setNewJobNotes] = useState('');

  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterModel, setNewPrinterModel] = useState('');
  const [newPrinterLocation, setNewPrinterLocation] = useState('');
  const [newPrinterCost, setNewPrinterCost] = useState('5.00');

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialType, setNewMaterialType] = useState<'PLA' | 'PETG' | 'ABS' | 'RESIN' | 'OTHER'>('PLA');
  const [newMaterialColor, setNewMaterialColor] = useState('');
  const [newMaterialCost, setNewMaterialCost] = useState('0.10');
  const [newMaterialQty, setNewMaterialQty] = useState('1000');
  const [newMaterialMin, setNewMaterialMin] = useState('200');

  const [completeJobModal, setCompleteJobModal] = useState<ProductionJob | null>(null);
  const [producedQty, setProducedQty] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsRes, printersRes, materialsRes, profilesRes, prodRes] = await Promise.all([
        fetchApi<{ data: ProductionJob[] }>('/admin/production/jobs'),
        fetchApi<Printer[]>('/admin/printers'),
        fetchApi<Material[]>('/admin/materials'),
        fetchApi<ProductionProfile[]>('/admin/production/profiles'),
        fetchApi<{ data: Product[] }>('/products'),
      ]);
      setJobs(jobsRes.data || []);
      setPrinters(printersRes || []);
      setMaterials(materialsRes || []);
      setProfiles(profilesRes || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Error loading production data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartJob = async (id: string) => {
    try {
      await fetchApi(`/admin/production/jobs/${id}/start`, { method: 'POST' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao iniciar job');
    }
  };

  const handlePauseJob = async (id: string) => {
    try {
      await fetchApi(`/admin/production/jobs/${id}/pause`, { method: 'POST' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao pausar job');
    }
  };

  const handleCancelJob = async (id: string) => {
    if (!confirm('Deseja realmente cancelar este job?')) return;
    try {
      await fetchApi(`/admin/production/jobs/${id}/cancel`, { 
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelado pelo operador' })
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar job');
    }
  };

  const handleCompleteJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeJobModal) return;
    try {
      await fetchApi(`/admin/production/jobs/${completeJobModal.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          producedQuantity: Number(producedQty),
          rejectedQuantity: Number(rejectedQty),
        }),
      });
      setCompleteJobModal(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao concluir job');
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/production/jobs', {
        method: 'POST',
        body: JSON.stringify({
          productId: newJobProductId,
          printerId: newJobPrinterId,
          plannedQuantity: Number(newJobQuantity),
          notes: newJobNotes || undefined,
        }),
      });
      setShowJobModal(false);
      setNewJobNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar job');
    }
  };

  const handleCreatePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/printers', {
        method: 'POST',
        body: JSON.stringify({
          name: newPrinterName,
          model: newPrinterModel,
          location: newPrinterLocation || undefined,
          machineCostPerHour: Number(newPrinterCost),
        }),
      });
      setShowPrinterModal(false);
      setNewPrinterName('');
      setNewPrinterModel('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar impressora');
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/materials', {
        method: 'POST',
        body: JSON.stringify({
          name: newMaterialName,
          type: newMaterialType,
          color: newMaterialColor || undefined,
          costPerUnit: Number(newMaterialCost),
          currentQuantity: Number(newMaterialQty),
          minimumQuantity: Number(newMaterialMin),
        }),
      });
      setShowMaterialModal(false);
      setNewMaterialName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar material');
    }
  };

  const handlePrinterStatusToggle = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
    try {
      await fetchApi(`/admin/printers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao mudar status da impressora');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white">
              Operações & Fabricação
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
            Produção & Parque de Impressoras
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Gestão da fila de manufatura, consumo de materiais, custos operacionais e abastecimento de estoque
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'jobs' && (
            <button
              onClick={() => setShowJobModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Nova Ordem de Produção
            </button>
          )}
          {activeTab === 'printers' && (
            <button
              onClick={() => setShowPrinterModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Adicionar Impressora
            </button>
          )}
          {activeTab === 'materials' && (
            <button
              onClick={() => setShowMaterialModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Cadastrar Material
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 gap-6 mb-6 overflow-x-auto">
        {[
          { id: 'jobs', label: `Fila de Produção (${jobs.length})`, icon: Cpu },
          { id: 'printers', label: `Impressoras (${printers.length})`, icon: Wrench },
          { id: 'materials', label: `Materiais (${materials.length})`, icon: Layers },
          { id: 'profiles', label: `Fichas Técnicas (${profiles.length})`, icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB: JOBS */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Job / Produto</th>
                  <th className="px-6 py-3.5">Impressora</th>
                  <th className="px-6 py-3.5">Qtd Planejada</th>
                  <th className="px-6 py-3.5">Custo Estimado</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-900">{job.product?.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">#{job.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-800">{job.printer?.name}</td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{job.plannedQuantity} un</td>
                    <td className="px-6 py-4 text-amber-700 font-semibold">
                      R$ {Number(job.estimatedCost).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          job.status === 'PRINTING'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : job.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : job.status === 'PAUSED'
                            ? 'bg-amber-100 text-amber-800'
                            : job.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {job.status === 'QUEUED' && (
                          <button
                            onClick={() => handleStartJob(job.id)}
                            className="p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition"
                            title="Iniciar Impressão"
                          >
                            <Play size={16} />
                          </button>
                        )}
                        {job.status === 'PRINTING' && (
                          <>
                            <button
                              onClick={() => handlePauseJob(job.id)}
                              className="p-1.5 hover:bg-amber-50 text-amber-700 rounded-lg transition"
                              title="Pausar Impressão"
                            >
                              <Pause size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setCompleteJobModal(job);
                                setProducedQty(job.plannedQuantity);
                                setRejectedQty(0);
                              }}
                              className="p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition"
                              title="Concluir e Abastecer Estoque"
                            >
                              <CheckCircle size={16} />
                            </button>
                          </>
                        )}
                        {job.status === 'PAUSED' && (
                          <>
                            <button
                              onClick={() => handleStartJob(job.id)}
                              className="p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition"
                              title="Retomar Impressão"
                            >
                              <Play size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setCompleteJobModal(job);
                                setProducedQty(job.plannedQuantity);
                                setRejectedQty(0);
                              }}
                              className="p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition"
                              title="Concluir"
                            >
                              <CheckCircle size={16} />
                            </button>
                          </>
                        )}
                        {(job.status === 'QUEUED' || job.status === 'PRINTING' || job.status === 'PAUSED') && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition"
                            title="Cancelar Job"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-zinc-500">
                      Nenhuma ordem de produção registrada na fila.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PRINTERS */}
      {activeTab === 'printers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {printers.map((p) => (
            <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      p.status === 'AVAILABLE'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : p.status === 'PRINTING'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {p.status}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">{p.model}</span>
                </div>
                <h3 className="font-serif font-bold text-zinc-900 text-lg mb-1">{p.name}</h3>
                <p className="text-xs text-zinc-500 mb-3">{p.location || 'Bancada Principal'}</p>
                <div className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 flex items-center justify-between">
                  <span>Custo Máquina:</span>
                  <span className="font-semibold text-zinc-900">R$ {Number(p.machineCostPerHour).toFixed(2)}/h</span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
                <button
                  onClick={() => handlePrinterStatusToggle(p.id, p.status)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition"
                >
                  {p.status === 'AVAILABLE' ? 'Colocar em Manutenção' : 'Tornar Disponível'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: MATERIALS */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Material</th>
                <th className="px-6 py-3.5">Tipo</th>
                <th className="px-6 py-3.5">Cor</th>
                <th className="px-6 py-3.5">Custo p/ Unidade</th>
                <th className="px-6 py-3.5">Estoque Atual</th>
                <th className="px-6 py-3.5">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {materials.map((m) => {
                const isLow = Number(m.currentQuantity) <= Number(m.minimumQuantity);
                return (
                  <tr key={m.id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-6 py-4 font-semibold text-zinc-900">{m.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded">
                        {m.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-600">{m.color || '-'}</td>
                    <td className="px-6 py-4 font-medium text-zinc-900">
                      R$ {Number(m.costPerUnit).toFixed(4)} /{m.unit.toLowerCase()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${isLow ? 'text-red-600' : 'text-zinc-900'}`}>
                        {Number(m.currentQuantity).toFixed(1)} {m.unit.toLowerCase()}
                      </span>
                      {isLow && (
                        <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800">
                          Estoque Baixo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {Number(m.minimumQuantity).toFixed(1)} {m.unit.toLowerCase()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: PROFILES */}
      {activeTab === 'profiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((prof) => (
            <div key={prof.id} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  {prof.productionMode}
                </span>
                <span className="text-xs text-zinc-500 font-mono">{prof.productionTimeMinutes} min</span>
              </div>
              <h3 className="font-serif font-bold text-zinc-900 text-lg mb-2">
                {prof.product?.name || 'Ficha Sem Produto'}
              </h3>
              <div className="space-y-1.5 text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-100 mb-3">
                <div className="flex justify-between">
                  <span>Peso Estimado:</span>
                  <span className="font-semibold text-zinc-900">{Number(prof.materialWeightGrams)}g</span>
                </div>
                <div className="flex justify-between">
                  <span>Potência Máquina:</span>
                  <span className="font-semibold text-zinc-900">{prof.powerConsumptionWatts}W</span>
                </div>
                <div className="flex justify-between">
                  <span>Acabamento:</span>
                  <span className="font-semibold text-zinc-900">R$ {Number(prof.finishingCost).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Embalagem:</span>
                  <span className="font-semibold text-zinc-900">R$ {Number(prof.packagingCost).toFixed(2)}</span>
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                Materiais vinculados: <span className="font-semibold text-zinc-800">{prof.materials?.length || 0}</span>
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <div className="col-span-full py-10 text-center text-zinc-500 bg-white border border-dashed border-zinc-300 rounded-2xl">
              Nenhuma ficha de produção configurada ainda.
            </div>
          )}
        </div>
      )}

      {/* MODAL: CRIAR JOB */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Nova Ordem de Produção</h3>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Produto</label>
                <select
                  required
                  value={newJobProductId}
                  onChange={(e) => setNewJobProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">Selecione o produto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Impressora</label>
                <select
                  required
                  value={newJobPrinterId}
                  onChange={(e) => setNewJobPrinterId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">Selecione a impressora...</option>
                  {printers.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} ({pr.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Quantidade Planejada</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newJobQuantity}
                  onChange={(e) => setNewJobQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={newJobNotes}
                  onChange={(e) => setNewJobNotes(e.target.value)}
                  placeholder="Lote especial, filamento específico..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Inserir na Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONCLUIR JOB */}
      {completeJobModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Concluir Produção</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Informe a quantidade final aprovada para gerar entrada automática no estoque e consumir filamento/resina.
            </p>
            <form onSubmit={handleCompleteJobSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Peças Aprovadas</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={producedQty}
                    onChange={(e) => setProducedQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Rejeitadas/Perda</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/60 p-3 rounded-xl text-xs text-amber-900">
                Apenas as peças aprovadas ({producedQty}) serão adicionadas ao estoque disponível.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCompleteJobModal(null)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Finalizar & Entrar em Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR IMPRESSORA */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Adicionar Impressora</h3>
            <form onSubmit={handleCreatePrinter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Nome</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Bambu Lab X1 #01"
                  value={newPrinterName}
                  onChange={(e) => setNewPrinterName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Modelo</label>
                <input
                  type="text"
                  required
                  placeholder="ex: X1-Carbon, Ender 3 V3"
                  value={newPrinterModel}
                  onChange={(e) => setNewPrinterModel(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Localização</label>
                  <input
                    type="text"
                    placeholder="Bancada A"
                    value={newPrinterLocation}
                    onChange={(e) => setNewPrinterLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Custo/Hora (R$)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newPrinterCost}
                    onChange={(e) => setNewPrinterCost(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowPrinterModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition"
                >
                  Salvar Impressora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR MATERIAL */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Cadastrar Material</h3>
            <form onSubmit={handleCreateMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Nome do Material</label>
                <input
                  type="text"
                  required
                  placeholder="ex: PLA Silk Ouro"
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Tipo</label>
                  <select
                    value={newMaterialType}
                    onChange={(e) => setNewMaterialType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="PLA">PLA</option>
                    <option value="PETG">PETG</option>
                    <option value="ABS">ABS</option>
                    <option value="RESIN">Resina</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Cor</label>
                  <input
                    type="text"
                    placeholder="Dourado"
                    value={newMaterialColor}
                    onChange={(e) => setNewMaterialColor(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Custo/g (R$)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={newMaterialCost}
                    onChange={(e) => setNewMaterialCost(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Qtd Inicial (g)</label>
                  <input
                    type="number"
                    required
                    value={newMaterialQty}
                    onChange={(e) => setNewMaterialQty(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Mínimo (g)</label>
                  <input
                    type="number"
                    required
                    value={newMaterialMin}
                    onChange={(e) => setNewMaterialMin(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition"
                >
                  Salvar Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
