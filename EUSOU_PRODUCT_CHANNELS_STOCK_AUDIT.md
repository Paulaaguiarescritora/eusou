# EUSOU — AUDITORIA DE ARQUITETURA: PRODUTOS, CANAIS COMERCIAIS E ESTOQUE CENTRAL

**Documento de Diagnóstico Arquitetural Pré-Implementação**  
**Data:** 13 de Outubro de 2026  
**Status:** SOMENTE LEITURA E DIAGNÓSTICO (Nenhum código ou banco alterado nesta etapa)

---

## 1. RESUMO EXECUTIVO

Esta auditoria avalia a aderência do código atual, schema do Prisma, APIs e telas do EuSou às 14 regras comerciais estabelecidas para o núcleo do sistema:
1. **Produto Central Único:** "Cadastrar uma vez. Organizar uma vez. Manter uma vez. Comercializar muitas vezes."
2. **Classificação Comercial:** `Nicho → Categoria → Subcategoria → Produto` (dinâmica por nicho).
3. **Canais Comerciais Dinâmicos e Extensíveis:** Canais não são campos fixos no produto; são entidades gerenciáveis.
4. **Disponibilidade Comercial por Seleção Múltipla:** Incluir/retirar produtos de canais de forma rápida e independente.
5. **Diferença Clara entre Retirar de Canal vs. Excluir Produto:** Retirar remove a oferta no canal; excluir remove a disponibilidade em todos os canais e exige confirmação explícita.
6. **Estoque Centralizado e Indivisível:** Estoque físico central de verdade; canais consultam o mesmo saldo físico.
7. **Estocar vs. Alocar:** Estocar = quantidade física real; Alocar = reserva/comprometimento lógico sem duplicação de saldo.

---

## A. O QUE JÁ ATENDE INTEGRALMENTE (CONFORMIDADE PLENA)

1. **Produto Central Único (`Product` e `ProductVariant`):**
   - No banco (`schema.prisma` linhas 70–174), o `Product` é único, global e indivisível. Não existe duplicação de produto para múltiplos nichos ou múltiplos canais.
   - Variantes (`ProductVariant`), fotos (`Media`) e atributos (`ProductAttributeValue`) pertencem exclusivamente ao produto mestre.

2. **Estoque Físico Central e Atômico (`Inventory` e `StockMovement`):**
   - O estoque físico é registrado em `Inventory.quantity` e auditado por `StockMovement`.
   - Vendas em qualquer canal abatem o mesmo estoque central atômico (`inventory.service.ts` linhas 240–304). Se o estoque diminui por uma venda no Mercado Livre ou Loja Própria, todos os demais canais enxergam o saldo atualizado.

3. **Canais Comerciais como Entidade Dinâmica no Banco (`Channel`):**
   - O modelo `Channel` (`schema.prisma` linhas 984–1005) é uma tabela autônoma (`id`, `name`, `type`, `isActive`, `description`, `icon`).
   - Novos canais podem ser criados, ativados ou desativados sem alterar a tabela `Product` (não existem colunas hardcoded como `isMercadoLivre` ou `isShopee` dentro de `Product`).

4. **Desacoplamento de Preços por Canal/Nicho (F12):**
   - Os preços por canal residem em `ProductChannelPrice`, associados via chave estrangeira ao produto, canal e nicho, preservando o produto mestre intacto.

---

## B. O QUE ATENDE PARCIALMENTE

1. **Classificação `Nicho → Categoria → Subcategoria → Produto`:**
   - **Banco:** O modelo `Category` suporta autorrelacionamento hierárquico (`parentId`) e vínculo com `Niche` (`nicheId`). A árvore `Nicho → Categoria Pai → Categoria Filha (Subcategoria)` existe conceitualmente.
   - **APIs:** `GET /categories/tree` retorna a árvore hierárquica.
   - **Lacuna/Divergência:** 
     - No formulário do produto (`AdminProductForm.tsx`), a seleção de categorias e nichos é feita em listas planas separadas, sem forçar visualmente ou funcionalmente a cascata `Nicho → Categoria → Subcategoria`.
     - O produto vincula-se tanto a `ProductNiche` quanto a `ProductCategory`. Não há validação impedindo associar um produto a uma subcategoria de um nicho diferente do nicho atribuído ao produto.

2. **Diferença entre Estocar e Alocar:**
   - **Banco:** `Inventory` possui os campos `quantity` (saldo físico) e `reservedQuantity` (alocação/reserva lógica). O enum `StockMovementType` possui `RESERVATION` e `RELEASE`.
   - **Lacuna:** A alocação atual é apenas um contador global (`reservedQuantity`), sem discriminação de *qual canal ou cliente* detém a alocação. Não há uma tabela `StockAllocation` vinculando `[productId, channelId, quantity]`.

3. **Exclusão de Produto (`DELETE /products/:id`):**
   - O backend implementa *Soft Delete* (`status = ARCHIVED`), preservando histórico de pedidos e auditoria.
   - **Lacuna:** Ao arquivar o produto no EuSou, o backend **não despublica ou cancela automaticamente** a oferta nas integrações de canais (`ChannelProduct`), nem possui modal de confirmação com aviso explícito no frontend ("Este produto será removido do EuSou e de todos os canais").

---

## C. O QUE ESTÁ DIVERGENTE OU INCOMPATÍVEL COM AS REGRAS

1. **Gestão de Canais no Produto (Módulo F9 vs. Experiência Central do Produto):**
   - **Divergência Atual:** A disponibilidade comercial em canais foi implementada como parte do conector técnico de marketplaces (`MarketplacesView.tsx` via `ChannelProduct` e `ChannelAccount`), exigindo conta externa configurada (`ChannelAccount`) e fluxo complexo de publicação (wizard em 4 etapas).
   - **Regra Exigida:** A seleção de canais comerciais deve ser **simples, prática e rápida diretamente no cadastro/edição do produto** via caixas de seleção múltipla (ex: ☑ Loja própria, ☑ Mercado Livre, ☐ Shopee, ☑ Catálogo Pet Shops).
   - Não se deve exigir conta OAuth ou payload complexo apenas para marcar que um produto está disponível em determinado canal comercial.

2. **Falta de Tabela Direta de Disponibilidade Comercial (`ProductChannel`):**
   - Atualmente, para ligar um produto a um canal, o sistema exige uma conta (`ChannelAccount`) e cria um `ChannelProduct`.
   - Canais que não sejam marketplaces automatizados (ex: "Catálogo Pet Shops", "Vendedores/Afiliados", "WhatsApp", "Catálogo Distribuidores", "Cliente Exclusivo") não possuem e nem precisam de `ChannelAccount` com OAuth ou tokens.
   - **Falta uma relação direta N-para-N simples entre `Product` e `Channel`** (ex: `ProductChannel`), representando a *disponibilidade comercial*, independente de integrações técnicas de sincronização.

3. **Exclusão no Frontend:**
   - Na listagem de produtos (`AdminProductsView.tsx`), não existe botão ou modal de exclusão com o texto de confirmação explícito exigido:
     > *"Excluir produto? Este produto será removido do EuSou e de todos os canais comerciais em que estiver disponível. [Cancelar] [Confirmar exclusão]"*

---

## D. O QUE PRECISA SER CRIADO

1. **No Banco de Dados (`schema.prisma`):**
   - **Tabela `ProductChannel` (Disponibilidade Comercial Direta):**
     ```prisma
     model ProductChannel {
       productId String
       channelId String
       isEnabled Boolean  @default(true)
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt

       product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
       channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)

       @@id([productId, channelId])
       @@index([productId])
       @@index([channelId])
     }
     ```
   - **Tabela Opcional Futura `StockAllocation` (quando a alocação por canal for ativada):**
     `(productId, channelId, allocatedQuantity)`.

2. **No Backend (APIs):**
   - Endpoint dedicado para gerenciar os canais do produto:
     - `GET /products/:id/channels` → retorna lista de canais e quais estão ativos para o produto.
     - `POST /products/:id/channels` ou `PUT /products/:id/channels` → atualiza os canais selecionados em lote `[channelId1, channelId2]`.
     - `DELETE /products/:id/channels/:channelId` → retira o produto exclusivamente daquele canal.
   - Hook de despublicação em cascata no `DELETE /products/:id`:
     - Ao excluir/arquivar o produto, desativar automaticamente todos os `ProductChannel` e pausar `ChannelProduct` associados.

3. **No Frontend:**
   - **Em `AdminProductForm.tsx`:** Adicionar a seção **"4. Canais Comerciais Disponíveis"** com checkboxes de seleção múltipla de todos os canais cadastrados no EuSou.
   - **Em `AdminProductsView.tsx`:**
     - Adicionar coluna ou badge mostrando rapidamente os canais em que o produto está ativo (ex: `Loja Própria`, `Mercado Livre`, etc.).
     - Adicionar botão de exclusão com **Modal de Confirmação Explícito** conforme exigido.
   - **Seletor Hierárquico em Cascata:** Ao cadastrar o produto, selecionar `Nicho` → filtra `Categorias` daquele nicho → seleciona `Subcategoria` vinculada.

---

## E. O QUE PRECISA SER ALTERADO (SEM QUEBRAR O QUE EXISTE)

1. **`ProductService`:**
   - Expandir `findById` e `findAll` para incluir `productChannels: { include: { channel: true } }`.
   - Adicionar método `assignChannels(productId, channelIds: string[])`.
   - Aprimorar `delete(productId)` para desativar ofertas ativas nos canais.

2. **`MarketplaceService` (F9/F13):**
   - Fazer com que a publicação técnica de marketplaces respeite a flag `ProductChannel.isEnabled`. Se o produto for desmarcado do canal no cadastro, o conector técnico pausa ou despublica o anúncio.

3. **`AdminProductForm.tsx`:**
   - Carregar a lista de canais disponíveis (`GET /admin/marketplaces/channels` ou `GET /channels`).
   - Permitir marcar e desmarcar canais com um clique e salvar junto com o produto.

---

## F. IMPACTO DAS ALTERAÇÕES

| Camada | Objeto | Impacto | Risco de Quebra |
| :--- | :--- | :--- | :--- |
| **Banco de Dados** | Criação de `ProductChannel` | Baixo (Tabela nova, aditiva, não altera tabelas existentes) | Nulo |
| **Backend** | Rotas de canais por produto e inclusão no `ProductService` | Baixo (Métodos novos e aditivos) | Nulo |
| **Frontend** | Seção de canais no formulário e modal de exclusão | Médio (UX aprimorada, visual direto e limpo) | Baixo |
| **Marketplaces (F9)** | Conectores continuam funcionando | Baixo (apenas consultam a nova disponibilidade) | Nulo |

---

## G. ANÁLISE DE IMPACTO NA EXCLUSÃO DO PRODUTO (REGRA 8)

A exclusão física direta via `prisma.product.delete()` causaria falhas de chave estrangeira (`foreign key constraint violation`) se o produto já possuir vendas registradas em `OrderItem`, pagamentos, movimentações em `StockMovement` ou logs fiscais.

### Comportamento Correto e Seguro:
1. **Se o produto NUNCA teve pedidos:**
   - Pode ser excluído completamente do banco (limpando variantes, mídias e canais em cascata).
2. **Se o produto JÁ POSSUI pedidos ou histórico:**
   - O sistema realiza **Desativação Total com Arquivamento Global**:
     - Status do Produto → `ARCHIVED`.
     - Remove disponibilidade de **TODOS** os canais comerciais (`ProductChannel` desativado / removido).
     - Despublica / pausa anúncios em marketplaces (`ChannelProduct` → `UNPUBLISHED` / `PAUSED`).
     - Remove das lojas públicas e catálogos.
     - Preserva o histórico financeiro e fiscal em `Order` e `StockMovement`.
3. **Modal de Confirmação no Frontend:**
   - Exige digitação ou confirmação explícita com o texto obrigatório:
     > *"Excluir produto? Este produto será removido do EuSou e de todos os canais comerciais em que estiver disponível. [Cancelar] [Confirmar exclusão]"*

---

## H. PLANO DE IMPLEMENTAÇÃO RECOMENDADO (ETAPAS CONTROLADAS)

### Etapa 1: Modelo e Relacionamento de Disponibilidade Comercial (Banco)
- Criar a tabela `ProductChannel` via migration não-destrutiva.
- Criar canais padrão na base (ex: *Loja Própria*, *Mercado Livre*, *Shopee*, *Catálogo Pet Shops*, *Catálogo Distribuidores*, *Vendedores/Afiliados*).
- Vincular os produtos existentes ao canal *Loja Própria* por padrão.

### Etapa 2: Backend & APIs de Disponibilidade de Canais
- Adicionar endpoints `/products/:id/channels` (listar, adicionar, retirar).
- Integrar a atribuição de canais no ciclo de vida de criação e edição do produto (`ProductService`).
- Atualizar a exclusão/arquivamento do produto para revogar a disponibilidade em todos os canais em lote.

### Etapa 3: Interface Administrativa (Frontend)
- Adicionar seção visual de **Canais Comerciais** com checkboxes de seleção múltipla em `AdminProductForm.tsx`.
- Adicionar visualização dos canais ativos na tabela `AdminProductsView.tsx`.
- Adicionar modal de confirmação explícita de exclusão.
- Refinar a hierarquia visual em cascata `Nicho → Categoria → Subcategoria`.

### Etapa 4: Testes Automatizados de Conformidade
- Teste: inclusão e retirada de produto em canal de forma independente.
- Teste: produto exclusivo em apenas um canal.
- Teste: confirmação de exclusão desativando todos os canais sem duplicar produtos.
- Teste: estoque físico central único compartilhado entre múltiplos canais.
