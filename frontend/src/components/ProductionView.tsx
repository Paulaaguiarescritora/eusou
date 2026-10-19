import React, { useEffect, useState } from 'react';
import { 
  Printer, 
  Material, 
  ProductionJob, 
  ProductionProfile, 
  Product,
  MaterialCategory 
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
  Sparkles,
  AlertTriangle,
  Edit2,
  Archive,
  RotateCcw,
  Package,
  Trash2,
  Check
} from 'lucide-react';

interface ProfileEstimate {
  filamentCost: number;
  machineCost: number;
  additionalMaterialsCost: number;
  packagingCost: number;
  materialCost: number;
  totalCost: number;
  breakdown?: {
    filament: Array<{ materialId: string; name: string; quantity: number; unit: string; costPerUnit: number; totalCost: number }>;
    additionalMaterials: Array<{ materialId: string; name: string; quantity: number; unit: string; costPerUnit: number; totalCost: number }>;
    packaging: Array<{ materialId: string; name: string; quantity: number; unit: string; costPerUnit: number; totalCost: number }>;
    machine: { printerId?: string; printerName?: string; hours: number; ratePerHour: number; totalCost: number; timeFormatted: string };
  };
}

export const ProductionView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'printers' | 'materials' | 'profiles'>('profiles');
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [profiles, setProfiles] = useState<ProductionProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Material filters
  const [materialFilterCategory, setMaterialFilterCategory] = useState<'ALL' | MaterialCategory | 'ARCHIVED'>('ALL');

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
  const [newPrinterCost, setNewPrinterCost] = useState('0.35');

  // Material Modal (Create & Edit)
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialName, setMaterialName] = useState('');
  const [materialCategory, setMaterialCategory] = useState<MaterialCategory>('PRODUCTION');
  const [materialType, setMaterialType] = useState<'PLA' | 'PETG' | 'ABS' | 'RESIN' | 'OTHER'>('PLA');
  const [materialColor, setMaterialColor] = useState('');
  const [materialUnit, setMaterialUnit] = useState<'GRAM' | 'PIECE' | 'METER' | 'KILOGRAM'>('GRAM');
  const [materialCost, setMaterialCost] = useState('0.0900');
  const [materialQty, setMaterialQty] = useState('1000');
  const [materialMin, setMaterialMin] = useState('200');

  // Complete Job Modal
  const [completeJobModal, setCompleteJobModal] = useState<ProductionJob | null>(null);
  const [producedQty, setProducedQty] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);

  // Profile Modal (Ficha Técnica Criar & Editar)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileProductId, setProfileProductId] = useState('');
  const [profilePrinterId, setProfilePrinterId] = useState('');
  const [profileTimeMinutes, setProfileTimeMinutes] = useState(56);
  const [profileTimeSeconds, setProfileTimeSeconds] = useState(3);
  
  // Materials inside profile
  // 1. Filamento principal
  const [profileFilamentId, setProfileFilamentId] = useState('');
  const [profileFilamentQty, setProfileFilamentQty] = useState('12.64');
  
  // 2. Componentes / Adicionais
  interface ProfileMaterialItem {
    materialId: string;
    quantity: string;
  }
  const [profileAdditionalItems, setProfileAdditionalItems] = useState<ProfileMaterialItem[]>([]);
  
  // 3. Embalagem
  const [profilePackagingItems, setProfilePackagingItems] = useState<ProfileMaterialItem[]>([]);

  // Profile estimates cache
  const [profileEstimates, setProfileEstimates] = useState<Record<string, ProfileEstimate>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsRes, printersRes, materialsRes, profilesRes, prodRes] = await Promise.all([
        fetchApi<{ data: ProductionJob[] }>('/admin/production/jobs'),
        fetchApi<Printer[]>('/admin/printers'),
        fetchApi<Material[]>('/admin/materials'),
        fetchApi<ProductionProfile[]>('/admin/production/profiles'),
        fetchApi<{ data: Product[] }>('/products?limit=100'),
      ]);
      setJobs(jobsRes.data || []);
      setPrinters(printersRes || []);
      setMaterials(materialsRes || []);
      setProfiles(profilesRes || []);
      setProducts(prodRes.data || []);

      // Pre-calculate estimates for all profiles
      const estimatesMap: Record<string, ProfileEstimate> = {};
      if (profilesRes && profilesRes.length > 0) {
        await Promise.all(
          profilesRes.map(async (prof) => {
            try {
              const est = await fetchApi<ProfileEstimate>(`/admin/production/profiles/${prof.id}/estimate`);
              estimatesMap[prof.id] = est;
            } catch (e) {
              console.error(`Error estimating profile ${prof.id}:`, e);
            }
          })
        );
      }
      setProfileEstimates(estimatesMap);
    } catch (err) {
      console.error('Error loading production data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Material helpers
  const handleOpenNewMaterialModal = () => {
    setEditingMaterialId(null);
    setMaterialName('');
    setMaterialCategory('PRODUCTION');
    setMaterialType('PLA');
    setMaterialColor('');
    setMaterialUnit('GRAM');
    setMaterialCost('0.0900');
    setMaterialQty('1000');
    setMaterialMin('200');
    setShowMaterialModal(true);
  };

  const handleOpenEditMaterialModal = (m: Material) => {
    setEditingMaterialId(m.id);
    setMaterialName(m.name);
    setMaterialCategory(m.category || (['PLA', 'PETG', 'ABS', 'RESIN'].includes(m.type) ? 'PRODUCTION' : 'COMPONENT'));
    setMaterialType(m.type);
    setMaterialColor(m.color || '');
    setMaterialUnit((m.unit as any) === 'UNIT' ? 'PIECE' : (m.unit as any));
    setMaterialCost(Number(m.costPerUnit).toFixed(4));
    setMaterialQty(String(m.currentQuantity));
    setMaterialMin(String(m.minimumQuantity));
    setShowMaterialModal(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMaterialId) {
        await fetchApi(`/admin/materials/${editingMaterialId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: materialName.trim(),
            category: materialCategory,
            type: materialType,
            color: materialColor.trim() || undefined,
            unit: materialUnit,
            costPerUnit: Number(materialCost),
            minimumQuantity: Number(materialMin),
          }),
        });
      } else {
        await fetchApi('/admin/materials', {
          method: 'POST',
          body: JSON.stringify({
            name: materialName.trim(),
            category: materialCategory,
            type: materialType,
            color: materialColor.trim() || undefined,
            unit: materialUnit,
            costPerUnit: Number(materialCost),
            currentQuantity: Number(materialQty),
            minimumQuantity: Number(materialMin),
          }),
        });
      }
      setShowMaterialModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar material');
    }
  };

  const handleArchiveOrDeleteMaterial = async (m: Material) => {
    const actionLabel = m.isActive ? 'arquivar/desativar' : 'reativar';
    if (!confirm(`Deseja realmente ${actionLabel} o material "${m.name}"?`)) return;

    try {
      if (m.isActive) {
        const res = await fetchApi<{ message?: string; archived?: boolean; deleted?: boolean }>(
          `/admin/materials/${m.id}`,
          { method: 'DELETE' }
        );
        if (res.message) alert(res.message);
      } else {
        await fetchApi(`/admin/materials/${m.id}/reactivate`, { method: 'POST' });
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao processar material');
    }
  };

  // Profile Modal helpers
  const handleOpenNewProfileModal = (existingProfile?: ProductionProfile) => {
    if (existingProfile) {
      setEditingProfileId(existingProfile.id);
      setProfileProductId(existingProfile.productId || '');
      setProfilePrinterId(existingProfile.printerId || printers[0]?.id || '');

      const totalSec = existingProfile.productionTimeSeconds || (existingProfile.productionTimeMinutes * 60);
      setProfileTimeMinutes(Math.floor(totalSec / 60));
      setProfileTimeSeconds(totalSec % 60);

      // Distribute materials
      const filItem = existingProfile.materials?.find(
        (pm) => pm.material.category === 'PRODUCTION' || ['PLA', 'PETG', 'ABS', 'RESIN'].includes(pm.material.type)
      );
      setProfileFilamentId(filItem?.materialId || materials.find((m) => m.category === 'PRODUCTION')?.id || '');
      setProfileFilamentQty(filItem ? String(filItem.quantity) : '12.64');

      const addItems = existingProfile.materials
        ?.filter((pm) => pm.material.category === 'COMPONENT')
        .map((pm) => ({ materialId: pm.materialId, quantity: String(pm.quantity) })) || [];
      setProfileAdditionalItems(addItems);

      const packItems = existingProfile.materials
        ?.filter((pm) => pm.material.category === 'PACKAGING')
        .map((pm) => ({ materialId: pm.materialId, quantity: String(pm.quantity) })) || [];
      setProfilePackagingItems(packItems);
    } else {
      setEditingProfileId(null);
      setProfileProductId(products[0]?.id || '');
      setProfilePrinterId(printers[0]?.id || '');
      setProfileTimeMinutes(56);
      setProfileTimeSeconds(3);

      const defaultFilament = materials.find((m) => m.category === 'PRODUCTION' && m.isActive);
      setProfileFilamentId(defaultFilament?.id || '');
      setProfileFilamentQty('12.64');

      // Default sample additional items if available
      const defaultArgola = materials.find((m) => m.category === 'COMPONENT' && m.name.toLowerCase().includes('argola'));
      setProfileAdditionalItems(defaultArgola ? [{ materialId: defaultArgola.id, quantity: '1' }] : []);

      const defaultSaquinho = materials.find((m) => m.category === 'PACKAGING' && m.name.toLowerCase().includes('saquinho'));
      const defaultEtiqueta = materials.find((m) => m.category === 'PACKAGING' && m.name.toLowerCase().includes('etiqueta'));
      const packInit: ProfileMaterialItem[] = [];
      if (defaultSaquinho) packInit.push({ materialId: defaultSaquinho.id, quantity: '1' });
      if (defaultEtiqueta) packInit.push({ materialId: defaultEtiqueta.id, quantity: '1' });
      setProfilePackagingItems(packInit);
    }
    setShowProfileModal(true);
  };

  // Live calculation for the Profile modal
  const selectedPrinter = printers.find((p) => p.id === profilePrinterId) || printers[0];
  const printerHourlyCost = selectedPrinter ? Number(selectedPrinter.machineCostPerHour) : 0.35;
  const totalModalSeconds = (Number(profileTimeMinutes) || 0) * 60 + (Number(profileTimeSeconds) || 0);
  const modalHours = totalModalSeconds / 3600;
  const liveMachineCost = modalHours * printerHourlyCost;
  const minsModal = Math.floor(totalModalSeconds / 60);
  const secsModal = totalModalSeconds % 60;
  const modalTimeFormatted = `${minsModal}m${secsModal < 10 ? '0' : ''}${secsModal}s`;

  const selectedFilament = materials.find((m) => m.id === profileFilamentId);
  const filamentRate = selectedFilament ? Number(selectedFilament.costPerUnit) : 0.09;
  const liveFilamentCost = (Number(profileFilamentQty) || 0) * filamentRate;

  const liveAdditionalCost = profileAdditionalItems.reduce((acc, item) => {
    const mat = materials.find((m) => m.id === item.materialId);
    if (!mat) return acc;
    return acc + (Number(item.quantity) || 0) * Number(mat.costPerUnit);
  }, 0);

  const livePackagingCost = profilePackagingItems.reduce((acc, item) => {
    const mat = materials.find((m) => m.id === item.materialId);
    if (!mat) return acc;
    return acc + (Number(item.quantity) || 0) * Number(mat.costPerUnit);
  }, 0);

  // Round currency helper for matching exact display totals
  const roundCurr = (n: number) => Math.round(n * 100 + 0.00001) / 100;
  const dispFilament = roundCurr(liveFilamentCost);
  const dispMachine = roundCurr(liveMachineCost);
  const dispAdditional = roundCurr(liveAdditionalCost);
  const dispPackaging = roundCurr(livePackagingCost);
  const liveTotalProductionCost = roundCurr(dispFilament + dispMachine + dispAdditional + dispPackaging);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileProductId) {
      alert('Selecione um produto');
      return;
    }

    const compiledMaterials: Array<{ materialId: string; quantity: number; unit?: any }> = [];
    if (profileFilamentId && Number(profileFilamentQty) > 0) {
      compiledMaterials.push({
        materialId: profileFilamentId,
        quantity: Number(profileFilamentQty),
        unit: 'GRAM',
      });
    }

    profileAdditionalItems.forEach((item) => {
      if (item.materialId && Number(item.quantity) > 0) {
        const mat = materials.find((m) => m.id === item.materialId);
        compiledMaterials.push({
          materialId: item.materialId,
          quantity: Number(item.quantity),
          unit: mat?.unit || 'PIECE',
        });
      }
    });

    profilePackagingItems.forEach((item) => {
      if (item.materialId && Number(item.quantity) > 0) {
        const mat = materials.find((m) => m.id === item.materialId);
        compiledMaterials.push({
          materialId: item.materialId,
          quantity: Number(item.quantity),
          unit: mat?.unit || 'PIECE',
        });
      }
    });

    try {
      if (editingProfileId) {
        await fetchApi(`/admin/production/profiles/${editingProfileId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            printerId: profilePrinterId || undefined,
            productionTimeSeconds: totalModalSeconds,
            productionTimeMinutes: Math.round(totalModalSeconds / 60),
            materials: compiledMaterials,
          }),
        });
      } else {
        await fetchApi('/admin/production/profiles', {
          method: 'POST',
          body: JSON.stringify({
            productId: profileProductId,
            printerId: profilePrinterId || undefined,
            productionTimeSeconds: totalModalSeconds,
            productionTimeMinutes: Math.round(totalModalSeconds / 60),
            materials: compiledMaterials,
          }),
        });
      }

      setShowProfileModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar ficha técnica');
    }
  };

  // Job handlers
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
          name: newPrinterName.trim(),
          model: newPrinterModel.trim(),
          location: newPrinterLocation.trim() || undefined,
          machineCostPerHour: Number(newPrinterCost),
        }),
      });
      setShowPrinterModal(false);
      setNewPrinterName('');
      setNewPrinterModel('');
      setNewPrinterLocation('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar impressora');
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

  const filteredMaterials = materials.filter((m) => {
    if (materialFilterCategory === 'ARCHIVED') return !m.isActive;
    if (!m.isActive) return false;
    if (materialFilterCategory === 'ALL') return true;
    return m.category === materialFilterCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white">
              F7: Produção & Custos Reais
            </span>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              Cálculo Bambu Studio Integrado
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
            Ficha Técnica, Materiais & Produção 3D
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Apuração exata de custo: Filamento + Máquina + Materiais Adicionais + Embalagem = Custo Total de Produção
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'profiles' && (
            <button
              onClick={() => handleOpenNewProfileModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Nova Ficha Técnica
            </button>
          )}
          {activeTab === 'materials' && (
            <button
              onClick={handleOpenNewMaterialModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Cadastrar Material
            </button>
          )}
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 gap-6 mb-6 overflow-x-auto">
        {[
          { id: 'profiles', label: `Fichas Técnicas (${profiles.length})`, icon: Sparkles },
          { id: 'materials', label: `Materiais & Embalagem (${materials.length})`, icon: Layers },
          { id: 'jobs', label: `Fila de Produção (${jobs.length})`, icon: Cpu },
          { id: 'printers', label: `Impressoras (${printers.length})`, icon: Wrench },
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

      {/* TAB: PROFILES (FICHAS TÉCNICAS) */}
      {activeTab === 'profiles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((prof) => {
              const estimate = profileEstimates[prof.id];
              const totalSec = prof.productionTimeSeconds || (prof.productionTimeMinutes * 60);
              const mins = Math.floor(totalSec / 60);
              const secs = totalSec % 60;
              const formattedTime = `${mins}m${secs < 10 ? '0' : ''}${secs}s`;

              return (
                <div key={prof.id} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm hover:border-amber-300 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                        Ficha Ativa F7
                      </span>
                      <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                        <Clock size={12} /> {formattedTime}
                      </span>
                    </div>

                    <h3 className="font-serif font-bold text-zinc-900 text-lg mb-1">
                      {prof.product?.name || 'Ficha Sem Produto'}
                    </h3>
                    <div className="text-xs text-zinc-500 mb-4 font-mono">
                      SKU: {prof.product?.sku || '-'} | Impressora: {prof.printer?.model || prof.printer?.name || 'A1 Mini'}
                    </div>

                    {/* Breakdown de Custos F7 */}
                    <div className="space-y-2 text-xs bg-zinc-50 p-3.5 rounded-xl border border-zinc-100 mb-4">
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Filamento:</span>
                        <span className="font-semibold text-zinc-900">
                          R$ {estimate ? Number(estimate.filamentCost).toFixed(2) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Máquina:</span>
                        <span className="font-semibold text-zinc-900">
                          R$ {estimate ? Number(estimate.machineCost).toFixed(2) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Materiais Adicionais:</span>
                        <span className="font-semibold text-zinc-900">
                          R$ {estimate ? Number(estimate.additionalMaterialsCost).toFixed(2) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Embalagem:</span>
                        <span className="font-semibold text-zinc-900">
                          R$ {estimate ? Number(estimate.packagingCost).toFixed(2) : '-'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-zinc-200 flex justify-between items-center text-sm font-bold">
                        <span className="text-zinc-900">CUSTO TOTAL DE PRODUÇÃO:</span>
                        <span className="text-emerald-700">
                          R$ {estimate ? Number(estimate.totalCost).toFixed(2) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {prof.materials?.length || 0} material(is) vinculado(s)
                    </span>
                    <button
                      onClick={() => handleOpenNewProfileModal(prof)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition"
                    >
                      <Edit2 size={13} /> Editar Ficha Técnica
                    </button>
                  </div>
                </div>
              );
            })}

            {profiles.length === 0 && (
              <div className="col-span-full py-16 text-center text-zinc-500 bg-white border border-dashed border-zinc-300 rounded-2xl">
                <Sparkles size={32} className="mx-auto text-zinc-400 mb-2" />
                <p className="font-semibold text-zinc-800">Nenhuma ficha técnica cadastrada ainda</p>
                <p className="text-xs text-zinc-500 mt-1 mb-4">
                  Cadastre o consumo de filamento, tempo do Bambu Studio e materiais adicionais para apurar o custo F7.
                </p>
                <button
                  onClick={() => handleOpenNewProfileModal()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl"
                >
                  <Plus size={14} /> Cadastrar Ficha Técnica
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: MATERIALS */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Classification Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: 'Todos os Materiais' },
              { id: 'PRODUCTION', label: 'Material de Produção (Filamento)' },
              { id: 'COMPONENT', label: 'Componentes Adicionais' },
              { id: 'PACKAGING', label: 'Embalagem' },
              { id: 'ARCHIVED', label: 'Arquivados / Desativados' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setMaterialFilterCategory(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  materialFilterCategory === f.id
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Material</th>
                  <th className="px-6 py-3.5">Classificação</th>
                  <th className="px-6 py-3.5">Unidade</th>
                  <th className="px-6 py-3.5">Custo p/ Unidade</th>
                  <th className="px-6 py-3.5">Saldo em Estoque</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredMaterials.map((m) => {
                  const isLow = Number(m.currentQuantity) <= Number(m.minimumQuantity);
                  const unitDisplay = 
                    m.unit === 'GRAM' ? 'g (Grama)' :
                    m.unit === 'PIECE' || (m.unit as any) === 'UNIT' ? 'un (Unidade)' :
                    m.unit === 'METER' ? 'm (Metro)' : 'kg';

                  const categoryLabel =
                    m.category === 'PRODUCTION' ? 'Material de Produção' :
                    m.category === 'COMPONENT' ? 'Componente Adicional' :
                    m.category === 'PACKAGING' ? 'Embalagem' : 'Produção';

                  return (
                    <tr key={m.id} className={`hover:bg-zinc-50/60 transition ${!m.isActive ? 'bg-zinc-50/40 opacity-75' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-zinc-900">{m.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">
                          Tipo: {m.type} {m.color ? `| Cor: ${m.color}` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          m.category === 'PRODUCTION'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : m.category === 'COMPONENT'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {categoryLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-zinc-700">
                        {unitDisplay}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-zinc-900">
                        R$ {Number(m.costPerUnit).toFixed(4)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-zinc-900'}`}>
                          {Number(m.currentQuantity).toFixed(1)}
                        </span>
                        {isLow && m.isActive && (
                          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800">
                            Estoque Baixo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {m.isActive ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-200 text-zinc-700">
                            Arquivado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditMaterialModal(m)}
                            className="p-1.5 hover:bg-zinc-100 text-zinc-700 rounded-lg transition"
                            title="Editar Material"
                          >
                            <Edit2 size={15} />
                          </button>
                          {m.isActive ? (
                            <button
                              onClick={() => handleArchiveOrDeleteMaterial(m)}
                              className="p-1.5 hover:bg-amber-50 text-amber-700 rounded-lg transition"
                              title="Arquivar / Desativar com Segurança"
                            >
                              <Archive size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchiveOrDeleteMaterial(m)}
                              className="p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition"
                              title="Reativar Material"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredMaterials.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-zinc-500">
                      Nenhum material encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* MODAL: FICHA TÉCNICA (CRIAR E EDITAR) */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-6">
              <div>
                <h3 className="text-xl font-serif font-bold text-zinc-900">
                  {editingProfileId ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Preencha os dados do Bambu Studio, componentes adicionais e embalagem
                </p>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Produto */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Produto Canônico
                </label>
                <select
                  required
                  disabled={!!editingProfileId}
                  value={profileProductId}
                  onChange={(e) => setProfileProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none disabled:bg-zinc-50"
                >
                  <option value="">Selecione o produto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || 'Sem SKU'})
                    </option>
                  ))}
                </select>
              </div>

              {/* SEÇÃO 1: IMPRESSÃO */}
              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                      1. Impressão (Bambu Studio)
                    </h4>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500">
                    Subtotal: R$ {(dispFilament + dispMachine).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Impressora</label>
                    <select
                      value={profilePrinterId}
                      onChange={(e) => setProfilePrinterId(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                    >
                      {printers.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.name} ({pr.model}) — R$ {Number(pr.machineCostPerHour).toFixed(2)}/h
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">
                      Tempo de Impressão (Minutos e Segundos)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <input
                          type="number"
                          min="0"
                          placeholder="min"
                          value={profileTimeMinutes}
                          onChange={(e) => setProfileTimeMinutes(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-400">m</span>
                      <div className="w-20">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="seg"
                          value={profileTimeSeconds}
                          onChange={(e) => setProfileTimeSeconds(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-400">s</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">
                      Material Principal (Filamento)
                    </label>
                    <select
                      value={profileFilamentId}
                      onChange={(e) => setProfileFilamentId(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                    >
                      <option value="">Selecione o filamento...</option>
                      {materials
                        .filter((m) => m.category === 'PRODUCTION' || ['PLA', 'PETG', 'ABS', 'RESIN'].includes(m.type))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (R$ {Number(m.costPerUnit).toFixed(4)}/g)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">
                      Consumo em Gramas (g)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="ex: 12.64"
                      value={profileFilamentQty}
                      onChange={(e) => setProfileFilamentQty(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-200">
                  <span>Custo Filamento: <strong className="text-zinc-800">R$ {dispFilament.toFixed(2)}</strong></span>
                  <span>Custo Máquina: <strong className="text-zinc-800">R$ {dispMachine.toFixed(2)}</strong></span>
                </div>
              </div>

              {/* SEÇÃO 2: MATERIAIS ADICIONAIS */}
              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                      2. Materiais Adicionais (Argolas, Ímãs, Parafusos)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileAdditionalItems([...profileAdditionalItems, { materialId: '', quantity: '1' }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800"
                  >
                    <Plus size={14} /> Adicionar Material
                  </button>
                </div>

                {profileAdditionalItems.length === 0 && (
                  <p className="text-xs text-zinc-400 italic py-1">
                    Nenhum componente adicional vinculado. (Opcional)
                  </p>
                )}

                <div className="space-y-2.5">
                  {profileAdditionalItems.map((item, idx) => {
                    const mat = materials.find((m) => m.id === item.materialId);
                    const cost = mat ? (Number(item.quantity) || 0) * Number(mat.costPerUnit) : 0;

                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <select
                          value={item.materialId}
                          onChange={(e) => {
                            const updated = [...profileAdditionalItems];
                            updated[idx].materialId = e.target.value;
                            setProfileAdditionalItems(updated);
                          }}
                          className="flex-1 px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                        >
                          <option value="">Selecione o componente...</option>
                          {materials
                            .filter((m) => m.category === 'COMPONENT' || m.unit === 'PIECE' || m.unit === 'METER')
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} (R$ {Number(m.costPerUnit).toFixed(2)}/{m.unit.toLowerCase()})
                              </option>
                            ))}
                        </select>

                        <div className="w-24">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...profileAdditionalItems];
                              updated[idx].quantity = e.target.value;
                              setProfileAdditionalItems(updated);
                            }}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                          />
                        </div>

                        <span className="w-20 text-xs font-semibold text-zinc-700 text-right">
                          R$ {cost.toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = profileAdditionalItems.filter((_, i) => i !== idx);
                            setProfileAdditionalItems(updated);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO 3: EMBALAGEM */}
              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                      3. Embalagem (Saquinhos, Caixas, Etiquetas)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfilePackagingItems([...profilePackagingItems, { materialId: '', quantity: '1' }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus size={14} /> Adicionar Embalagem
                  </button>
                </div>

                {profilePackagingItems.length === 0 && (
                  <p className="text-xs text-zinc-400 italic py-1">
                    Nenhum material de embalagem vinculado. (Opcional)
                  </p>
                )}

                <div className="space-y-2.5">
                  {profilePackagingItems.map((item, idx) => {
                    const mat = materials.find((m) => m.id === item.materialId);
                    const cost = mat ? (Number(item.quantity) || 0) * Number(mat.costPerUnit) : 0;

                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <select
                          value={item.materialId}
                          onChange={(e) => {
                            const updated = [...profilePackagingItems];
                            updated[idx].materialId = e.target.value;
                            setProfilePackagingItems(updated);
                          }}
                          className="flex-1 px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                        >
                          <option value="">Selecione a embalagem...</option>
                          {materials
                            .filter((m) => m.category === 'PACKAGING' || m.name.toLowerCase().includes('saquinho') || m.name.toLowerCase().includes('etiqueta'))
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} (R$ {Number(m.costPerUnit).toFixed(2)}/{m.unit.toLowerCase()})
                              </option>
                            ))}
                        </select>

                        <div className="w-24">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...profilePackagingItems];
                              updated[idx].quantity = e.target.value;
                              setProfilePackagingItems(updated);
                            }}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm bg-white"
                          />
                        </div>

                        <span className="w-20 text-xs font-semibold text-zinc-700 text-right">
                          R$ {cost.toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = profilePackagingItems.filter((_, i) => i !== idx);
                            setProfilePackagingItems(updated);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO 4: RESUMO & CUSTO TOTAL */}
              <div className="bg-zinc-900 text-white rounded-2xl p-5 shadow-lg">
                <div className="text-xs uppercase font-bold tracking-wider text-zinc-400 mb-3 pb-2 border-b border-zinc-800">
                  Resumo do Custo de Produção (F7)
                </div>
                <div className="space-y-1.5 text-xs text-zinc-300">
                  <div className="flex justify-between">
                    <span>Filamento:</span>
                    <span className="font-mono text-zinc-100">R$ {dispFilament.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Máquina ({modalTimeFormatted} @ R$ {printerHourlyCost.toFixed(2)}/h):</span>
                    <span className="font-mono text-zinc-100">R$ {dispMachine.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Materiais adicionais:</span>
                    <span className="font-mono text-zinc-100">R$ {dispAdditional.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Embalagem:</span>
                    <span className="font-mono text-zinc-100">R$ {dispPackaging.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 mt-3 flex justify-between items-center">
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-amber-400 block">
                      Custo Total de Produção
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Base oficial enviada ao Motor de Precificação F12
                    </span>
                  </div>
                  <span className="text-2xl font-serif font-bold text-white">
                    R$ {liveTotalProductionCost.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition shadow-sm flex items-center gap-2"
                >
                  <Check size={16} /> Salvar Ficha Técnica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR MATERIAL */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-1">
              {editingMaterialId ? 'Editar Material' : 'Cadastrar Material'}
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Defina a classificação (produção, componente ou embalagem) e o custo unitário exato.
            </p>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                  Classificação do Material
                </label>
                <select
                  value={materialCategory}
                  onChange={(e) => setMaterialCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="PRODUCTION">Material de Produção (Filamento / Resina)</option>
                  <option value="COMPONENT">Componente Adicional (Argola, Ímã, Parafuso)</option>
                  <option value="PACKAGING">Embalagem (Saquinho, Caixa, Etiqueta)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Nome do Material</label>
                <input
                  type="text"
                  required
                  placeholder="ex: PLA Rosa Claro, Argola de Chaveiro..."
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Tipo</label>
                  <select
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="PLA">PLA</option>
                    <option value="PETG">PETG</option>
                    <option value="ABS">ABS</option>
                    <option value="RESIN">Resina</option>
                    <option value="OTHER">Outro / Componente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Unidade</label>
                  <select
                    value={materialUnit}
                    onChange={(e) => setMaterialUnit(e.target.value as any)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="GRAM">g (Grama)</option>
                    <option value="PIECE">un (Unidade)</option>
                    <option value="METER">m (Metro)</option>
                    <option value="KILOGRAM">kg (Quilograma)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                    Custo por Unidade (R$)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    placeholder="0.0900"
                    value={materialCost}
                    onChange={(e) => setMaterialCost(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-mono font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Ex: 90/kg = 0.0900/g</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Cor (opcional)</label>
                  <input
                    type="text"
                    placeholder="Rosa Claro"
                    value={materialColor}
                    onChange={(e) => setMaterialColor(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {!editingMaterialId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Estoque Inicial</label>
                    <input
                      type="number"
                      required
                      value={materialQty}
                      onChange={(e) => setMaterialQty(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Estoque Mínimo</label>
                    <input
                      type="number"
                      required
                      value={materialMin}
                      onChange={(e) => setMaterialMin(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              )}

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
                  {editingMaterialId ? 'Salvar Alterações' : 'Cadastrar Material'}
                </button>
              </div>
            </form>
          </div>
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
                  placeholder="ex: Bambu Lab A1 Mini"
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
                  placeholder="ex: A1 Mini, X1-Carbon"
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
                    step="0.01"
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
    </div>
  );
};
