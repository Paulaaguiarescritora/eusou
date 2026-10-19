# EUSOU — RELATÓRIO DE CONSOLIDAÇÃO ARQUITETURAL
**Documento Técnico Oficial de Pré-Implementação**  
**Data:** 13 de Outubro de 2026  
**Status da Fase:** Somente Leitura e Diagnóstico (Nenhuma alteração de código ou banco executada)

---

## 1. VISÃO GERAL E OBJETIVO

O presente relatório consolida as análises técnicas da transição entre a auditoria geral e a arquitetura definitiva do **EuSou**, garantindo que:
1. **EuSou** permaneça estritamente como a **central administrativa privada** de gestão, matriz de produto, estoque físico e custos;
2. Os **Nichos** operem como **unidades comerciais autônomas** (Camada 2 e 3), possuindo suas próprias identidades públicas, catálogos, domínios e vitrines;
3. As vendas e pedidos rastreiem sua **origem comercial contextualizada** sem quebrar a centralização física dos produtos e do estoque.

Nenhuma alteração em banco, código, planilha ou infraestrutura foi realizada nesta etapa.

---

## A. O QUE FOI CONFIRMADO

1. **Centralidade Única do Produto (`Product` & `ProductVariant`):**
   - Confirmado no schema (`prisma/schema.prisma` linhas 124–174) que o cadastro mestre do produto é único e compartilhado globalmente.
   - Variantes (`ProductVariant`) e atributos (`ProductAttribute`, `VariantAttributeValue`) pertencem à matriz central. Não há duplicação de produtos entre nichos.

2. **Estoque Físico e Movimentações Centralizadas (`Inventory` & `StockMovement`):**
   - O estoque físico é atômico (`Inventory.quantity`) e auditado por `StockMovement` (linhas 899–918).
   - O saldo físico reflete a realidade da matriz de produção/armazenamento. Não existe multiplicação física de itens por canal ou nicho.

3. **Custo Base Central (`CostBasis` / `Material`):**
   - Os custos operacionais e de insumos continuam atrelados diretamente ao produto ou variante física, permitindo a correta apuração da margem em qualquer canal.

4. **Compatibilidade Estrutural da Planilha Oficial (`modelo_importacao_produtos_eusou.xlsx`):**
   - A planilha oficial de 29 linhas (5 variações + 24 produtos comerciais) permanece 100% aderente:
     - As colunas `CUSTO` e `ESTOQUE_INICIAL` referem-se estritamente à matriz central.
     - As colunas de canais (`MERCADO_LIVRE`, `FACEBOOK`, `SHOPEE`, `TIKTOK_SHOP`) e ofertas (`ATACADO`, `VAREJO`) mapeiam-se perfeitamente para as entidades comerciais e regras do motor F12.

5. **Associação N-para-N entre Produto e Nicho (`ProductNiche`):**
   - A tabela associativa `ProductNiche` (linhas 283–293) já existe no banco e permite que o mesmo produto seja comercializado em múltiplos nichos simultaneamente.

---

## B. O QUE PRECISA SER ALTERADO (DIAGNÓSTICO TÉCNICO DAS LACUNAS)

### 1. Desacoplamento da Identidade da Loja Pública (Camada 3)
* **Situação Atual:**
  - O frontend público (`frontend/src/App.tsx` e `Navigation.tsx`) ainda possui fallback hardcoded para a marca "EuSou" no cabeçalho e rodapé quando acessado diretamente na raiz (`/`).
  - O modelo `Niche` (`schema.prisma` linhas 225–238) possui apenas `id`, `name`, `slug`, `description` e `status`.
* **Alteração Necessária:**
  - O `Niche` deve suportar os atributos de apresentação pública da sua unidade de negócio:
    - Identidade da marca pública: `brandName` (opcional, defaults to `name`), `logoUrl`, `faviconUrl`.
    - Domínio/Host: campo `domain` (opcional, para resolução multi-tenant por Host HTTP) ou slug canônico.
    - Associação direta ou default a um `Theme` e `Catalog` público padrão do nicho.
  - O backend (`public-store.service.ts`) deve disponibilizar endpoint contextual `/public/store/context` que resolve o nicho e sua identidade a partir do subdomínio/domínio ou slug.
  - O frontend público deve consumir esse contexto e nunca renderizar a marca "EuSou", que permanece restrita às telas administrativas (`/admin`).

---

### 2. Rastreabilidade da Origem Comercial do Pedido (`Order`)
* **Situação Atual:**
  - O modelo `Order` (`schema.prisma` linhas 493–524) captura endereço, dados do comprador, totais, itens e `affiliateCode`.
  - Se o pedido vier de um marketplace integrado, existe a relação 1:1 `ChannelOrder`.
  - **Lacuna:** Pedidos gerados na loja própria (web) **não gravam de qual nicho ou canal comercial vieram**, nem registram o domínio de origem ou campanha de marketing.
* **Alteração Mínima Necessária:**
  - Adicionar ao modelo `Order` campos de rastreabilidade de origem (todos opcionais ou com defaults para não quebrar compatibilidade):
    - `nicheId` (UUID referenciando `Niche`, nullable): identifica a unidade comercial de onde a venda partiu.
    - `channelId` (UUID referenciando `Channel`, nullable): identifica se foi Loja Própria Varejo, Loja Própria Atacado, etc.
    - `originDomain` (String, nullable): armazena o host/domínio de onde o pedido foi fechado (ex: `loja.felinodelia.com.br`).
    - `utmSource`, `utmCampaign` (String, nullable): preserva parâmetros de divulgação e tráfego.

---

### 3. Preço por Nicho no Motor F12
* **Situação Atual:**
  - O modelo `ProductChannelPrice` (`schema.prisma` linha 1223) possui chave única:
    ```prisma
    @@unique([productId, channelId, variantId])
    ```
  - Isso vincula o preço ao **Produto + Canal + Variante**.
  - No modelo atual, o "Canal" é uma entidade genérica (ex: "Loja Própria", "Mercado Livre", "Shopee"). Se o Canal for global, o mesmo produto teria o mesmo preço na "Loja Própria" independentemente do Nicho.
* **Diagnóstico Técnico de Solução:**
  - Para suportar tecnicamente:
    $$\text{Product} + \text{Niche} + \text{Channel} \rightarrow \text{Price}$$
    sem duplicar o `Product`, existem duas abordagens arquiteturais limpas:
    1. **Abordagem Nativa por Niche no Preço (Recomendada no F12):** Tornar `nicheId` um campo opcional em `ProductChannelPrice` e atualizar a constraint única para:
       `@@unique([productId, channelId, variantId, nicheId])`.
       Quando `nicheId = null`, o preço vale para todos os nichos daquele canal (comportamento padrão atual). Quando preenchido, define o preço específico daquele produto naquele nicho.
    2. **Abordagem de Canal Segmentado:** Vincular o `Channel` ao `Niche` (ex: Canal "Loja Própria Pet Shop" vs "Loja Própria Decoração").
  - **Decisão Técnica:** A abordagem (1) é muito mais elegante e flexível, pois permite regras de margem específicas por perfil/nicho sem proliferar dezenas de canais redundantes.

---

### 4. Estoque Físico vs. Futura Reserva/Alocação
* **Situação Atual:**
  - O `Inventory` armazena `quantity` atômica por produto/variante.
  - O `StockMovementType` já prevê os enums `RESERVATION` e `RELEASE` (linhas 895–896).
* **Confirmação:**
  - A arquitetura está 100% pronta para no futuro receber uma tabela de alocação/reserva virtual (ex: `StockAllocation` por nicho/canal) debitando ou bloqueando temporariamente a quantidade disponível, sem nunca duplicar o estoque físico real. Nenhuma alteração é necessária agora.

---

## C. O QUE NÃO PRECISA SER ALTERADO

1. **Tabelas do Catálogo Central:**
   - `Product`, `ProductVariant`, `ProductAttribute`, `VariantAttributeValue`, `Media`: intocadas e perfeitamente modeladas.
2. **Tabela de Custos e Produção (F7):**
   - `CostBasis`, `Material`, `ProductionProfile`, `ProductionJob`: 100% centralizadas na matriz EuSou, sem alteração.
3. **Estrutura de Categorias Hierárquicas:**
   - `Category` já possui `nicheId` (`Category.nicheId`, linha 252) e `parentId` para subcategorias. Perfeitamente compatível com a árvore `Nicho -> Categoria -> Subcategoria`.
4. **Planilha Oficial:**
   - O arquivo `modelo_importacao_produtos_eusou.xlsx` não sofre nenhuma mudança.
5. **Módulos F16 (Pagamentos) e F6 (Afiliados):**
   - Toda a estrutura de autorizações, split e reconciliação permanece válida.

---

## D. IMPACTO DAS ALTERAÇÕES PROPOSTAS

| Módulo | Tipo de Impacto | Complexidade | Risco de Quebra |
| :--- | :--- | :--- | :--- |
| **Identidade da Loja Pública** | Adição de campos em `Niche` e ajuste no Header/Footer do frontend | Baixa | Nulo (valores default preservam compatibilidade) |
| **Origem do Pedido (`Order`)** | Adição de colunas opcionais (`nicheId`, `originDomain`, etc.) em `Order` | Baixa | Nulo (pedidos existentes continuam válidos com campos nulos) |
| **Preço por Nicho (`F12`)** | Adição de `nicheId` opcional em `ProductChannelPrice` e ajuste de índice | Média | Baixo (preços existentes sem niche continuam operando como preço global) |
| **Estoque e Produção** | Nenhum | Zero | Zero |

---

## E. ENTIDADES E TABELAS ENVOLVIDAS

1. **`Niche` (`backend/prisma/schema.prisma`):**
   - Proposta de novos campos opcionais:
     - `brandName String?`
     - `domain String? @unique`
     - `logoUrl String?`
     - `faviconUrl String?`
     - `defaultCatalogId String?`
     - `defaultThemeId String?`

2. **`Order` (`backend/prisma/schema.prisma`):**
   - Proposta de novos campos opcionais:
     - `nicheId String?` (com relação `@relation(fields: [nicheId], references: [id])`)
     - `originDomain String?`
     - `channelId String?` (com relação opcional a `Channel`)
     - `utmSource String?`
     - `utmCampaign String?`

3. **`ProductChannelPrice` (`backend/prisma/schema.prisma`):**
   - Proposta de novo campo opcional:
     - `nicheId String?` (com relação `@relation(fields: [nicheId], references: [id])`)
     - Revisão do índice único para `@@unique([productId, channelId, variantId, nicheId])`.

---

## F. NECESSIDADE DE MIGRATION

* **Sim, haverá necessidade de migration quando a implementação for autorizada.**
* **Características da Migration Proposta:**
  - **100% Não-Destrutiva (Additive Only):** Todas as colunas adicionadas serão anuláveis (`nullable`) ou com valores `default`.
  - **Zero Perda de Dados:** Nenhum dado de pedidos anteriores, regras de preços, produtos ou logs será apagado ou corrompido.
  - A migration registrará os novos campos e índices de forma transparente via Prisma Migrate.

---

## G. O QUE FICARÁ PARA A PRÓXIMA ETAPA

Após a aprovação deste diagnóstico técnico pela equipe, o roteiro de execução será:

1. **Fase de Aplicação da Consolidação (Próxima etapa imediata):**
   - Criar e aplicar a migration com os campos propostos em `Niche`, `Order` e `ProductChannelPrice`.
   - Atualizar os serviços backend (`order.service.ts`, `public-store.service.ts`, `pricing.service.ts`).
   - Atualizar os componentes frontend (`Header`, `Footer`, `CheckoutView`, `App.tsx`) para consumir e injetar a identidade e origem do nicho dinamicamente.
2. **Fase de Carga de Dados e Catálogo:**
   - Importar oficialmente os 29 produtos da planilha oficial `modelo_importacao_produtos_eusou.xlsx`.
3. **Fase de Go-Live Comercial:**
   - Configuração da política de frete para lançamento.
   - Configuração das credenciais de Produção do Mercado Pago para homologação da primeira venda real via PIX de R$ 1,00.
