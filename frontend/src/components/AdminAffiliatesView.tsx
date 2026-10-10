import React, { useEffect, useState } from 'react';
import { Affiliate, CommissionRule } from '../types';
import { fetchApi } from '../api';
import { Users, Shield, Percent, Plus, CheckCircle, XCircle, Search, UserCheck } from 'lucide-react';

interface AdminAffiliatesViewProps {
  onNavigate: (route: string) => void;
}

export const AdminAffiliatesView: React.FC<AdminAffiliatesViewProps> = ({ onNavigate }) => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [activeTab, setActiveTab] = useState<'affiliates' | 'rules'>('affiliates');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Rule Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState<'GLOBAL' | 'AFFILIATE' | 'PRODUCT' | 'PRODUCT_AFFILIATE'>('GLOBAL');
  const [rulePercentage, setRulePercentage] = useState('10');
  const [rulePriority, setRulePriority] = useState('10');

  // New Affiliate Modal
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; email: string }[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const affRes = await fetchApi<Affiliate[]>('/affiliates');
      setAffiliates(affRes);

      const rulesRes = await fetchApi<CommissionRule[]>('/affiliates/rules');
      setRules(rulesRes);
    } catch (err) {
      console.error('Error fetching admin affiliate data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetchApi(`/affiliates/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status do afiliado');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/affiliates/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: ruleName,
          type: ruleType,
          percentage: Number(rulePercentage),
          priority: Number(rulePriority),
        }),
      });
      setShowRuleModal(false);
      setRuleName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar regra de comissão');
    }
  };

  const loadEligibleUsers = async (searchQuery?: string) => {
    setLoadingEligible(true);
    try {
      const q = searchQuery?.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : '';
      const users = await fetchApi<{ id: string; email: string }[]>(`/admin/affiliates/eligible-users${q}`);
      setEligibleUsers(Array.isArray(users) ? users : []);
    } catch (e) {
      console.error('Failed to load eligible users:', e);
      setEligibleUsers([]);
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleOpenAffiliateModal = () => {
    setNewUserId('');
    setNewDisplayName('');
    setNewCode('');
    setUserSearchText('');
    setShowAffiliateModal(true);
    loadEligibleUsers();
  };

  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId) {
      alert('Selecione um usuário cadastrado para credenciar como afiliado.');
      return;
    }
    try {
      await fetchApi('/affiliates', {
        method: 'POST',
        body: JSON.stringify({
          userId: newUserId,
          displayName: newDisplayName,
          code: newCode,
        }),
      });
      setShowAffiliateModal(false);
      setNewUserId('');
      setNewDisplayName('');
      setNewCode('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar afiliado');
    }
  };

  const filteredAffiliates = affiliates.filter(
    (a) =>
      a.displayName.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.user?.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white">
              Painel Administrativo
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
            Gestão de Afiliados e Comissões
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Acompanhe o credenciamento de parceiros, aprove status e defina regras percentuais de comissionamento
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'affiliates' ? (
            <button
              onClick={handleOpenAffiliateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <UserCheck size={16} /> Credenciar Afiliado
            </button>
          ) : (
            <button
              onClick={() => setShowRuleModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Plus size={16} /> Nova Regra
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 gap-6 mb-6">
        <button
          onClick={() => setActiveTab('affiliates')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'affiliates'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Users size={18} />
          Afiliados Credenciados ({affiliates.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'rules'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Percent size={18} />
          Regras de Comissão ({rules.length})
        </button>
      </div>

      {/* Tab: Affiliates */}
      {activeTab === 'affiliates' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-zinc-200 max-w-md">
            <Search size={18} className="text-zinc-400 ml-2" />
            <input
              type="text"
              placeholder="Buscar por nome, código ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            />
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Nome / Identificação</th>
                  <th className="px-6 py-3.5">Código Único</th>
                  <th className="px-6 py-3.5">Email Cadastrado</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredAffiliates.map((aff) => (
                  <tr key={aff.id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-6 py-4 font-semibold text-zinc-900">{aff.displayName}</td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-amber-700 bg-amber-50/50 w-fit rounded">
                      {aff.code}
                    </td>
                    <td className="px-6 py-4 text-zinc-600">{aff.user?.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          aff.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : aff.status === 'INACTIVE'
                            ? 'bg-zinc-100 text-zinc-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {aff.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {aff.status !== 'ACTIVE' && (
                          <button
                            onClick={() => handleStatusChange(aff.id, 'ACTIVE')}
                            className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-semibold transition"
                          >
                            Ativar
                          </button>
                        )}
                        {aff.status !== 'SUSPENDED' && (
                          <button
                            onClick={() => handleStatusChange(aff.id, 'SUSPENDED')}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold transition"
                          >
                            Suspender
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAffiliates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-zinc-500">
                      Nenhum afiliado encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Nome da Regra</th>
                  <th className="px-6 py-3.5">Tipo</th>
                  <th className="px-6 py-3.5">Comissão (%)</th>
                  <th className="px-6 py-3.5">Prioridade Hierárquica</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-6 py-4 font-semibold text-zinc-900">{rule.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded">
                        {rule.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-amber-700">{rule.percentage}%</td>
                    <td className="px-6 py-4 text-zinc-600 font-mono text-xs">{rule.priority}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        {rule.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-zinc-500">
                      Nenhuma regra cadastrada. (Uma taxa global padrão de 10% é aplicada por fallback).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Rule */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Adicionar Regra de Comissão</h3>
            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Nome</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Comissão Padrão 12%"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Tipo de Regra</label>
                <select
                  value={ruleType}
                  onChange={(e) => {
                    setRuleType(e.target.value as any);
                    if (e.target.value === 'PRODUCT_AFFILIATE') setRulePriority('50');
                    else if (e.target.value === 'PRODUCT') setRulePriority('30');
                    else if (e.target.value === 'AFFILIATE') setRulePriority('20');
                    else setRulePriority('10');
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="GLOBAL">GLOBAL (Prioridade 10)</option>
                  <option value="AFFILIATE">AFILIADO ESPECÍFICO (Prioridade 20)</option>
                  <option value="PRODUCT">PRODUTO ESPECÍFICO (Prioridade 30)</option>
                  <option value="PRODUCT_AFFILIATE">PRODUTO + AFILIADO (Prioridade 50)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Porcentagem (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="100"
                    required
                    value={rulePercentage}
                    onChange={(e) => setRulePercentage(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Prioridade</label>
                  <input
                    type="number"
                    required
                    value={rulePriority}
                    onChange={(e) => setRulePriority(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Credenciar Afiliado */}
      {showAffiliateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Credenciar Novo Afiliado</h3>
            <form onSubmit={handleCreateAffiliate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                  Usuário da Plataforma *
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Buscar por e-mail..."
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          loadEligibleUsers(userSearchText);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 border border-zinc-300 rounded-lg text-xs outline-none focus:border-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => loadEligibleUsers(userSearchText)}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold transition"
                    >
                      {loadingEligible ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>

                  <select
                    required
                    value={newUserId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setNewUserId(selectedId);
                      const found = eligibleUsers.find((u) => u.id === selectedId);
                      if (found && !newDisplayName) {
                        const defaultName = found.email.split('@')[0];
                        setNewDisplayName(defaultName);
                        if (!newCode) {
                          setNewCode(defaultName.toLowerCase().replace(/[^a-z0-9]+/g, ''));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                  >
                    <option value="">Selecione um usuário...</option>
                    {eligibleUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>

                  {eligibleUsers.length === 0 && !loadingEligible && (
                    <p className="text-[11px] text-zinc-500 italic">
                      Nenhum usuário sem vínculo de afiliado encontrado. Digite um e-mail acima para filtrar.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Nome de Exibição</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Maria Fragrâncias"
                  value={newDisplayName}
                  onChange={(e) => {
                    setNewDisplayName(e.target.value);
                    if (!newCode) {
                      setNewCode(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, ''));
                    }
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">Código de URL (Único)</label>
                <input
                  type="text"
                  required
                  placeholder="ex: maria"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAffiliateModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition"
                >
                  Credenciar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
