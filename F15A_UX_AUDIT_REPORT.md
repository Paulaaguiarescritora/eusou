# F15-A Auditoria de Produto, UX/UI e Operação Real do EuSou

**Data da Auditoria:** 10 de Outubro de 2026  
**Branch:** `audit/f15a-ux-product-audit`  
**Status da Auditoria:** **CONCLUÍDA**  
**Pergunta Central:** *"Uma pessoa real consegue usar o EuSou sem conhecer sua arquitetura interna?"*

---

## 1. Resumo Executivo

A auditoria F15-A realizou uma varredura rigorosa em todas as 25 rotas e telas da plataforma EuSou, cobrindo a Área Pública, o Backoffice Administrativo, o Portal do Afiliado, a Central de Divulgação e o Marketplace Hub.

### Diagnóstico Geral
O motor comercial do EuSou é extremamente robusto no backend (F5 a F14 possuem 100% de integridade com cálculos em `Decimal`, idempotência, rastreabilidade e zero duplicidade de entidades). No entanto, **a experiência do usuário (UX) reflete com frequência excessiva a arquitetura interna do código para a interface gráfica**, exigindo do usuário comum conhecimentos técnicos de termos do Prisma, engenharia de software e processos fragmentados em múltiplos passos.

- **Pontos Fortes:**
  - Velocidade de carregamento e fluidez do bundle Vite.
  - Consistência de paleta e tipografia (Tailwind CSS, estética Slate/Amber limpa).
  - Central de Operação Comercial (F14) com diagnóstico visual claro em 5 segundos.
  - Fluxo público de compra (Carrinho &rarr; Checkout &rarr; Confirmação) funcional e sem fricção.
- **Principais Fragilidades Identificadas:**
  - **Falta de Interface Dedicada de Pricing F12:** O Pricing Engine F12 possui backend completo com regras, perfis e faixas, mas o administrador não possui tela para gerenciar os perfis de precificação e custos na UI; precisa recorrer ao assistente de marketplace ou endpoints.
  - **Cadastro de Produto Fragmentado (Múltiplas Etapas Desconectadas):** O administrador não consegue cadastrar variantes, estoque e fotos locais antes de salvar o produto preliminarmente. Além disso, não há integração direta de estoque F7 e preço F12 na criação do produto.
  - **Vazamento de Termos Técnicos (Microcopy):** Telas de Marketplace e Afiliados expõem termos como `UUID`, `F12`, `F7`, `Hub F13B`, `ProductChannelPrice`, `OAuth`, `ExternalAccountId`, `Slug`.
  - **Vulnerabilidade de UI em Afiliados:** Formulário de credenciamento exige que o administrador digite o `User ID (UUID)` de 36 caracteres manualmente em vez de selecionar o usuário em uma lista ou busca de e-mail.
  - **Divergências de Responsividade Mobile:** Tabelas administrativas complexas (Marketplaces, Produção, Estoque) apresentam overflow horizontal e cards de modais com altura fixa que podem cortar ações em telas de 360px a 390px.

---

## 2. Área Pública

Rotas avaliadas:
- `/` (Home com Banner, Categorias, Catálogos e Destaques)
- `/produtos` (Catálogo público com busca)
- `/produtos/:slug` (Ficha do produto com variantes, preço dinâmico e galeria)
- `/catalogos/:slug` (Vitrine temática orientada a nichos/regras com herança de temas visuais)
- `/carrinho` (Gestão de itens, atualização de quantidades e subtotal)
- `/checkout` (Dados do cliente, endereço e finalização segura)
- `/pedido/:id` (Confirmação com resumo de itens e endereço)
- `/embed/products/:id` (Widget de produto para sites externos)

### Análise UX
- **Cliente consegue comprar sem orientação?** **SIM.** O fluxo de compra é intuitivo e transparente. O seletor de variantes altera o preço e SKU imediatamente.
- **Header e Navegação:**
  - O Header público exibe o botão `"Área Administrativa"` e `"Portal Afiliado"`. Em um e-commerce para o consumidor final, exibir um botão fixo de acesso ao backoffice administrativo no header principal transmite amadorismo e quebra a imersão de compra.
- **Filtros e Busca:**
  - Na página `/produtos`, a busca por texto funciona, mas não existem filtros laterais visuais por categoria ou nicho, apenas parâmetros via URL disparados pela Home (`?category=...`).
- **Página de Confirmação (`/pedido/:id`):**
  - Exibe o badge `"Pedido Confirmado (Demonstração)"`. Para ambiente real, isso precisa ser parametrizável.
- **Responsividade:**
  - 360px e 390px: A grade de produtos se adapta perfeitamente em 2 colunas (`grid-cols-2`), o carrinho exibe os controles verticalizados sem quebras e o checkout organiza os inputs de endereço de forma responsiva.

---

## 3. Administração (Backoffice)

Rotas avaliadas:
- `/admin/dashboard`
- `/admin/products`, `/admin/products/new`, `/admin/products/:id`
- `/admin/niches`, `/admin/categories`, `/admin/tags`, `/admin/attributes`, `/admin/themes`
- `/admin/catalogs`, `/admin/catalogs/new`, `/admin/catalogs/:id`
- `/admin/collections`
- `/admin/orders`
- `/admin/production`
- `/admin/inventory`
- `/admin/divulgacao`
- `/admin/affiliates`
- `/admin/marketplaces`

### Análise da Barra Lateral e Estrutura
- **Sidebar (`AdminLayout.tsx`):**
  - Agrupamento excelente em seções (`VISÃO GERAL`, `CATÁLOGO`, `PUBLICAÇÃO`, `OPERAÇÃO`, `DISTRIBUIÇÃO`).
  - **Falta o item "Precificação / Pricing"** no menu do AdminLayout. O F12 existe no backend mas não possui link no menu.
  - Em telas mobile (< 768px), o AdminLayout não possui gaveta (drawer) retrátil para o menu lateral; ele empilha a barra lateral acima do conteúdo, ocupando muita rolagem vertical antes do conteúdo principal.
- **Breadcrumbs:** Inexistentes nas telas de edição de produto e catálogo; há apenas um botão genérico "Voltar".

---

## 4. Cadastro de Produto

### Avaliação do Fluxo Mental e Real do Administrador
Sequência atual:
1. `NOVO PRODUTO`: Nome, SKU, Slug, Marca, Preço Base, Status.
2. `DESCRIÇÕES`: Descrição curta e completa.
3. `ORGANIZAÇÃO`: Marcar checkboxes de Categorias, Nichos e Tags.
4. `MÍDIA`: Adicionar links ou upload base64.
5. Clicar em `"Salvar Produto"`.
6. **Somente após salvar o produto:** o formulário habilita a seção `5. Variantes de Produto`. Se o usuário tentar adicionar variantes antes, recebe o alerta: *"Salve o produto primeiro para cadastrar variantes formalmente."*
7. **Estoque e Custo:** Não existem campos para informar quantidade inicial de estoque ou perfil de custo F7/F12 no momento do cadastro. O operador precisa salvar o produto, sair do formulário, ir em `/admin/inventory` e fazer um "Ajuste Manual", ou criar uma ordem no F7.

### Veredito
**"Qualquer administrador consegue cadastrar um produto sem treinamento?"**  
**NÃO.** O fluxo exige 3 telas diferentes (Produtos &rarr; Estoque &rarr; Marketplaces) e obriga o usuário a salvar duas vezes para conseguir vincular variantes.

---

## 5. Pricing (Precificação Inteligente F12)

### Avaliação
- O backend F12 implementa o motor matemático com custo F7, perfis de canal, taxas percentuais, embalagem, tiers e arredondamento (`END_90`, `END_99`).
- **Na Interface:**
  - O módulo de precificação só é visível indiretamente na Etapa 2 do Wizard de publicação de marketplaces (`/admin/marketplaces`), exibindo termos como: `"Precificação Inteligente (F12)"`, `"Preço Sugerido F12"`, `"MANUAL em ProductChannelPrice"`.
  - **Falta uma tela `/admin/pricing` dedicada** para o lojista configurar custos de embalagem, margens padrão e visualizar a tabela comparativa de preços por canal em lote.

---

## 6. Estoque e Produção (F7)

### Avaliação
- **Estoque (`/admin/inventory`):**
  - Tela clara com duas abas: "Saldos de Produtos" e "Histórico de Movimentações".
  - O modal de ajuste manual usa termos claros (`DELTA` vs `SET` traduzidos para "Somar/Subtrair do Saldo" ou "Definir Valor Fixo").
  - Identifica itens em estoque crítico com badges coloridas.
- **Produção 3D (`/admin/production`):**
  - Módulo completo com controle de impressoras, filamentos/resinas e perfis de impressão.
  - Ações operacionais rápidas: Iniciar Job, Pausar, Concluir (com reporte de peças rejeitadas para recalcular perda de matéria-prima).
  - Ponto de fricção: Para iniciar a produção de um item sem estoque, o operador precisa saber de cabeça qual produto e qual perfil 3D correspondem, sem um botão "Produzir a partir deste produto" direto da tabela de estoque.

---

## 7. Marketplaces (F9, F10, F13A, F13B)

### Avaliação
- O componente `MarketplacesView.tsx` possui 9 abas (`dashboard`, `channels`, `accounts`, `products`, `categories`, `orders`, `events`, `reconciliation`, `logs`).
- **Problema de Carga Cognitiva:** 9 abas em uma única tela sobrecarregam o administrador. As abas `events`, `reconciliation` e `logs` poderiam ser sub-visões de Diagnóstico Técnico.
- **Vazamento de Termos de Arquitetura:**
  - *"Assistente de Publicação em Canal (Hub F13B)"*
  - *"Preço Manual Override (Fixa preço em MANUAL no F12)"*
  - *"Define modo MANUAL em ProductChannelPrice"*
  - *"Duração: 142ms"*
  - *"Idempotência"*
- **O que o usuário precisa ver:**
  - "Publicar no Mercado Livre"
  - "Preço de Venda Sugerido: R$ 49,90"
  - "Definir preço personalizado"
  - "Sincronizado há 5 minutos"

---

## 8. Afiliados (F6)

### Avaliação
- **Portal do Afiliado (`/affiliate`):**
  - Visual de excelente qualidade (Dark/Gold), com gerador de links parametrizados (Instagram, WhatsApp, TikTok), QR Code e métricas de clique/conversão.
  - Fácil de usar, autoexplicativo e direto.
- **Gestão Administrativa de Afiliados (`/admin/affiliates`):**
  - **Problema Crítico de UX:** O formulário *"Credenciar Novo Afiliado"* possui o campo:
    `User ID (UUID)` com placeholder `"UUID do usuário cadastrado"`.
    Um lojista comum não sabe o que é um UUID nem como consultar o banco de dados para copiar uma chave `355a37d2-7d23-418e-aca9-21caf1675de7`.
  - **Correção mandatória:** O campo deve ser um autocomplete/select pelo e-mail ou nome do usuário.

---

## 9. Dashboard (F14)

### Avaliação
- **Critério dos 5 segundos:** **APROVADO.**
  - Banner superior com cor semafórica (Verde = Operação Saudável, Amarelo = Atenção, Vermelho = Problemas Críticos).
  - Centro de atenção operacional com cartões de alerta contendo severidade e botão de ação direta (`Corrigir`, `Produzir`, `Reconciliar`).
  - Cards de faturamento com crescimento percentual real em relação ao período equivalente anterior.
  - Quebra por canais e estoque crítico em duas colunas organizadas.

---

## 10. Responsividade

| Resolução | Área Pública | Admin Dashboard | Tabela de Produtos | Modal Wizard Marketplace |
| :--- | :---: | :---: | :---: | :---: |
| **360px** (Mobile Pequeno) | OK | Ajustar (cards empilhados) | Quebra (overflow horizontal) | Quebra (botões cortam na base) |
| **390px / 430px** (Mobile Padrão) | OK | OK | Ajustar (scroll x necessário) | Ajustar |
| **768px** (Tablet) | OK | OK | OK | OK |
| **1024px** (Desktop Pequeno) | OK | OK | OK | OK |
| **1280px / 1440px** (Desktop) | OK | OK | OK | OK |

---

## 11. Consistência Visual

- **Paleta de Cores:**
  - Predomínio de `slate-900` para botões principais e ações primárias.
  - Toques em `amber-500` para destaque de catálogo e avisos.
  - Status em `emerald` (sucesso), `rose` (erro/crítico) e `amber` (atenção).
- **Tipografia:** Família `Inter/Sans` com tamanhos de fonte padronizados (`text-xs` a `text-sm` em controles, `text-xl` a `text-2xl` em títulos).
- **Inconsistências Identificadas:**
  - Alguns botões utilizam `rounded-md`, outros `rounded-xl` e outros `rounded-2xl`.
  - Componentes de Produção e Estoque utilizam classes `zinc-*`, enquanto Catálogo, Dashboard e Produtos utilizam `slate-*`.

---

## 12. Microcopy

| Tela / Local | Texto Atual (Técnico / Ruim) | Texto Recomendado (Humano / Operacional) | Justificativa |
| :--- | :--- | :--- | :--- |
| Header Público | "Área Administrativa" | "Entrar" / Ícone de Perfil | Não expor backoffice a clientes finais. |
| Header Público | "Portal Afiliado" | "Seja um Afiliado" / "Parceiros" | Chamada comercial convidativa. |
| Cadastro de Afiliado | "User ID (UUID)" | "Selecionar Usuário / E-mail" | UUID é jargão de banco de dados. |
| Wizard Marketplace | "Hub F13B" / "Preço F12" | "Precificação Automática do EuSou" | O usuário não precisa saber os nomes das fases. |
| Wizard Marketplace | "ProductChannelPrice" | "Preço no Canal" | Termo interno de entidade do Prisma. |
| Marketplaces | "DiscrepancyReport" | "Divergência Encontrada" | Linguagem natural em português. |
| Formulário Produto | "Slug (URL)" sem preview | "Link do Produto: eusou.com.br/produtos/..." | Torna visível o destino do link. |
| Estoque | "DELTA / SET" | "Somar/Subtrair do Saldo" / "Definir Saldo Exato" | Facilita a escolha do operador. |

---

## 13. Fluxos e Quantidade de Cliques

| Tarefa Principal | Telas | Cliques | Campos | Gargalo Identificado |
| :--- | :---: | :---: | :---: | :--- |
| **1. Cadastrar Produto Simples** | 1 | 8 | 9 | Bom fluxo para produto básico. |
| **2. Cadastrar Produto com Variantes** | 2 | 16 | 14 | **Gargalo:** Obriga salvar o produto primeiro antes de permitir variantes. |
| **3. Cadastrar Produto + Estoque Inicial** | 3 | 22 | 18 | **Gargalo:** Exige sair para `/admin/inventory` e fazer ajuste manual. |
| **4. Ajustar Preço de Canal** | 2 | 10 | 6 | Exige abrir o assistente de marketplace para sobrescrever. |
| **5. Publicar no Mercado Livre** | 2 | 12 | 5 | Wizard em 4 etapas funciona bem, mas exige validação manual prévia. |
| **6. Credenciar Afiliado** | 2 | 9 | 4 | **Gargalo:** Exige colar UUID previamente descoberto no banco. |
| **7. Resolver Alerta do Dashboard** | 1 | 2 | 0 | **Excelente:** 1 clique leva diretamente à correção. |

---

## 14. Permissões de Acesso

- **Admin:** Acessa todas as rotas `/admin/*` via `JwtAuthGuard` e `RolesGuard('admin')`.
- **Affiliate:** Acessa `/affiliate`. Quando tenta acessar `/admin/*`, é redirecionado ou recebe modal de login solicitando credenciais administrativas.
- **Cliente:** Acessa rotas públicas. Se navegar manualmente para `/admin/products`, o sistema renderiza a tela de login restrito com mensagem clara.

---

## 15. Estados de Interface (Empty, Loading, Error)

- **Loading:** Implementado com spinners ou mensagens textuais sutis em todas as telas auditadas.
- **Empty States:**
  - Dashboard: Mensagem consciente quando não há vendas no período (*"Você ainda não possui vendas registradas no período"*).
  - Produtos / Catálogos / Pedidos: Exibem cartões vazios explicativos.
  - Ponto a melhorar: Em `/admin/tags`, quando não há tags, exibe um texto em itálico com input para criação rápida; esse padrão deve ser replicado para Nichos e Categorias.
- **Error States:** Tratados com banners vermelhos e captura de mensagens da API.

---

## 16. Matriz de Problemas Encontrados

| ID | Tela / Componente | Categoria | Severidade | Descrição do Problema | Impacto | Recomendação |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **PRB-01** | `AdminAffiliatesView.tsx` | UX / Usabilidade | **CRITICAL** | Cadastro de afiliado exige input manual de `User ID (UUID)`. | Impede que administradores sem acesso ao banco cadastrem afiliados. | Substituir input de texto por busca de usuário por e-mail/nome. |
| **PRB-02** | `AdminProductForm.tsx` | UX / Fluxo | **HIGH** | Seção de Variantes bloqueada até o produto ser salvo no banco. | Aumenta o tempo e a fricção do cadastro de itens com cores/tamanhos. | Permitir adicionar variantes em memória antes de submeter o formulário. |
| **PRB-03** | `AdminLayout.tsx` | Arquitetura de UI | **HIGH** | Falta menu ou tela de Gestão de Pricing F12 no Backoffice. | Administrador não visualiza nem edita regras de margem e custo em lote. | Criar item e rota `/admin/pricing` no Backoffice. |
| **PRB-04** | `Navigation.tsx` (Header) | UX / Produto | **HIGH** | Botão "Área Administrativa" exposto diretamente no menu do cliente final. | Amadorismo na loja pública; confunde o comprador comum. | Mover para rodapé ou ocultar atrás de link discreto/login de conta. |
| **PRB-05** | `MarketplacesView.tsx` | Microcopy / UX | **MEDIUM** | Exposição de termos técnicos internos (`F12`, `F13B`, `ProductChannelPrice`). | Dificulta a compreensão operacional por lojistas leigos. | Traduzir termos para linguagem comercial clara. |
| **PRB-06** | `AdminProductForm.tsx` | UX / Operação | **MEDIUM** | Ausência de saldo de estoque inicial durante o cadastro do produto. | Obriga o usuário a navegar para o estoque após cadastrar o item. | Incluir campo opcional "Estoque Inicial" no formulário de produto. |
| **PRB-07** | `AdminLayout.tsx` | Responsividade | **MEDIUM** | Sidebar não colapsa em menu gaveta (hamburger) no mobile (< 768px). | Empurra todo o conteúdo para baixo em smartphones. | Adicionar menu gaveta retrátil no mobile para o AdminLayout. |
| **PRB-08** | Várias Telas Admin | Consistência | **LOW** | Mistura de classes Tailwind `zinc-*` e `slate-*`. | Inconsistência estética sutil entre módulos antigos e novos. | Padronizar a paleta base para `slate` em toda a aplicação. |
| **PRB-09** | `CartView.tsx` | Microcopy | **LOW** | Texto "Frete Grátis (Demonstração)" fixo no resumo de compra. | Parece ambiente de teste para o comprador final. | Parametrizar ou exibir "Frete calculado para a região". |
| **PRB-10** | `MarketplacesView.tsx` | UX / Carga | **LOW** | 9 abas no topo da tela de Marketplaces. | Poluição visual e sobrecarga de opções. | Consolidar abas técnicas (`events`, `reconciliation`, `logs`) em uma aba "Diagnóstico". |

---

## 17. Classificação das Telas da Aplicação

| Rota | Tipo | Classificação | Parecer |
| :--- | :--- | :---: | :--- |
| `/` | Pública | **OK** | Visual moderno, rápido, excelente hierarquia. |
| `/produtos` | Pública | **AJUSTAR** | Adicionar barra lateral de filtros por nicho/categoria. |
| `/produtos/:slug` | Pública | **OK** | Excelente experiência com troca dinâmica de variantes e preço. |
| `/catalogos/:slug` | Pública | **OK** | Temas dinâmicos funcionam perfeitamente. |
| `/carrinho` | Pública | **OK** | Limpo, ágil e responsivo. |
| `/checkout` | Pública | **OK** | Formulário bem agrupado e validação clara. |
| `/pedido/:id` | Pública | **OK** | Resumo completo com snapshots auditáveis. |
| `/embed/products/:id` | Pública / Embed | **OK** | Cartão independente compacto para sites externos. |
| `/affiliate` | Portal Afiliado | **OK** | Excelente ferramenta de compartilhamento e conversão. |
| `/admin/dashboard` | Backoffice | **OK** | F14 Central Comercial altamente eficiente e acionável. |
| `/admin/products` | Backoffice | **OK** | Tabela rica com busca, filtros de status e fotos. |
| `/admin/products/new` | Backoffice | **AJUSTAR** | Permitir variantes e estoque inicial antes de salvar. |
| `/admin/products/:id` | Backoffice | **OK** | Edição estável e completa. |
| `/admin/inventory` | Backoffice | **OK** | Ajuste manual e histórico de movimentações claros. |
| `/admin/production` | Backoffice | **OK** | Fluxo de manufatura e impressoras bem delineado. |
| `/admin/orders` | Backoffice | **OK** | Tabela com badges de status e modal de detalhes. |
| `/admin/affiliates` | Backoffice | **CORRIGIR** | Substituir campo de UUID por seleção amigável de usuário. |
| `/admin/marketplaces` | Backoffice | **AJUSTAR** | Reduzir número de abas e simplificar linguagem técnica. |
| `/admin/pricing` | Backoffice | **REDESENHAR** | Criar tela visual no frontend para gerenciar perfis do F12. |
| `/admin/niches`, `/categories`, `/tags` | Backoffice | **OK** | CRUDs limpos e funcionais. |
| `/admin/catalogs`, `/collections` | Backoffice | **OK** | Construtor de vitrines manuais e dinâmicas aprovado. |
| `/admin/divulgacao` | Backoffice | **OK** | Hub multicanal inovador para geração de links e embeds. |

---

## 18. Conclusão e Respostas aos 10 Pontos de Entrega

### 1. Top 10 Problemas do Produto
1. **Credenciamento de Afiliado com UUID obrigatório** (`AdminAffiliatesView`).
2. **Impossibilidade de cadastrar variantes na mesma tela de criação do produto** (`AdminProductForm`).
3. **Ausência de interface de Pricing F12 no menu administrativo**.
4. **Exposição do acesso ao Backoffice no Header da Loja Pública** (`Navigation`).
5. **Falta de input para saldo de estoque inicial durante o cadastro do produto**.
6. **Linguagem técnica interna vazando no Wizard de Marketplaces** (`F12`, `F13B`, `ProductChannelPrice`).
7. **Excesso de abas na tela de Marketplaces (9 abas)** causando fadiga visual.
8. **Sidebar administrativa empilhada sem menu drawer no mobile**.
9. **Falta de filtros visuais facetas/categorias na página pública `/produtos`**.
10. **Inconsistência de paleta entre módulos (`zinc` vs `slate`)**.

### 2. Top 10 Melhorias de Maior Impacto
1. **Autocomplete de usuários na criação de afiliados** (elimina a dependência de desenvolvedor/banco).
2. **Criação de Variantes em Memória no formulário de produto** (reduz cliques de 16 para 8).
3. **Inclusão do menu e tela visual de Pricing F12** (torna acessível o poderoso motor matemático).
4. **Remoção de "Área Administrativa" do header público** (eleva a credibilidade da marca).
5. **Campo "Estoque Inicial" integrado no produto** (elimina viagem desnecessária até `/admin/inventory`).
6. **Substituição de termos de arquitetura por termos comerciais no Marketplace Hub**.
7. **Agrupamento das abas técnicas de Marketplace em uma sub-área de "Diagnóstico"**.
8. **Menu gaveta (Drawer) responsivo no `AdminLayout`**.
9. **Filtros por categoria na listagem pública de produtos**.
10. **Ação "Produzir este item" direto do alerta de estoque no Dashboard e na tabela de estoque**.

### 3. Telas Aprovadas (OK)
- Home `/`, Detalhe do Produto `/produtos/:slug`, Catálogo Temático `/catalogos/:slug`, Carrinho `/carrinho`, Checkout `/checkout`, Confirmação `/pedido/:id`, Embed `/embed/products/:id`, Portal do Afiliado `/affiliate`, Central Comercial `/admin/dashboard`, Lista de Produtos `/admin/products`, Detalhe de Produto `/admin/products/:id`, Pedidos `/admin/orders`, Estoque `/admin/inventory`, Produção 3D `/admin/production`, Divulgação `/admin/divulgacao`, Nichos, Categorias, Tags, Temas, Catálogos e Coleções.

### 4. Telas que Precisam de Ajuste (AJUSTAR)
- `/produtos` (adicionar filtros visuais).
- `/admin/products/new` (adicionar variantes e estoque no mesmo fluxo).
- `/admin/marketplaces` (simplificar abas e microcopy).
- `AdminLayout` (adicionar menu drawer mobile e link de Pricing).

### 5. Telas que Precisam de Correção ou Redesenho (CORRIGIR / REDESENHAR)
- `/admin/affiliates` (**CORRIGIR:** remover campo UUID manual).
- `/admin/pricing` (**REDESENHAR:** criar a interface visual para o motor F12).

### 6. Fluxos Mais Longos
1. **Cadastrar Produto com Variantes e Estoque:** 3 telas, 22 cliques, 18 campos preenchidos.
2. **Publicar Produto no Mercado Livre com Preço Customizado:** 2 telas, 12 cliques, 4 passos no modal.

### 7. Problemas de Linguagem
- Exposição de jargões: `UUID`, `F7`, `F12`, `F13B`, `ProductChannelPrice`, `Idempotência`, `DiscrepancyReport`.

### 8. Problemas Mobile
- Modais com altura fixa cortando botões de rodapé em telas de 360px.
- Sidebar administrativa que empilha antes do conteúdo em vez de recolher.
- Tabelas com 7 a 8 colunas forçando scroll horizontal extenso sem colunas fixas.

### 9. Problemas de Permissão
- Clientes públicos visualizam links administrativos no header principal (embora haja bloqueio por senha ao clicar).
- Ausência de botão de perfil/sair visível na loja pública para clientes logados.

### 10. Ordem Recomendada de Correção
1. **Prioridade 1 (Crítico de Operação):** Corrigir input de UUID em `/admin/affiliates` para permitir credenciamento de afiliados via interface.
2. **Prioridade 2 (Experiência do Cliente):** Limpar o Header público, removendo botões administrativos para o cliente final.
3. **Prioridade 3 (Eficiência de Cadastro):** Unificar variantes e estoque inicial no formulário de produtos.
4. **Prioridade 4 (Comercial F12):** Criar a tela visual de Pricing no AdminLayout para dar visibilidade às margens e regras do motor.
5. **Prioridade 5 (Clareza do Hub):** Traduzir microcopy técnico do Marketplace Hub e reorganizar as 9 abas.
6. **Prioridade 6 (Mobile):** Implementar menu gaveta na barra lateral administrativa.
