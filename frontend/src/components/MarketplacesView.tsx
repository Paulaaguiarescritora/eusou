import React, { useState, useEffect } from 'react';
import {
  Channel,
  ChannelAccount,
  ChannelProduct,
  ChannelSyncLog,
  ChannelCategoryMapping,
  Product,
  Category,
} from '../types';

interface MarketplacesViewProps {
  token: string;
}

export const MarketplacesView: React.FC<MarketplacesViewProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'channels' | 'accounts' | 'products' | 'categories' | 'logs'
  >('dashboard');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados de dados
  const [dashboard, setDashboard] = useState<{
    totalChannels: number;
    activeAccounts: number;
    publishedProducts: number;
    totalLogs: number;
    recentLogs: ChannelSyncLog[];
  } | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [channelProducts, setChannelProducts] = useState<ChannelProduct[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<ChannelCategoryMapping[]>([]);
  const [logs, setLogs] = useState<ChannelSyncLog[]>([]);

  // Dados auxiliares para selects
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Formulários Modais / Criação
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelForm, setChannelForm] = useState({
    name: '',
    type: 'MERCADO_LIVRE',
    description: '',
  });

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    channelId: '',
    name: '',
    externalAccountId: '',
  });

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({
    productId: '',
    channelAccountId: '',
    priceOverride: '',
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    channelId: '',
    categoryId: '',
    externalCategoryId: '',
    externalCategoryName: '',
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    return fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await fetchWithAuth('/admin/marketplaces/dashboard');
        if (res.ok) setDashboard(await res.json());
      } else if (activeTab === 'channels') {
        const res = await fetchWithAuth('/admin/marketplaces/channels');
        if (res.ok) setChannels(await res.json());
      } else if (activeTab === 'accounts') {
        const [accRes, chanRes] = await Promise.all([
          fetchWithAuth('/admin/marketplaces/accounts'),
          fetchWithAuth('/admin/marketplaces/channels'),
        ]);
        if (accRes.ok) setAccounts(await accRes.json());
        if (chanRes.ok) setChannels(await chanRes.json());
      } else if (activeTab === 'products') {
        const [cpRes, accRes, prodRes] = await Promise.all([
          fetchWithAuth('/admin/marketplaces/products'),
          fetchWithAuth('/admin/marketplaces/accounts'),
          fetchWithAuth('/products?limit=100'),
        ]);
        if (cpRes.ok) setChannelProducts(await cpRes.json());
        if (accRes.ok) setAccounts(await accRes.json());
        if (prodRes.ok) {
          const pData = await prodRes.json();
          setProducts(Array.isArray(pData) ? pData : pData.items || []);
        }
      } else if (activeTab === 'categories') {
        const [catMapRes, chanRes, catRes] = await Promise.all([
          fetchWithAuth('/admin/marketplaces/categories'),
          fetchWithAuth('/admin/marketplaces/channels'),
          fetchWithAuth('/categories'),
        ]);
        if (catMapRes.ok) setCategoryMappings(await catMapRes.json());
        if (chanRes.ok) setChannels(await chanRes.json());
        if (catRes.ok) setCategories(await catRes.json());
      } else if (activeTab === 'logs') {
        const res = await fetchWithAuth('/admin/marketplaces/logs');
        if (res.ok) setLogs(await res.json());
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Erro ao carregar dados: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Ações
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/admin/marketplaces/channels', {
        method: 'POST',
        body: JSON.stringify(channelForm),
      });
      if (!res.ok) throw new Error('Falha ao criar canal');
      setMessage({ type: 'success', text: 'Canal configurado com sucesso!' });
      setShowChannelModal(false);
      setChannelForm({ name: '', type: 'MERCADO_LIVRE', description: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/admin/marketplaces/accounts', {
        method: 'POST',
        body: JSON.stringify(accountForm),
      });
      if (!res.ok) throw new Error('Falha ao vincular conta de canal');
      setMessage({ type: 'success', text: 'Conta vinculada com sucesso!' });
      setShowAccountModal(false);
      setAccountForm({ channelId: '', name: '', externalAccountId: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleTestConnection = async (accountId: string) => {
    try {
      const res = await fetchWithAuth(`/admin/marketplaces/accounts/${accountId}/test-connection`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Conexão bem-sucedida! ${data.message}` });
      } else {
        setMessage({ type: 'error', text: `Falha no teste: ${data.message}` });
      }
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handlePublishProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        productId: publishForm.productId,
        channelAccountId: publishForm.channelAccountId,
      };
      if (publishForm.priceOverride) {
        payload.priceOverride = parseFloat(publishForm.priceOverride);
      }

      const res = await fetchWithAuth('/admin/marketplaces/publish', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.result?.success) {
        throw new Error(data.result?.message || 'Falha na publicação');
      }
      setMessage({
        type: 'success',
        text: `Produto publicado com sucesso! ID Externo: ${data.result.externalProductId}`,
      });
      setShowPublishModal(false);
      setPublishForm({ productId: '', channelAccountId: '', priceOverride: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSyncPrice = async (cpId: string) => {
    try {
      const res = await fetchWithAuth(`/admin/marketplaces/products/${cpId}/sync-price`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSyncStock = async (cpId: string) => {
    try {
      const res = await fetchWithAuth(`/admin/marketplaces/products/${cpId}/sync-stock`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleValidateProduct = async () => {
    if (!publishForm.productId || !publishForm.channelAccountId) {
      setMessage({ type: 'error', text: 'Selecione um produto e uma conta para validar.' });
      return;
    }
    try {
      const payload: any = {
        productId: publishForm.productId,
        channelAccountId: publishForm.channelAccountId,
      };
      if (publishForm.priceOverride) {
        payload.priceOverride = parseFloat(publishForm.priceOverride);
      }
      const res = await fetchWithAuth('/admin/marketplaces/validate-product', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.isValid) {
        setMessage({
          type: 'success',
          text: `VALIDADO COM SUCESSO: Produto "${data.productName}" está 100% elegível para publicação no ${data.channelName}.`,
        });
      } else {
        setMessage({
          type: 'error',
          text: `NÃO PUBLICÁVEL: ${data.errors?.join(' | ')}`,
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleStartMLOAuth = async (accountId?: string) => {
    try {
      const endpoint = accountId
        ? `/admin/marketplaces/mercadolivre/auth-url?channelAccountId=${accountId}`
        : '/admin/marketplaces/mercadolivre/auth-url';
      const res = await fetchWithAuth(endpoint);
      const data = await res.json();
      if (data.url) {
        // Abre popup ou solicita inserção do authorization code
        const codePrompt = window.prompt(
          `Para autorizar o Mercado Livre, acesse o link de autenticação oficial:\n\n${data.url}\n\nApós autorizar no navegador, cole aqui o código retornado na URL (parâmetro 'code'):`,
        );
        if (codePrompt) {
          const completeRes = await fetchWithAuth(
            '/admin/marketplaces/mercadolivre/complete-oauth',
            {
              method: 'POST',
              body: JSON.stringify({
                code: codePrompt.trim(),
                channelAccountId: accountId,
              }),
            },
          );
          if (completeRes.ok) {
            setMessage({
              type: 'success',
              text: 'Conta do Mercado Livre autorizada e conectada com sucesso!',
            });
            loadData();
          } else {
            const errData = await completeRes.json();
            throw new Error(errData.message || 'Falha ao concluir autorização.');
          }
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    if (!window.confirm('Deseja realmente desconectar esta conta do marketplace?')) return;
    try {
      const res = await fetchWithAuth(`/admin/marketplaces/accounts/${accountId}/disconnect`, {
        method: 'POST',
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Conta desconectada com sucesso.' });
        loadData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSyncProductDetails = async (cpId: string) => {
    try {
      const res = await fetchWithAuth(`/admin/marketplaces/products/${cpId}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleUnpublish = async (cpId: string) => {
    if (!window.confirm('Deseja realmente despublicar/pausar este anúncio no marketplace?')) return;
    try {
      const res = await fetchWithAuth(`/admin/marketplaces/products/${cpId}/unpublish`, {
        method: 'POST',
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Produto despublicado com sucesso.' });
        loadData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleMapCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/admin/marketplaces/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm),
      });
      if (!res.ok) throw new Error('Falha ao mapear categoria');
      setMessage({ type: 'success', text: 'Categoria mapeada com sucesso!' });
      setShowCategoryModal(false);
      setCategoryForm({
        channelId: '',
        categoryId: '',
        externalCategoryId: '',
        externalCategoryName: '',
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplaces e Canais</h1>
          <p className="text-sm text-gray-500">
            Arquitetura multicanal e integração com marketplaces externos (Mercado Livre, Shopee, Amazon, etc.)
          </p>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {message && (
        <div
          className={`p-4 rounded-md flex justify-between items-center ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-sm underline font-medium ml-4"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Visão Geral' },
            { id: 'channels', label: 'Canais' },
            { id: 'accounts', label: 'Contas Vinculadas' },
            { id: 'products', label: 'Produtos Publicados' },
            { id: 'categories', label: 'Mapeamento de Categorias' },
            { id: 'logs', label: 'Logs de Sincronização' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && (
        <div className="py-8 text-center text-gray-500">Carregando dados de marketplaces...</div>
      )}

      {/* 1. ABA DASHBOARD */}
      {!loading && activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase">Canais Ativos</span>
              <p className="text-3xl font-bold text-gray-900 mt-2">{dashboard.totalChannels}</p>
            </div>
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase">Contas Conectadas</span>
              <p className="text-3xl font-bold text-green-600 mt-2">{dashboard.activeAccounts}</p>
            </div>
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase">Produtos Publicados</span>
              <p className="text-3xl font-bold text-indigo-600 mt-2">{dashboard.publishedProducts}</p>
            </div>
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase">Sincronizações Realizadas</span>
              <p className="text-3xl font-bold text-gray-700 mt-2">{dashboard.totalLogs}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Últimas Atividades de Sincronização</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="px-4 py-2">Canal / Conta</th>
                    <th className="px-4 py-2">Operação</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Mensagem</th>
                    <th className="px-4 py-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboard.recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {log.channelAccount?.name} ({log.channelAccount?.channel?.name})
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                          {log.operation}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            log.status === 'SUCCESS'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{log.message}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                  {dashboard.recentLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        Nenhum log registrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA CANAIS */}
      {!loading && activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Canais Suportados</h2>
            <button
              onClick={() => setShowChannelModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              + Novo Canal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {channels.map((chan) => (
              <div key={chan.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{chan.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      chan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {chan.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{chan.description || 'Canal de distribuição padrão'}</p>
                <div className="pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-600">
                  <span>Tipo: <strong className="text-gray-900">{chan.type}</strong></span>
                  <span>Contas: <strong className="text-gray-900">{chan._count?.accounts || 0}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ABA CONTAS */}
      {!loading && activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Contas Conectadas aos Canais</h2>
            <button
              onClick={() => setShowAccountModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              + Conectar Conta
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Nome da Conta</th>
                  <th className="px-6 py-3">Canal</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Última Sincronização</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="px-6 py-4 font-medium text-gray-900">{acc.name}</td>
                    <td className="px-6 py-4 text-gray-600">{acc.channel?.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          acc.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : acc.status === 'ERROR'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {acc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {acc.channel?.type === 'MERCADO_LIVRE' && acc.status !== 'ACTIVE' && (
                        <button
                          onClick={() => handleStartMLOAuth(acc.id)}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-3 py-1.5 rounded"
                        >
                          Autorizar OAuth
                        </button>
                      )}
                      <button
                        onClick={() => handleTestConnection(acc.id)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded"
                      >
                        Testar Ping
                      </button>
                      {acc.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleDisconnectAccount(acc.id)}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1.5 rounded"
                        >
                          Desconectar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-gray-400">
                      Nenhuma conta conectada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ABA PRODUTOS PUBLICADOS */}
      {!loading && activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Produtos Publicados em Canais</h2>
            <button
              onClick={() => setShowPublishModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              + Publicar Produto em Canal
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Produto Interno</th>
                  <th className="px-6 py-3">Canal / Conta</th>
                  <th className="px-6 py-3">ID / Link Externo</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Preço Canal</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {channelProducts.map((cp) => (
                  <tr key={cp.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{cp.product?.name}</div>
                      <div className="text-xs text-gray-500">SKU: {cp.product?.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {cp.channelAccount?.name} ({cp.channelAccount?.channel?.name})
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {cp.externalUrl ? (
                        <a
                          href={cp.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {cp.externalProductId || 'Ver Anúncio'}
                        </a>
                      ) : (
                        cp.externalProductId || '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          cp.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : cp.status === 'ERROR'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {cp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      R$ {Number(cp.priceOverride || cp.product?.basePrice || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleSyncProductDetails(cp.id)}
                        className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded"
                        title="Verificar integridade do anúncio no marketplace"
                      >
                        Sinc. Anúncio
                      </button>
                      <button
                        onClick={() => handleSyncPrice(cp.id)}
                        className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded"
                      >
                        Sinc. Preço
                      </button>
                      <button
                        onClick={() => handleSyncStock(cp.id)}
                        className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-1 rounded"
                      >
                        Sinc. Estoque
                      </button>
                      {cp.status === 'PUBLISHED' && (
                        <button
                          onClick={() => handleUnpublish(cp.id)}
                          className="text-xs bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded"
                        >
                          Despublicar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {channelProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-gray-400">
                      Nenhum produto publicado em canais externos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. ABA MAPEAMENTO DE CATEGORIAS */}
      {!loading && activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Mapeamento de Categorias de Marketplace</h2>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              + Novo Mapeamento
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Canal</th>
                  <th className="px-6 py-3">Categoria Interna</th>
                  <th className="px-6 py-3">ID Externo</th>
                  <th className="px-6 py-3">Nome Externo da Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categoryMappings.map((cm) => (
                  <tr key={cm.id}>
                    <td className="px-6 py-4 font-medium text-gray-900">{cm.channel?.name}</td>
                    <td className="px-6 py-4 text-gray-600">{cm.category?.name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{cm.externalCategoryId}</td>
                    <td className="px-6 py-4 text-gray-800">{cm.externalCategoryName}</td>
                  </tr>
                ))}
                {categoryMappings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-gray-400">
                      Nenhum mapeamento de categoria cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. ABA LOGS */}
      {!loading && activeTab === 'logs' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Histórico de Sincronizações</h2>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3">Conta de Canal</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Operação</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duração</th>
                  <th className="px-4 py-3">Detalhes / Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {log.channelAccount?.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.channelProduct?.product?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                        {log.operation}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          log.status === 'SUCCESS'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {log.durationMs ? `${log.durationMs}ms` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{log.message}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                      Nenhum log encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CANAL */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Novo Canal de Distribuição</h3>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome do Canal</label>
                <input
                  type="text"
                  required
                  value={channelForm.name}
                  onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: Mercado Livre Oficial"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Canal</label>
                <select
                  value={channelForm.type}
                  onChange={(e) => setChannelForm({ ...channelForm, type: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="MERCADO_LIVRE">Mercado Livre</option>
                  <option value="SHOPEE">Shopee</option>
                  <option value="AMAZON">Amazon</option>
                  <option value="MAGALU">Magazine Luiza</option>
                  <option value="TIKTOK_SHOP">TikTok Shop</option>
                  <option value="GOOGLE_MERCHANT">Google Merchant</option>
                  <option value="OWN_STORE">Loja Própria</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Descrição</label>
                <textarea
                  value={channelForm.description}
                  onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >
                  Salvar Canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONECTAR CONTA */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Conectar Conta de Marketplace</h3>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Canal</label>
                <select
                  required
                  value={accountForm.channelId}
                  onChange={(e) => setAccountForm({ ...accountForm, channelId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Selecione um canal...</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome de Identificação da Conta</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: Conta ML Filial SP"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ID da Conta no Marketplace (Opcional)</label>
                <input
                  type="text"
                  value={accountForm.externalAccountId}
                  onChange={(e) => setAccountForm({ ...accountForm, externalAccountId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: 12345678"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >
                  Conectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PUBLICAR PRODUTO */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Publicar Produto em Canal</h3>
            <form onSubmit={handlePublishProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Produto Interno</label>
                <select
                  required
                  value={publishForm.productId}
                  onChange={(e) => setPublishForm({ ...publishForm, productId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Selecione um produto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || 'Sem SKU'}) - R$ {Number(p.basePrice || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Conta de Canal</label>
                <select
                  required
                  value={publishForm.channelAccountId}
                  onChange={(e) => setPublishForm({ ...publishForm, channelAccountId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Selecione uma conta...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.channel?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Preço Específico para este Canal (Opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={publishForm.priceOverride}
                  onChange={(e) => setPublishForm({ ...publishForm, priceOverride: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Deixe em branco para usar o preço base"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleValidateProduct}
                  className="px-4 py-2 bg-amber-500 text-white rounded text-sm hover:bg-amber-600 font-medium"
                >
                  Validar Produto
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 font-medium"
                >
                  Publicar no Canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MAPEAMENTO DE CATEGORIA */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Mapear Categoria com Marketplace</h3>
            <form onSubmit={handleMapCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Canal</label>
                <select
                  required
                  value={categoryForm.channelId}
                  onChange={(e) => setCategoryForm({ ...categoryForm, channelId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Selecione o canal...</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Categoria Interna</label>
                <select
                  required
                  value={categoryForm.categoryId}
                  onChange={(e) => setCategoryForm({ ...categoryForm, categoryId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Selecione a categoria interna...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ID da Categoria no Marketplace</label>
                <input
                  type="text"
                  required
                  value={categoryForm.externalCategoryId}
                  onChange={(e) => setCategoryForm({ ...categoryForm, externalCategoryId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: MLB12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome Completo da Categoria Externa</label>
                <input
                  type="text"
                  required
                  value={categoryForm.externalCategoryName}
                  onChange={(e) => setCategoryForm({ ...categoryForm, externalCategoryName: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: Colecionáveis > Chaveiros Personalizados"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >
                  Salvar Mapeamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
