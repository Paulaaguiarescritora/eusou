# EUSOU — PLANO TÉCNICO DE IMPLEMENTAÇÃO: PRODUTOS, CANAIS COMERCIAIS E ESTOQUE CENTRAL

**Documento de Planejamento de Execução Controlada**  
**Data:** 13 de Outubro de 2026  
**Status:** AGUARDANDO APROVAÇÃO (Nenhuma alteração executada ainda)

---

## 1. PREMISSAS E DIRETRIZES CONSOLIDADAS

Com base na auditoria aprovada e nas três decisões explícitas:

1. **Relação Simples N:N (`ProductChannel`):**
   - Criação da tabela associativa direta entre `Product` e `Channel`.
   - Permite seleção múltipla rápida e flexível diretamente na gestão do produto (ex: ☑ Loja Própria, ☑ Mercado Livre, ☐ Shopee, ☑ Catálogo Pet Shops, etc.).
   - Incluir ou retirar de um canal deve ser uma operação instantânea e independente, sem exigir contas técnicas ou alterar o cadastro base do produto.

2. **Exclusão com Interrupção Total de Comercialização e Preservação de Histórico:**
   - A exclusão comercial de um produto retira imediatamente sua disponibilidade de **TODOS** os canais comerciais (`ProductChannel` desativado/removido e ofertas em canais interrompidas).
   - O registro técnico no banco é mantido como `ARCHIVED` para assegurar integridade referencial de pedidos já realizados (`Order`, `OrderItem`), movimentações históricas (`StockMovement`) e auditoria contábil.
   - O produto nunca mais aparece disponível em nenhuma vitrine, canal ou busca de clientes.
   - Exige confirmação explícita com o modal padronizado:
     > *"Excluir produto? Este produto será removido do EuSou e de todos os canais comerciais em que estiver disponível. [Cancelar] [Confirmar exclusão]"*

3. **Estoque Centralizado sem Alocação por Canal nesta Etapa:**
   - **NÃO** implementar a tabela `StockAllocation` agora.
   - O estoque físico real e atômico permanece centralizado em `Inventory.quantity` e auditado por `StockMovement`.
   - Todos os canais comerciais consultam e abatem o mesmo estoque físico central. A alocação/reserva segmentada por canal fica registrada para fases futuras.

---

## 2. DETALHAMENTO DAS ETAPAS DE IMPLEMENTAÇÃO

```mermaid
flowchart TD
    subgraph ETAPA 1 - BANCO DE DADOS
        M1[Criar Modelo ProductChannel no schema.prisma] --> M2[Gerar e Aplicar Migration Não-Destrutiva]
        M2 --> M3[Regenerar Prisma Client]
    end

    subgraph ETAPA 2 - BACKEND & APIS
        B1[Criar DTOs de Gestão de Canais do Produto] --> B2[Atualizar ProductService: assignChannels, listChannels]
        B2 --> B3[Atualizar exclusão: Interromper todos os canais atomicamente]
        B3 --> B4[Adicionar Endpoints REST em ProductController]
    end

    subgraph ETAPA 3 - FRONTEND & EXPERIÊNCIA ADMINISTRATIVA
        F1[AdminProductForm: Bloco Canais Comerciais com Checkboxes] --> F2[AdminProductsView: Badges de Canais Ativos]
        F2 --> F3[AdminProductsView: Modal de Confirmação Explícita de Exclusão]
        F3 --> F4[Cascata Visual Nicho -> Categoria -> Subcategoria]
    end

    subgraph ETAPA 4 - TESTES & VERIFICAÇÃO
        T1[Testes Automatizados de Inclusão/Retirada de Canal] --> T2[Teste de Exclusão Interrompendo Todos os Canais]
        T2 --> T3[Build, Lint e Verificação do Sistema]
    end

    ETAPA 1 --> ETAPA 2 --> ETAPA 3 --> ETAPA 4
```

---

### ETAPA 1: MODELAGEM NO BANCO DE DADOS (`schema.prisma` e Migration)

1. **Adicionar o modelo `ProductChannel`:**
   ```prisma
   model ProductChannel {
     id        String   @id @default(uuid())
     productId String
     channelId String
     isEnabled Boolean  @default(true)
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
     channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)

     @@unique([productId, channelId])
     @@index([productId])
     @@index([channelId])
     @@index([isEnabled])
   }
   ```
2. **Atualizar relações:**
   - Em `Product`: adicionar `productChannels ProductChannel[]`.
   - Em `Channel`: adicionar `productChannels ProductChannel[]`.
3. **Migration:**
   - Criar arquivo SQL aditivo: `prisma/migrations/..._create_product_channel_availability/migration.sql`.
   - Aplicar via `prisma migrate deploy` garantindo zero impacto em tabelas existentes.
   - Executar `prisma generate`.

---

### ETAPA 2: BACKEND & APIS REST

1. **DTOs (`backend/src/product/dto/`):**
   - `AssignChannelsDto`: `{ channelIds: string[] }`.
2. **Métodos no `ProductService`:**
   - `getChannels(productId: string)`: Retorna todos os canais do sistema com a flag `isAssigned: boolean` para aquele produto.
   - `assignChannels(productId: string, channelIds: string[], actorId?: string)`:
     - Sincroniza atomicamente em transação `prisma.$transaction`.
     - Permite ativar e desativar canais em massa sem recriar registros desnecessariamente.
     - Registra `AuditLog` (`PRODUCT_CHANNELS_UPDATED`).
   - `delete(productId: string, actorId?: string)` — **Interrupção Total de Comercialização:**
     - Altera status do produto para `ARCHIVED`.
     - Remove/desativa todos os registros em `ProductChannel` (`isEnabled = false` ou remoção da disponibilidade).
     - Pausa/despublica quaisquer anúncios técnicos associados em `ChannelProduct` (`status = PAUSED` / `UNPUBLISHED`).
     - Preserva integridade de `OrderItem`, `Order` e `StockMovement`.
     - Registra `AuditLog` com metadados de canais revogados.
3. **Novas Rotas no `ProductController`:**
   - `GET /products/:id/channels` → Lista status dos canais do produto.
   - `POST /products/:id/channels` → Atualiza canais selecionados para o produto.
   - `GET /channels` (ou via módulo existente) → Lista canais disponíveis no sistema para alimentar formulários.

---

### ETAPA 3: FRONTEND ADMINISTRATIVO

1. **Formulário do Produto (`AdminProductForm.tsx`):**
   - Carregar lista de canais disponíveis no início.
   - Criar seção visual clara: **"Canais Comerciais Disponíveis"**:
     - Checkboxes intuitivos lado a lado com ícones e status:
       - `[x] Loja Própria`
       - `[x] Mercado Livre`
       - `[ ] Shopee`
       - `[x] Catálogo Pet Shops`
       - `[ ] Catálogo Distribuidores`
       - `[ ] Vendedores / Afiliados`
     - Salva a seleção juntamente com a criação ou edição do produto.
   - Ajustar seleção de taxonomia para refletir a cascata `Nicho → Categoria → Subcategoria`.
2. **Listagem de Produtos (`AdminProductsView.tsx`):**
   - Adicionar coluna ou tags indicando onde o produto está à venda.
   - Adicionar botão **"Excluir"** em cada linha da tabela.
   - Criar **Modal de Confirmação Explícita de Exclusão**:
     - Título: *"Excluir produto?"*
     - Mensagem de aviso: *"Este produto será removido do EuSou e de todos os canais comerciais em que estiver disponível. O histórico de pedidos passados será preservado de forma segura."*
     - Botões: `[Cancelar]` e `[Confirmar exclusão]`.

---

### ETAPA 4: TESTES AUTOMATIZADOS DE CONFORMIDADE

Criar suíte de testes `product-channels-availability.spec.ts` validando:
1. **Seleção Múltipla de Canais:** Produto associado a múltiplos canais simultaneamente (`Loja Própria`, `Mercado Livre`, `Catálogo`).
2. **Inclusão e Retirada Independente:** Retirar o produto do canal `Mercado Livre` sem afetar sua presença em `Loja Própria`.
3. **Produto Exclusivo:** Produto cadastrado para apenas um canal comercial específico.
4. **Exclusão Segura e Interrupção Total:**
   - Exclusão do produto revoga imediatamente sua disponibilidade de todos os canais.
   - Produto fica inacessível comercialmente (`ARCHIVED`).
   - Pedidos antigos e histórico de movimentações permanecem intactos.
5. **Estoque Único Compartilhado:** Comprovação de que vendas em canais distintos debitam o mesmo `Inventory.quantity` central.

---

## 3. MATRIZ DE IMPACTO E SEGURANÇA

| Componente | Tipo de Modificação | Risco | Mitigação |
| :--- | :--- | :---: | :--- |
| **Banco de Dados** | Criação da tabela `ProductChannel` | Nulo | Tabela aditiva. Zero alteração em colunas existentes. |
| **Integridade de Pedidos** | Exclusão lógica com arquivamento e revogação de canais | Nulo | Não apaga linhas referenciadas por chaves estrangeiras. |
| **Estoque** | Consulta direta ao saldo físico central | Nulo | Sem duplicação de saldo nem criação de tabelas artificiais. |
| **Interface** | Adição de checkboxes e modal de confirmação | Baixo | Componentes testados localmente antes da liberação. |

---

## 4. O QUE NÃO SERÁ FEITO NESTA ETAPA

- **NÃO** implementar a tabela `StockAllocation`.
- **NÃO** importar os 29 produtos da planilha oficial.
- **NÃO** alterar a planilha oficial de importação.
- **NÃO** configurar Mercado Pago de Produção nem frete.
- **NÃO** alterar a lógica de comissões de afiliados (F6) ou custos de insumos (F7).

---

Aguardando sua autorização explícita para iniciar a implementação conforme este plano.
