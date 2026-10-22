/**
 * Renderiza descrições formatadas com suporte a:
 * - Tags HTML nativas (<b>, <strong>, <i>, <ul>, <li>, <h3>, <p>, <br>, etc.)
 * - Sintaxe Markdown amigável (**negrito**, *itálico*)
 * - Preservação automática de parágrafos e quebras de linha
 */
export function renderFormattedDescription(text?: string | null): string {
  if (!text) return '';
  let html = text.trim();

  // Verifica se o texto já possui formatação HTML explícita
  const hasHtml = /<\/?(?:p|br|div|b|strong|i|em|u|h[1-6]|ul|ol|li|span|blockquote)[>\s/]/i.test(html);

  if (!hasHtml) {
    // 1. Converte **negrito** para <strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 2. Converte *itálico* para <em>
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 3. Converte quebras de linha duplas em parágrafos ou simples em <br />
    html = html.replace(/\r?\n/g, '<br />');
  }

  return html;
}
