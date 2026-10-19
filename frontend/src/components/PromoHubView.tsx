import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { fetchApi } from '../api';
import {
  Share2,
  Search,
  Link as LinkIcon,
  MousePointer,
  CreditCard,
  Image as ImageIcon,
  MessageCircle,
  QrCode,
  Code,
  UserCheck,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface PromoHubViewProps {
  onNavigate?: (route: string) => void;
}

type PromoMode =
  | 'LINK'
  | 'BOTÃO'
  | 'CARD'
  | 'BANNER'
  | 'WHATSAPP'
  | 'QR CODE'
  | 'EMBED'
  | 'LINK DE AFILIADO';

export const PromoHubView: React.FC<PromoHubViewProps> = ({ onNavigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<PromoMode>('LINK');
  const [affiliateCode, setAffiliateCode] = useState('afiliado-oficial');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<{ data: Product[] }>('/products?limit=100')
      .then((res) => {
        const prods = res.data || [];
        setProducts(prods);
        if (prods.length > 0) {
          // Look for "Porta-Chaves Gatinho" or default to first product
          const found = prods.find((p) =>
            p.name.toLowerCase().includes('gatinho') ||
            p.name.toLowerCase().includes('porta-chaves')
          );
          setSelectedProduct(found || prods[0]);
        }
      })
      .catch((err) => console.error('Erro ao carregar produtos na Central de Divulgação:', err))
      .finally(() => setLoading(false));
  }, []);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const activeVariant = selectedProduct?.variants?.find((v) => v.id === selectedVariantId && v.isActive);
  const effectiveName = activeVariant?.name
    ? `${selectedProduct?.name} - ${activeVariant.name}`
    : selectedProduct?.name || '';
  const effectiveSku = activeVariant?.sku || selectedProduct?.sku || 'FEL-GAT-001';
  const effectivePrice = activeVariant?.price !== null && activeVariant?.price !== undefined
    ? activeVariant.price
    : selectedProduct?.basePrice;

  const effectiveImageUrl =
    selectedProduct?.media?.find((m) => m.isPrimary)?.url ||
    (selectedProduct?.media && selectedProduct.media.length > 0 ? selectedProduct.media[0].url : null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eusou.com.br';
  const productUrl = selectedProduct
    ? `${origin}/produtos/${selectedProduct.slug}${activeVariant ? `?variant=${activeVariant.id}` : ''}`
    : '';
  const affProductUrl = selectedProduct
    ? `${productUrl}${activeVariant ? '&' : '?'}ref=${encodeURIComponent(affiliateCode.trim() || 'oficial')}`
    : '';

  const formatPrice = (val?: string | number | null) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <Sparkles size={14} /> Central de Divulgação & Conversão
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
            Ferramentas de Divulgação Multicanal
          </h1>
          <p className="text-zinc-300 text-sm mt-1 max-w-2xl">
            Escolha um produto e gere links diretos, botões customizados, cartões visuais, mensagens prontas para WhatsApp, QR Codes ou embeds externos com 1 clique.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-xs">
            <span className="text-zinc-400 block font-medium">Produtos Disponíveis:</span>
            <span className="text-base font-bold text-amber-300">{products.length} itens</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA: SELEÇÃO E DADOS DO PRODUTO (5 COLUNAS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Seletor com Busca */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Buscar Produto
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
            </div>

            {/* Lista Dropdown/Sugestões */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 border border-zinc-100 rounded-xl p-1 bg-zinc-50/50">
              {filteredProducts.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p);
                      setSelectedVariantId('');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-amber-600 text-white font-semibold shadow-sm'
                        : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className={`text-[11px] ${isSelected ? 'text-amber-100' : 'text-zinc-400'}`}>
                        {p.sku || 'Sem SKU'}
                      </div>
                    </div>
                    <span className="text-xs whitespace-nowrap font-bold">
                      {formatPrice(p.basePrice)}
                    </span>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center py-6 text-xs text-zinc-500">
                  Nenhum produto encontrado.
                </div>
              )}
            </div>
          </div>

          {/* Card Detalhado do Produto Selecionado */}
          {selectedProduct && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-amber-700" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Produto Selecionado
                  </span>
                  <h3 className="text-xl font-serif font-bold text-zinc-900 mt-0.5">
                    {effectiveName}
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    selectedProduct.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {selectedProduct.status === 'ACTIVE' ? 'ATIVO' : selectedProduct.status}
                </span>
              </div>

              {/* Seletor de Variante caso exista */}
              {selectedProduct.variants && selectedProduct.variants.filter((v) => v.isActive).length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Variante Específica
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none bg-zinc-50"
                  >
                    <option value="">Produto Principal (Padrão)</option>
                    {selectedProduct.variants
                      .filter((v) => v.isActive)
                      .map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name || variant.sku || variant.id} {variant.price ? `(${formatPrice(variant.price)})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-zinc-400 font-medium block">SKU:</span>
                  <span className="font-mono font-bold text-zinc-800 text-sm">
                    {effectiveSku}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/50">
                  <span className="text-amber-800/70 font-medium block">Preço de Venda:</span>
                  <span className="font-bold text-amber-700 text-sm">
                    {formatPrice(effectivePrice)}
                  </span>
                </div>
              </div>

              {selectedProduct.shortDescription && (
                <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                  {selectedProduct.shortDescription}
                </p>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>Slug: <code className="text-zinc-700">/{selectedProduct.slug}</code></span>
                <button
                  onClick={() => window.open(productUrl, '_blank')}
                  className="text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1"
                >
                  Ver na Loja <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: OPÇÕES DE DIVULGAÇÃO & GERADOR (7 COLUNAS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Seletor de Modalidades */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700 mb-4 flex items-center gap-2">
              <Share2 size={16} className="text-amber-600" /> Como você quer divulgar?
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'LINK', label: 'LINK', desc: 'Link direto', icon: LinkIcon },
                { id: 'BOTÃO', label: 'BOTÃO', desc: 'Botão para site', icon: MousePointer },
                { id: 'CARD', label: 'CARD', desc: 'Card de produto', icon: CreditCard },
                { id: 'BANNER', label: 'BANNER', desc: 'Banner compacto', icon: ImageIcon },
                { id: 'WHATSAPP', label: 'WHATSAPP', desc: 'Mensagem pronta', icon: MessageCircle },
                { id: 'QR CODE', label: 'QR CODE', desc: 'QR Code visual', icon: QrCode },
                { id: 'EMBED', label: 'EMBED', desc: 'HTML Iframe', icon: Code },
                { id: 'LINK DE AFILIADO', label: 'AFILIADO', desc: 'Rastreamento ?ref', icon: UserCheck },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedMode(opt.id as PromoMode)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-md scale-[1.02]'
                        : 'bg-zinc-50/50 border-zinc-200 hover:bg-zinc-100/80 text-zinc-700'
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-amber-400' : 'text-zinc-500'} />
                    <div className="mt-3">
                      <div className="font-bold text-xs uppercase tracking-wider">{opt.label}</div>
                      <div className={`text-[10px] truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ÁREA DE RESULTADO E CÓDIGO DA MODALIDADE SELECIONADA */}
          {selectedProduct && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-6">
              {/* 1. LINK DIRETO */}
              {selectedMode === 'LINK' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-zinc-900 text-base">Link Direto do Produto</h3>
                      <p className="text-xs text-zinc-500">Envie diretamente para seus clientes ou poste na bio</p>
                    </div>
                    <button
                      onClick={() => copyText(productUrl, 'direct_link')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                    >
                      {copiedKey === 'direct_link' ? <Check size={14} /> : <Copy size={14} />}
                      {copiedKey === 'direct_link' ? 'Copiado!' : 'Copiar Link'}
                    </button>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-xs font-mono text-zinc-700 break-all select-all">
                    {productUrl}
                  </div>
                </div>
              )}

              {/* 2. BOTÃO PARA SITE */}
              {selectedMode === 'BOTÃO' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">Botão HTML / CSS para seu Site</h3>
                    <p className="text-xs text-zinc-500">Cole este botão estilizável em qualquer página, landing page ou blog</p>
                  </div>

                  {/* Preview do Botão */}
                  <div className="p-6 bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Preview do Botão</span>
                    <a
                      href={productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md transition"
                    >
                      <ShoppingBag size={16} /> Comprar {effectiveName} — {formatPrice(effectivePrice)}
                    </a>
                  </div>

                  {/* Código HTML */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-zinc-600 uppercase">Código HTML</span>
                      <button
                        onClick={() => {
                          const html = `<a href="${productUrl}" target="_blank" style="display:inline-flex;align-items:center;padding:12px 24px;border-radius:9999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-family:sans-serif;font-size:14px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">Comprar ${effectiveName} &bull; ${formatPrice(effectivePrice)}</a>`;
                          copyText(html, 'btn_code');
                        }}
                        className="text-amber-600 hover:text-amber-700 text-xs font-semibold flex items-center gap-1"
                      >
                        {copiedKey === 'btn_code' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === 'btn_code' ? 'Copiado!' : 'Copiar Código'}
                      </button>
                    </div>
                    <pre className="bg-zinc-900 text-zinc-100 p-3.5 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`<a href="${productUrl}" target="_blank" style="display:inline-flex;align-items:center;padding:12px 24px;border-radius:9999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-family:sans-serif;font-size:14px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
  Comprar ${effectiveName} &bull; ${formatPrice(effectivePrice)}
</a>`}
                    </pre>
                  </div>
                </div>
              )}

              {/* 3. CARD DE PRODUTO */}
              {selectedMode === 'CARD' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">Card Visual de Produto</h3>
                    <p className="text-xs text-zinc-500">Cartão responsivo de exibição com foto, título, valor e chamada para compra</p>
                  </div>

                  {/* Preview do Card */}
                  <div className="p-6 bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl flex justify-center">
                    <div className="w-72 bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-lg flex flex-col">
                      <div className="h-44 bg-zinc-100 flex items-center justify-center relative overflow-hidden">
                        {effectiveImageUrl ? (
                          <img
                            src={effectiveImageUrl}
                            alt={effectiveName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-zinc-400">
                            <ShoppingBag size={48} className="text-zinc-400 opacity-60" />
                            <span className="text-[11px] mt-1 font-medium text-zinc-400">Sem imagem</span>
                          </div>
                        )}
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-zinc-950 uppercase shadow-xs">
                          Autêntico
                        </span>
                      </div>
                      <div className="p-4 flex flex-col justify-between flex-1">
                        <div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            {effectiveSku}
                          </div>
                          <div className="font-serif font-bold text-zinc-900 text-base mt-0.5 truncate">
                            {effectiveName}
                          </div>
                          <div className="text-base font-extrabold text-amber-700 mt-2">
                            {formatPrice(effectivePrice)}
                          </div>
                        </div>
                        <a
                          href={productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold text-center block transition"
                        >
                          Garantir Agora
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Código Embed do Card */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-zinc-600 uppercase">Código HTML do Card</span>
                      <button
                        onClick={() => {
                          const imgTag = effectiveImageUrl
                            ? `<img src="${effectiveImageUrl}" alt="${effectiveName}" style="width:100%;height:180px;object-fit:cover;display:block;" />`
                            : `<div style="height:160px;background:#0f172a;display:flex;align-items:center;justify-content:center;color:#f59e0b;font-size:24px;font-weight:bold;">EuSou</div>`;
                          const html = `<div style="max-width:280px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family:sans-serif;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">${imgTag}<div style="padding:16px;"><div style="font-size:11px;color:#94a3b8;font-weight:bold;">${effectiveSku}</div><h4 style="margin:4px 0;font-size:16px;font-weight:bold;color:#0f172a;">${effectiveName}</h4><div style="font-size:18px;font-weight:bold;color:#b45309;margin-top:8px;">${formatPrice(effectivePrice)}</div><a href="${productUrl}" target="_blank" style="display:block;margin-top:16px;text-align:center;background:#0f172a;color:#fff;padding:10px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:bold;">Comprar Agora</a></div></div>`;
                          copyText(html, 'card_code');
                        }}
                        className="text-amber-600 hover:text-amber-700 text-xs font-semibold flex items-center gap-1"
                      >
                        {copiedKey === 'card_code' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === 'card_code' ? 'Copiado!' : 'Copiar Código'}
                      </button>
                    </div>
                    <pre className="bg-zinc-900 text-zinc-100 p-3.5 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`<div style="max-width:280px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family:sans-serif;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
  ${effectiveImageUrl ? `<img src="${effectiveImageUrl}" alt="${effectiveName}" style="width:100%;height:180px;object-fit:cover;display:block;" />` : `<div style="height:160px;background:#0f172a;display:flex;align-items:center;justify-content:center;color:#f59e0b;font-size:24px;font-weight:bold;">EuSou</div>`}
  <div style="padding:16px;">
    <div style="font-size:11px;color:#94a3b8;font-weight:bold;">${effectiveSku}</div>
    <h4 style="margin:4px 0;font-size:16px;font-weight:bold;color:#0f172a;">${effectiveName}</h4>
    <div style="font-size:18px;font-weight:bold;color:#b45309;margin-top:8px;">${formatPrice(effectivePrice)}</div>
    <a href="${productUrl}" target="_blank" style="display:block;margin-top:16px;text-align:center;background:#0f172a;color:#fff;padding:10px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:bold;">Comprar Agora</a>
  </div>
</div>`}
                    </pre>
                  </div>
                </div>
              )}

              {/* 4. BANNER */}
              {selectedMode === 'BANNER' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">Banner Promocional</h3>
                    <p className="text-xs text-zinc-500">Faixa horizontal para topos de páginas, newsletters ou e-mails</p>
                  </div>

                  {/* Preview Banner */}
                  <div className="p-4 bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                    <div className="flex items-center gap-3">
                      {effectiveImageUrl ? (
                        <img
                          src={effectiveImageUrl}
                          alt={effectiveName}
                          className="w-14 h-14 rounded-xl object-cover border border-amber-500/30 shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold">
                          <Sparkles size={24} />
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Destaque Exclusivo</span>
                        <div className="font-serif font-bold text-base">{effectiveName}</div>
                        <div className="text-xs text-zinc-300 font-mono">Por apenas {formatPrice(effectivePrice)}</div>
                      </div>
                    </div>
                    <a
                      href={productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition shadow-sm whitespace-nowrap"
                    >
                      Aproveitar Oferta &rarr;
                    </a>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-zinc-600 uppercase">Código HTML do Banner</span>
                      <button
                        onClick={() => {
                          const html = `<div style="padding:16px 24px;background:#09090b;color:#ffffff;border-radius:16px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;"><div><div style="font-size:10px;font-weight:bold;color:#f59e0b;text-transform:uppercase;">Destaque Oficial</div><div style="font-size:16px;font-weight:bold;">${effectiveName}</div><div style="font-size:12px;color:#d4d4d8;">Por ${formatPrice(effectivePrice)}</div></div><a href="${productUrl}" target="_blank" style="padding:10px 20px;border-radius:9999px;background:#f59e0b;color:#09090b;text-decoration:none;font-weight:bold;font-size:12px;">Comprar</a></div>`;
                          copyText(html, 'banner_code');
                        }}
                        className="text-amber-600 hover:text-amber-700 text-xs font-semibold flex items-center gap-1"
                      >
                        {copiedKey === 'banner_code' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === 'banner_code' ? 'Copiado!' : 'Copiar Código'}
                      </button>
                    </div>
                    <pre className="bg-zinc-900 text-zinc-100 p-3.5 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`<div style="padding:16px 24px;background:#09090b;color:#ffffff;border-radius:16px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;">
  <div>
    <div style="font-size:10px;font-weight:bold;color:#f59e0b;text-transform:uppercase;">Destaque Oficial</div>
    <div style="font-size:16px;font-weight:bold;">${effectiveName}</div>
    <div style="font-size:12px;color:#d4d4d8;">Por ${formatPrice(effectivePrice)}</div>
  </div>
  <a href="${productUrl}" target="_blank" style="padding:10px 20px;border-radius:9999px;background:#f59e0b;color:#09090b;text-decoration:none;font-weight:bold;font-size:12px;">Comprar</a>
</div>`}
                    </pre>
                  </div>
                </div>
              )}

              {/* 5. WHATSAPP */}
              {selectedMode === 'WHATSAPP' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">Mensagem Pronta para WhatsApp</h3>
                    <p className="text-xs text-zinc-500">Texto profissional e direto com nome, preço e link para envio imediato</p>
                  </div>

                  {/* Pitch formatado sem emojis */}
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-800 leading-relaxed font-sans space-y-2">
                    <p>Olá! Quero compartilhar este produto:</p>
                    <p className="font-semibold text-zinc-950 text-sm">
                      {effectiveName}
                    </p>
                    <p className="font-bold text-amber-700">
                      {formatPrice(effectivePrice)}
                    </p>
                    <p className="text-zinc-600">
                      Confira:
                      <br />
                      <span className="font-mono text-zinc-900 underline">{productUrl}</span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      onClick={() => {
                        const msg = `Olá! Quero compartilhar este produto:\n\n${effectiveName}\n\n${formatPrice(effectivePrice)}\n\nConfira:\n${productUrl}`;
                        copyText(msg, 'wa_text');
                      }}
                      className="w-full sm:flex-1 py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition flex items-center justify-center gap-2"
                    >
                      {copiedKey === 'wa_text' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      {copiedKey === 'wa_text' ? 'Texto Copiado!' : 'Copiar Texto'}
                    </button>

                    <button
                      onClick={() => {
                        const msg = encodeURIComponent(`Olá! Quero compartilhar este produto:\n\n${effectiveName}\n\n${formatPrice(effectivePrice)}\n\nConfira:\n${productUrl}`);
                        window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
                      }}
                      className="w-full sm:flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <MessageCircle size={16} /> Abrir no WhatsApp
                    </button>
                  </div>
                </div>
              )}

              {/* 6. QR CODE */}
              {selectedMode === 'QR CODE' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">QR Code de Produto</h3>
                    <p className="text-xs text-zinc-500">Escaneável por smartphones para embalagens, catálogos físicos ou balcão</p>
                  </div>

                  <div className="p-8 bg-zinc-50 border border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-sm mb-4">
                      {/* Visual QR Code Generator via API Google Charts segura / quickchart */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(productUrl)}`}
                        alt={`QR Code para ${selectedProduct.name}`}
                        className="w-44 h-44 object-contain"
                      />
                    </div>
                    <div className="font-serif font-bold text-zinc-900 text-base">{selectedProduct.name}</div>
                    <div className="text-xs text-zinc-500 font-mono mt-1 break-all max-w-sm">{productUrl}</div>

                    <div className="mt-5 flex items-center gap-3">
                      <button
                        onClick={() => copyText(productUrl, 'qr_link')}
                        className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-white text-xs font-semibold text-zinc-700 transition flex items-center gap-1.5"
                      >
                        {copiedKey === 'qr_link' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === 'qr_link' ? 'Link Copiado' : 'Copiar URL do QR Code'}
                      </button>
                      <a
                        href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(productUrl)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition"
                      >
                        Baixar em Alta Resolução
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. EMBED */}
              {selectedMode === 'EMBED' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">Incorporar Produto em Outro Site (Embed)</h3>
                    <p className="text-xs text-zinc-500">Integre o checkout e visualização em qualquer WordPress, Wix, Shopify ou site HTML</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-zinc-600 uppercase">Código Iframe Embed</span>
                      <button
                        onClick={() => {
                          const embed = `<iframe src="${origin}/embed/products/${selectedProduct.id}" width="100%" height="450" style="border:none;border-radius:16px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);" title="${selectedProduct.name} - EuSou"></iframe>`;
                          copyText(embed, 'embed_code');
                        }}
                        className="text-amber-600 hover:text-amber-700 text-xs font-semibold flex items-center gap-1"
                      >
                        {copiedKey === 'embed_code' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === 'embed_code' ? 'Copiado!' : 'Copiar Código'}
                      </button>
                    </div>
                    <pre className="bg-zinc-900 text-zinc-100 p-3.5 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`<iframe
  src="${origin}/embed/products/${selectedProduct.id}"
  width="100%"
  height="450"
  style="border:none;border-radius:16px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);"
  title="${selectedProduct.name} - EuSou"
></iframe>`}
                    </pre>
                  </div>
                </div>
              )}

              {/* 8. LINK DE AFILIADO */}
              {selectedMode === 'LINK DE AFILIADO' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">Link com Rastreamento de Afiliado</h3>
                    <p className="text-xs text-zinc-500">
                      Inclui o parâmetro <code className="text-amber-700 font-bold">?ref=CODIGO</code> para comissionamento via Last-Click
                    </p>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-900">
                      Código do Afiliado
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={affiliateCode}
                        onChange={(e) => setAffiliateCode(e.target.value)}
                        placeholder="ex: maria, consultor-01"
                        className="px-3.5 py-2 rounded-xl border border-zinc-300 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none flex-1 bg-white"
                      />
                      <button
                        onClick={() => copyText(affProductUrl, 'aff_link')}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        {copiedKey === 'aff_link' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === 'aff_link' ? 'Copiado!' : 'Copiar Link Rastreável'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-xs font-mono text-zinc-800 break-all select-all">
                    {affProductUrl}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
