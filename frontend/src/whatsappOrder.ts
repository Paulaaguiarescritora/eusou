import { Order } from './types';

/**
 * Limpa o número de telefone e garante o prefixo DDI 55 do Brasil se necessário.
 */
export function sanitizeWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  // Se tiver 10 ou 11 dígitos (DDD + número), adiciona o DDI 55
  if (clean.length === 10 || clean.length === 11) {
    clean = `55${clean}`;
  }
  return clean;
}

/**
 * Monta o texto legível e amigável para envio de confirmação de pedido via WhatsApp.
 */
export function buildWhatsAppOrderMessage(order: Order, origin?: string): string {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://eusou-lemon.vercel.app');
  const trackingUrl = `${baseUrl}/pedido/${order.id}`;

  const isPending = order.status === 'PENDING';
  const statusText = isPending ? '⏳ Aguardando Pagamento' : '✅ Pagamento Confirmado';

  const itemsList = (order.items || [])
    .map((item) => {
      const variantInfo = item.skuSnapshot ? ` (${item.skuSnapshot})` : '';
      const unitVal = Number(item.unitPrice || 0).toFixed(2).replace('.', ',');
      const subVal = Number(item.subtotal || 0).toFixed(2).replace('.', ',');
      return `• *${item.quantity}x ${item.productNameSnapshot}*${variantInfo}\n  Qtd: ${item.quantity} | Unit: R$ ${unitVal} | Subtotal: R$ ${subVal}`;
    })
    .join('\n\n');

  const complementStr = order.complement ? ` (${order.complement})` : '';
  const addressStr = `${order.street}, ${order.number}${complementStr}\n${order.neighborhood} - ${order.city}/${order.state} - CEP: ${order.zipCode}`;
  const totalStr = Number(order.total || 0).toFixed(2).replace('.', ',');

  return (
    `🛍️ *EuSou / KUBOSTUDIO - Detalhes do Pedido*\n\n` +
    `Olá, *${order.customerName}*!\n` +
    `Aqui está a cópia do seu pedido realizado em nossa loja:\n\n` +
    `📋 *Pedido:* #${shortId} (ID: \`${order.id}\`)\n` +
    `📌 *Status:* ${statusText}\n\n` +
    `🛒 *Itens do Pedido:*\n` +
    `${itemsList}\n\n` +
    `📍 *Endereço de Entrega:*\n` +
    `${addressStr}\n\n` +
    `💰 *Valor Total:* R$ ${totalStr}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Acesse e acompanhe seu pedido no sistema:*\n` +
    `${trackingUrl}\n\n` +
    `Caso precise de suporte ou tenha dúvidas sobre sua entrega, basta responder a esta mensagem!`
  );
}

/**
 * Gera a URL completa para abrir a conversa no WhatsApp Web / App.
 */
export function getWhatsAppOrderUrl(order: Order, customPhone?: string, origin?: string): string {
  const phone = sanitizeWhatsAppPhone(customPhone || order.customerPhone);
  const message = buildWhatsAppOrderMessage(order, origin);
  const encodedText = encodeURIComponent(message);

  if (phone) {
    return `https://wa.me/${phone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
