# F15-C — RELATÓRIO DE HOMOLOGAÇÃO VISUAL E OPERACIONAL REAL

**Data:** 10 de Outubro de 2026  
**Ambiente:** Windows / Node.js 22 / PostgreSQL (Supabase)  
**Branch:** `homologation/f15c-visual-operational` (derivada de `feature/f15b-ux-operational-corrections`)  
**Status Final:** `APPROVED WITH WARNINGS` (1 Pendência não bloqueante documentada)

---

## 1. AMBIENTE E VERIFICAÇÕES DE GATE

Antes de iniciar os testes da homologação prática, executamos a rodada mandatória de conformidade:

| Etapa | Comando | Resultado | Evidência |
| :--- | :--- | :--- | :--- |
| **Integridade Prisma** | `npx prisma validate` | **OK** | Schema canônico `prisma/schema.prisma` válido. Sem duplicidade de entidades. |
| **Testes de Regressão** | `npm test -- --runInBand` | **OK** | **32 test suites passed**, **254 tests passed** (100% de sucesso). |
| **Build Backend** | `npm run build` | **OK** | Compilação NestJS concluída sem erros (`nest build`). |
| **Build Frontend** | `npm run build` | **OK** | Compilação Vite + TypeScript concluída com sucesso (`dist/index.html` gerado). |

---

## 2. FLUXO 1 — CADASTRO COMPLETO DE PRODUTO

- **Tela:** `/admin/products/new` (`AdminProductForm.tsx`)
- **Ação:** Criação controlada de produto completo com Nome, SKU, Descrição, Marca, Categoria, Nicho, Preço Base e múltiplas variantes adicionadas em memória antes do primeiro salvamento.
- **Resultado Esperado:** As variantes devem ser configuradas livremente antes do primeiro salvamento. Após o envio, produto, variantes, inventário e movimentações devem ser persistidos de forma atômica no banco sem duplicidades.
- **Resultado Observado:** 
  - Testado produto `Vaso Poligonal Geométrico 3D F15C` com 3 variantes:
    1. `HOMOLOG-F15C-BLK` (Preto Fosco - R$ 45,00)
    2. `HOMOLOG-F15C-WHT` (Branco Pérola - R$ 45,00)
    3. `HOMOLOG-F15C-PNK` (Rosa Pastel - R$ 48,00)
  - Variantes foram estagiadas na interface antes do salvamento (`isEditing = false`).
  - Ao submeter, o backend criou o registro em `Product`, as 3 entidades em `ProductVariant`, os registros correspondentes em `Inventory` e os respectivos logs em `StockMovement`.
- **Evidência:** Persistência validada em banco de dados:
  - `Product`: ID `3a7a1783-4de3-49ba-881a-6b6ce14293ab`
  - `ProductVariant`: 3 variantes vinculadas
- **Status:** **OK**

---

## 3. FLUXO 2 — ESTOQUE INICIAL

- **Tela:** `/admin/products/new` e `/admin/inventory` (`AdminProductForm.tsx`, `InventoryView.tsx`)
- **Ação:** Atribuição de estoque inicial para o produto e para cada uma das 3 variantes:
  - Variante BLK: 15 unidades
  - Variante WHT: 20 unidades
  - Variante PNK: 8 unidades
- **Resultado Esperado:** O saldo inicial deve ser lançado no estoque do módulo F7, gerando movimentação com motivo claro; estoque negativo deve ser rejeitado; produto sem estoque inicial não deve quebrar nem gerar saldo fantasma.
- **Resultado Observado:**
  - Saldos registrados corretamente via `/admin/inventory/adjust` no modo `SET`.
  - Motivo gerado: `"Estoque inicial no cadastro: variante [SKU]"`.
  - Registros de `StockMovement` com tipo `ADJUSTMENT` criados auditadamente.
  - Produtos sem estoque inicial são inicializados com saldo 0 sem lançar movimentos artificiais.
  - O backend e os testes F7 rejeitam estritamente quantidades negativas.
- **Evidência:** Registros confirmados no banco:
  - `Variant BLK`: `quantity = 15, reservedQuantity = 0`
  - `Variant WHT`: `quantity = 20, reservedQuantity = 0`
  - `Variant PNK`: `quantity = 8, reservedQuantity = 0`
- **Status:** **OK**

---

## 4. FLUXO 3 — AFILIADOS

- **Tela:** `/admin/affiliates` (`AdminAffiliatesView.tsx`)
- **Ação:** Credenciar um novo afiliado a partir da lista de usuários existentes no sistema. Testar tentativa duplicada com o mesmo usuário.
- **Resultado Esperado:** A interface deve exibir dropdown/busca por e-mail e nome com apenas usuários elegíveis (que não possuem perfil de afiliado). Não deve solicitar UUID manual. Tentativa duplicada deve ser prevenida visualmente e bloqueada pelo backend.
- **Resultado Observado:**
  - O endpoint `/admin/affiliates/eligible-users` filtrou com sucesso os usuários elegíveis (`users.filter(u => !u.affiliate)`).
  - A seleção do usuário preenche automaticamente o nome de exibição e sugere o código de afiliado.
  - Tentativa duplicada para o mesmo `userId` dispara rejeição com mensagem amigável e proteção de unicidade no banco (`Unique constraint failed on the fields: (userId)`).
- **Evidência:** Usuário `admin@eusou.com` listado como elegível. Usuário `afiliado.f14h@eusou.com` já possui código `HOMOLOG-REF` e é omitido do dropdown de credenciamento.
- **Status:** **OK**

---

## 5. FLUXO 4 — PRICING (MOTOR F12)

- **Tela:** `/admin/pricing` (`AdminPricingView.tsx`)
- **Ações e Áreas Testadas:**
  1. **Perfis de Precificação:** Margem Alvo (20%), Imposto (4%), Embalagem (R$ 1,00) e Arredondamento (`ENDS_90`).
  2. **Regras de Canais:** Mercado Livre Oficial (Comissão base 14%, Faixas: R$ 0 a 12,49 / R$ 12,50 a 28,99 com fixo R$ 6,25 / R$ 29 a 49,99 com fixo R$ 6,50).
  3. **Preços dos Produtos:** Exibição do produto canônico (Porta Chaves Gatinho):
     - Modo Automático: Custo R$ 14,00 | Calculado R$ 66,90 | Efetivo R$ 66,90.
     - Mudança para Preço Manual: Definido para R$ 79,90. Efetivo passou a R$ 79,90 sem apagar o preço calculado.
     - Restauração para Automático: Efetivo retornou a R$ 66,90.
  4. **Simulador Interativo:** Executada simulação matemática para canal Mercado Livre com custo R$ 20,00.
     - **Resultado do Simulador:** Cálculo realizado em tempo real.
     - **Verificação no Banco:** Contagem de registros em `ProductChannelPrice` permaneceu idêntica (1 registro antes, 1 registro após). Nenhuma alteração foi persistida.
     - **Mensagem na UI:** `"Simulação — nenhuma alteração foi salva."`
- **Status:** **OK**

---

## 6. FLUXO 5 — MARKETPLACE HUB

- **Tela:** `/admin/marketplaces` (`MarketplacesView.tsx`)
- **Ação:** Navegar pelas 6 abas consolidadas:
  1. `Visão Geral & Canais` (Painel Geral, Canais Suportados, Contas Vinculadas)
  2. `Produtos Publicados`
  3. `Pedidos dos Canais`
  4. `Publicação & Categorias`
  5. `Reconciliação`
  6. `Diagnóstico & Logs` (Histórico de Sincronizações e Fila de Eventos)
- **Resultado Esperado:** Hierarquia compreensível sem exposição de jargões técnicos (`F9`, `F10`, `F13`, `F13B`, `Idempotência`). Tratamento humano de erros com acordião para detalhes técnicos.
- **Resultado Observado:**
  - As 6 abas organizam logicamente o fluxo operacional diário.
  - Na aba de Produtos Publicados, erros de sincronização/publicação contam com botão *"Ver detalhes do erro ▼"* que abre um acordião expansível contendo a causa reportada pelo marketplace e dicas acionáveis.
  - O assistente de publicação (`Wizard`) guia o lojista em 4 passos claros: Produto & Canal &rarr; Preço & Margem &rarr; Pré-validação &rarr; Confirmação.
- **Status:** **OK**

---

## 7. FLUXO 6 — LOJA PÚBLICA

- **Tela:** `/` (Home) e `/produtos` (Catálogo)
- **Ação:** Navegação pública na perspectiva de um cliente visitante.
- **Resultado Esperado:** 
  - Ausência do botão "Área Administrativa" no cabeçalho.
  - Link de afiliados com chamada amigável ("Seja um Afiliado").
  - Busca de produtos funcional.
  - Filtros por categoria e botão para limpar filtros funcionais.
- **Resultado Observado:**
  - O cabeçalho desktop e mobile exibe apenas *Início*, *Produtos*, *Seja um Afiliado* e o ícone do Carrinho. O backoffice não vaza visualmente.
  - A rota `/produtos` exibe os cards com preço formatado, foto e botão de adicionar ao carrinho.
- **Status:** **OK**

---

## 8. FILTROS PÚBLICOS E AVALIAÇÃO DE CONFORMIDADE

- **Tela:** `/produtos` (`App.tsx`)
- **Resultado Observado:**
  - Filtro por **Categoria** está completamente implementado na interface com badges horizontais interativos e botão de limpeza (*"Limpar filtros"*).
  - **Filtro por Nicho:** Embora o backend ofereça suporte completo via `QueryProductsDto.nicheId`, a barra de filtros rápidos na interface da loja pública implementou apenas as Categorias.
- **Classificação:** **AJUSTAR** (Registrado como Pendência Documentada da F15-B, conforme item 9 da especificação).
- **Impacto:** Baixo (usuários navegam pelas categorias principais sem prejuízo ao catálogo).

---

## 9. RESPONSIVIDADE MOBILE (ADMIN & LOJA)

- **Viewports Testados:** `360px` (Galaxy S8 / telas estreitas), `390px` (iPhone 12/13/14), `430px` (iPhone Pro Max).
- **Resultados no Backoffice (`AdminLayout.tsx`):**
  - O menu lateral inicia fechado (`-translate-x-full`).
  - O botão hambúrguer fixo no topo abre a gaveta (*drawer*) com fundo escurecido (*backdrop overlay*).
  - Ao clicar em qualquer rota ou no botão "X", o drawer fecha suavemente.
  - Nenhum botão de ação essencial fica truncado ou inacessível.
- **Resultados na Loja Pública (`Navigation.tsx`, `ProductCard.tsx`, `CartView.tsx`):**
  - O grid adapta-se de 2 colunas para 1 coluna em telas estreitas.
  - O drawer do carrinho desliza com largura ajustada a 100% da tela em mobile, garantindo legibilidade do subtotal e botão de finalizar compra.
  - Não há rolagem horizontal indesejada (*overflow-x: hidden*).
- **Status:** **OK**

---

## 10. CENTRAL DE OPERAÇÃO COMERCIAL (DASHBOARD)

- **Tela:** `/admin/dashboard` (`CommercialDashboardView.tsx`)
- **Ação:** Consulta dos indicadores operacionais e alternância entre períodos:
  - `Hoje`
  - `7 dias`
  - `30 dias`
  - `90 dias`
- **Resultado Observado:**
  - Banner de Saúde Operacional reflete dinamicamente a severidade dos alertas derivados.
  - Cards de Vendas, Pedidos, Estoque e Produção mostram métricas consistentes com o banco de dados.
  - A lista do Centro de Atenção Operacional exibe alertas acionáveis com botões de atalho direto para a área que requer intervenção (`/admin/inventory`, `/admin/marketplaces`, etc.).
- **Status:** **OK**

---

## 11. NAVEGAÇÃO E ROTAS

- **Ciclo Testado:** Produto &rarr; Voltar &rarr; Catálogo &rarr; Pedido &rarr; Dashboard &rarr; Marketplace &rarr; Pricing &rarr; Produto.
- **Resultado Observado:**
  - Todos os botões de voltar possuem fallback seguro e preservam o histórico do navegador (`window.history.pushState` e `popstate`).
  - Não há "becos sem saída" ou links quebrados.
  - As URLs refletem com exatidão o estado da página (`/admin/pricing`, `/admin/products/new`, etc.).
- **Status:** **OK**

---

## 12. AUDITORIA DE MICROCOPY E LINGUAGEM

| Termo Auditado | Ocorrência na Interface | Avaliação | Classificação |
| :--- | :--- | :--- | :--- |
| `F7` | Card de inventário no Dashboard e placeholder de custo no Pricing | Usado como sigla técnica contextual | **ACEITÁVEL** (Pode ser simplificado para "Produção/Estoque" em polimento futuro) |
| `F12` | Título da aba de Precificação e logs | Identifica o motor de cálculo | **ACEITÁVEL** |
| `F13` / `F13B` | Removido dos títulos e botões principais | Substituído por "Marketplaces e Canais" | **OK** |
| `ProductChannelPrice` | Removido de textos operacionais; restrito a identificadores internos | Ausente no vocabulário comum | **OK** |
| `Idempotência` | Removido de todas as mensagens para o usuário | Substituído por "sincronização sem duplicação" | **OK** |
| `UUID` | Removido do formulário de afiliados | Substituído por busca por nome e e-mail | **OK** |
| `DELTA / SET` | Restrito ao seletor de modo técnico no ajuste manual de estoque | Termos com labels em português ("Adicionar/Remover" e "Definir Saldo") | **OK** |

---

## 13. COMPORTAMENTO DE MODAIS

- **Modais Testados (360px a 430px):**
  1. Modal de Conectar Conta de Canal (`MarketplacesView.tsx`)
  2. Modal de Novo Canal (`MarketplacesView.tsx`)
  3. Modal Assistente de Publicação em 4 Etapas (`MarketplacesView.tsx`)
  4. Modal de Definir Preço Manual (`AdminPricingView.tsx`)
  5. Modal de Ajuste de Estoque (`InventoryView.tsx`)
- **Resultado Observado:**
  - Todos os modais possuem `max-h-[90vh]` ou `overflow-y-auto` quando o conteúdo excede a altura da tela.
  - O rodapé com botões Cancelar e Confirmar permanece visível e clicável.
  - Fechamento disponível tanto pelo botão `X` quanto pelo botão Cancelar e clique no backdrop.
- **Status:** **OK**

---

## 14. PERMISSÕES E ACESSO POR PERFIL

- **Perfis Avaliados:**
  1. `ADMIN` (`admin@eusou.com` com role `admin`): Acesso total a todas as rotas `/admin/*` e área pública.
  2. `AFFILIATE` (`afiliado.f14h@eusou.com`): Acesso liberado ao `/affiliate` (Portal do Afiliado), redirecionado para login/bloqueado se tentar acessar `/admin/*`.
  3. `CLIENT` (Visitante / cliente anônimo): Navega pela loja, produtos, catálogo, carrinho e checkout. Ao tentar acessar rota `/admin/*`, recebe tela de login restrito com mensagem `"Acesso Restrito Administrativo"`.
- **Status:** **OK**

---

## 15. TABELA CONSOLIDADA DE FLUXOS E AVALIAÇÃO

| Fluxo | Descrição | Status | Observação |
| :---: | :--- | :---: | :--- |
| **F1** | Cadastro de Produto com Variantes em Memória | **OK** | Variantes e atributos configurados antes do 1º save. |
| **F2** | Estoque Inicial Base e por Variante (F7) | **OK** | Ajuste auditado persistido com motivo claro. |
| **F3** | Credenciamento Visual de Afiliados | **OK** | Busca por e-mail sem UUID; duplicatas bloqueadas. |
| **F4** | Motor de Precificação F12 (Perfis, Regras, Simulador) | **OK** | Simulador sem persistência; override manual reversível. |
| **F5** | Marketplace Hub Reorganizado (6 Abas) | **OK** | Linguagem humana e acordião de erros. |
| **F6** | Loja Pública (Header sem vazamento) | **OK** | Botão de admin removido do cabeçalho da loja. |
| **F7** | Filtros Públicos por Categoria | **AJUSTAR** | Categoria implementada; nicho ficou pendente para F16. |
| **F8** | Responsividade Mobile (Admin & Loja) | **OK** | Drawer funcional de 360px a 430px sem overflow. |
| **F9** | Central Comercial (Dashboard & Períodos) | **OK** | Alternância Hoje / 7d / 30d / 90d consistente. |
| **F10** | Navegação & Ausência de Becos sem Saída | **OK** | Fallbacks de rota e botões Voltar funcionando. |

---

## 16. PENDÊNCIAS REGISTRADAS (NÃO BLOQUEANTES)

1. **PENDÊNCIA F15-B — Filtro de Nicho na Loja Pública:**
   - **Local:** `/produtos` (`App.tsx`).
   - **Situação:** A barra de filtros da loja pública implementou o seletor visual por **Categoria**. O filtro por **Nicho** (solicitado no relatório F15-A) não foi adicionado na interface pública, embora exista suporte no backend.
   - **Severidade:** Baixa (Cosmética / UX complementar).
   - **Recomendação:** Implementar na próxima rodada de polimento visual do catálogo (F16) um seletor duplo em abas ou dropdown (Nicho & Categoria).

---

## 17. CLASSIFICAÇÃO FINAL

> ### **RESULTADO: APPROVED WITH WARNINGS**
> 
> O sistema EuSou atingiu a maturidade prática necessária para operação real. A navegação foi humanizada, o backoffice tornou-se utilizável em smartphones, os fluxos de criação de produtos com variantes e estoque inicial funcionam fluidamente, o credenciamento de afiliados não exige mais conhecimento de banco/UUIDs e o motor de precificação F12 possui interface completa com simulador seguro.
> 
> A única pendência identificada (filtro público por nicho) é não-bloqueante e está documentada para futura evolução.
