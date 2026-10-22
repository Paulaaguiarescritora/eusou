import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { fetchApi, resolveMediaUrl } from '../api';
import { ShoppingBag, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';

interface ProductEmbedViewProps {
  productId?: string;
}

export const ProductEmbedView: React.FC<ProductEmbedViewProps> = ({ productId }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read product ID from prop or URL path /embed/products/:id or query ?id=...
    let targetId = productId;
    if (!targetId && typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      const embedIdx = parts.indexOf('embed');
      if (embedIdx !== -1 && parts[embedIdx + 2]) {
        targetId = parts[embedIdx + 2];
      } else {
        const params = new URLSearchParams(window.location.search);
        targetId = params.get('id') || undefined;
      }
    }

    if (!targetId) {
      setError('Identificador do produto não informado');
      setLoading(false);
      return;
    }

    fetchApi<Product>(`/public/embed/products/${targetId}`)
      .then((data) => {
        setProduct(data);
      })
      .catch((err) => {
        setError(err.message || 'Produto indisponível ou inativo');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const affCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;
  const storeUrl = product
    ? `${origin}/produtos/${product.slug}${affCode ? `?ref=${encodeURIComponent(affCode)}` : ''}`
    : '#';

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center bg-white p-6 font-sans">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-zinc-500 font-medium">Carregando produto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[200px] flex items-center justify-center bg-zinc-50 p-6 rounded-2xl border border-zinc-200 text-center font-sans">
        <div className="max-w-xs space-y-1">
          <p className="text-sm font-semibold text-zinc-800">Produto não encontrado</p>
          <p className="text-xs text-zinc-500">{error || 'Este produto não está ativo no momento.'}</p>
        </div>
      </div>
    );
  }

  const primaryImage = product.media && product.media.length > 0 ? product.media[0].url : null;
  const formattedPrice = product.basePrice
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(product.basePrice))
    : 'Consulte';

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl border border-zinc-200 shadow-md overflow-hidden font-sans hover:shadow-lg transition flex flex-col justify-between">
      <div>
        {/* Top Header / Media */}
        <div className="relative h-48 bg-zinc-900 flex items-center justify-center overflow-hidden">
          {primaryImage ? (
            <img src={resolveMediaUrl(primaryImage)} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-zinc-400 p-4">
              <ShoppingBag size={44} className="mx-auto mb-1 text-amber-500 opacity-80" />
              <span className="text-xs font-bold tracking-wider uppercase text-zinc-300">EuSou Oficial</span>
            </div>
          )}
          <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-zinc-950 uppercase tracking-wider shadow-sm">
            Disponível
          </span>
        </div>

        {/* Product Details */}
        <div className="p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono">{product.sku || 'EUSOU'}</span>
            <span className="text-green-600 font-semibold flex items-center gap-1">
              <CheckCircle size={12} /> Autêntico
            </span>
          </div>

          <h2 className="text-base font-serif font-bold text-zinc-900 line-clamp-1 leading-snug">
            {product.name}
          </h2>

          {product.shortDescription && (
            <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
              {product.shortDescription}
            </p>
          )}

          <div className="pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">Preço</span>
            <span className="text-xl font-extrabold text-amber-700">{formattedPrice}</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-5 pt-0">
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
        >
          <span>Ver Detalhes & Comprar</span>
          <ExternalLink size={13} />
        </a>
        <div className="mt-2 text-center text-[10px] text-zinc-400">
          Oferecido por <strong className="text-zinc-600">EuSou</strong>
        </div>
      </div>
    </div>
  );
};
