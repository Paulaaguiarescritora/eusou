# F16-B / CORREÇÃO DE VARIANTES — COR, CARRINHO, CHECKOUT E ESTOQUE

## 1. Problema Encontrado na Auditoria
Na auditoria prévia [F16B_VARIANT_COLOR_AUDIT.md](file:///d:/eusou/F16B_VARIANT_COLOR_AUDIT.md), o fluxo de variantes havia sido classificado como **D — RISCO COMERCIAL / OPERACIONAL** devido aos seguintes fatores:
1. **Checkout (UX):** A cor selecionada aparecia de forma tímida e apagada (`1x (Rosa)`), gerando dúvida para a cliente sobre qual variante estava comprando.
2. **Vitrine / Catálogo (Comportamento do Botão "+"):** O botão "+" nos cards de produto adicionava o item diretamente ao carrinho com `variantId: null` em produtos com variantes de cor obrigatórias, ignorando a seleção.
3. **OrderItem / Snapshot:** O snapshot imutável gravava apenas o nome base do produto (`productNameSnapshot: product.name`) e o SKU, sem garantir que o nome da variante ficasse blindado no texto do histórico caso o cadastro da variante fosse alterado no futuro.
4. **Estoque por Variante:** Não havia suporte no front office administrativo para direcionar ajustes manuais a variantes específicas, e o estoque do produto `FEL-GAT-001` existia apenas em nível global (`variantId: null`), sem registros específicos para as 4 cores (Vermelho, Preto, Rosa, Branco).

---

## 2. Correções Realizadas

### 2.1. CheckoutView (`CheckoutView.tsx`)
- Reformulado o resumo dos itens do pedido no checkout.
- Cada item agora exibe:
  - Miniatura (thumbnail) da imagem do produto/variante.
  - Nome do produto em negrito.
  - **Badge de Destaque Visual:**
    ```tsx
    <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-900 font-semibold text-[11px]">
      <span className="text-amber-700 font-normal">Cor / Opção:</span>
      <span className="font-bold text-amber-950">{i.variantLabel}</span>
    </div>
    ```
  - SKU da variante em fonte mono (`SKU: FEL-GAT-001-ROS`).
  - Quantidade destacada (`Quantidade: 1x`).
  - Preço unitário e subtotal por linha.

### 2.2. CartView (`CartView.tsx`)
- Alinhado o mesmo padrão visual de destaque no carrinho:
  - Adicionado badge de identificação de cor (`Cor: [Nome]`).
  - Exibição de SKU da variante.
  - Preservação integral de `productId`, `variantId`, `variantLabel`, `sku`, `quantity` e `unitPrice`.

### 2.3. Botão "+" da Vitrine e Catálogo (`ProductCard.tsx`)
- Corrigida a ação do botão "+":
  ```tsx
  const hasMultipleVariants = product.variants && product.variants.filter((v) => v.isActive !== false).length > 1;
  if (hasMultipleVariants) {
    onSelect(product); // Redireciona obrigatoriamente para a página do produto para seleção de cor
  } else {
    onQuickAdd(product);
  }
  ```
- O botão não permite mais adicionar silenciosamente produtos com múltiplas variantes sem que a cliente selecione a cor.

### 2.4. Tela de Produto (`ProductDetail.tsx`)
- Ao trocar a variante de cor (ex: de Vermelho para Rosa), se houver mídia correspondente cadastrada com o nome da cor, a imagem principal é sincronizada automaticamente para a cor escolhida.

### 2.5. Snapshot Histórico no Pedido (`OrderService.ts`)
- No backend, ao criar a ordem (`POST /orders`), o `productNameSnapshot` agora grava o nome completo composto:
  ```typescript
  if (variant.name && variant.name.trim()) {
    finalProductNameSnapshot = `${product.name} - ${variant.name.trim()}`;
  }
  ```
  Exemplo salvo no banco: `"Porta Chaves Gatinho Felinodelia De Parede Minimalista - Rosa"`.
- O `skuSnapshot` continua preservando `"FEL-GAT-001-ROS"`.
- O `variantId` continua preservando a chave estrangeira `"a27be689-7104-4ae4-9220-2f634bf408fd"`.
- **Resultado:** A cor fica historicamente imutável mesmo sem exigir migration no banco de dados.

### 2.6. Ajuste Manual de Estoque por Variante (`InventoryView.tsx`)
- O modal de ajuste manual de estoque no painel administrativo agora detecta as variantes do produto selecionado e oferece um seletor explícito de variante:
  - `Estoque Geral do Produto (sem variante)`
  - `Vermelho (FEL-GAT-001-VER)`
  - `Preto (FEL-GAT-001-PRE)`
  - `Rosa (FEL-GAT-001-ROS)`
  - `Branco (FEL-GAT-001-BCO)`
- O ADMIN pode lançar e ajustar saldos físicos reais para cada cor de forma auditada, usando a arquitetura existente do `InventoryService`.

---

## 3. Arquivos Alterados

1. [frontend/src/components/CheckoutView.tsx](file:///d:/eusou/frontend/src/components/CheckoutView.tsx): Resumo de itens com badge de cor, SKU e imagem.
2. [frontend/src/components/CartView.tsx](file:///d:/eusou/frontend/src/components/CartView.tsx): Exibição padronizada de cor e SKU no carrinho.
3. [frontend/src/components/ProductCard.tsx](file:///d:/eusou/frontend/src/components/ProductCard.tsx): Bloqueio de adição direta no botão "+" quando houver variantes obrigatórias.
4. [frontend/src/components/ProductDetail.tsx](file:///d:/eusou/frontend/src/components/ProductDetail.tsx): Sincronização de imagem da variante selecionada.
5. [frontend/src/components/InventoryView.tsx](file:///d:/eusou/frontend/src/components/InventoryView.tsx): Suporte a seleção de variante no ajuste manual de estoque.
6. [frontend/src/types.ts](file:///d:/eusou/frontend/src/types.ts): Campo opcional `altText` em media.
7. [backend/src/order/order.service.ts](file:///d:/eusou/backend/src/order/order.service.ts): Composição do nome da variante no `productNameSnapshot`.
8. [backend/src/order/order.service.spec.ts](file:///d:/eusou/backend/src/order/order.service.spec.ts): Testes de criação de pedido com variante Rosa e snapshot.
9. [backend/src/inventory/inventory.service.spec.ts](file:///d:/eusou/backend/src/inventory/inventory.service.spec.ts): Testes de baixa de estoque exclusiva por variante, bloqueio por saldo insuficiente e idempotência.

---

## 4. Avaliação de Migration / OrderItem
- **Necessidade de migration:** Não foi necessária migration nesta etapa.
- **Motivo:** O campo `productNameSnapshot` já existe na tabela `OrderItem` e, ao armazenar `"Porta Chaves Gatinho Felinodelia - Rosa"` juntamente com `skuSnapshot: "FEL-GAT-001-ROS"` e `variantId`, o histórico do pedido fica 100% blindado contra alterações futuras na tabela de catálogo, sem quebrar compatibilidade nem exigir migração de schema.
- **Caso futuro:** Se for estritamente desejado ter uma coluna separada `variantNameSnapshot VARCHAR(255)`, isso poderá ser incluído em uma janela de migration planejada.

---

## 5. Regras de Estoque e Isolamento
- Se a cliente comprar `FEL-GAT-001-ROS` (Rosa):
  - O `InventoryService` busca o registro específico de `variantId: a27be689...`.
  - Se o saldo da cor Rosa for 5 e a compra for de 1 unidade, o saldo da Rosa vai para 4.
  - As variantes Vermelho, Preto e Branco **permanecem intactas**.
  - Se o saldo da variante for insuficiente, o serviço rejeita com `BadRequestException` ("Estoque insuficiente para o item...").
  - A operação possui verificação de unicidade em `StockMovement` por `referenceType: 'ORDER'` e `referenceId: orderId`, garantindo **idempotência estrita** (não deduz duas vezes).

---

## 6. Testes Executados e Resultados

| Teste | Descrição | Resultado |
| :--- | :--- | :--- |
| **TESTE 1** | Selecionar Rosa no `ProductDetail` | **APROVADO** (`variantId: a27be689...`, `variantLabel: "Rosa"`) |
| **TESTE 2** | Adicionar Rosa ao carrinho | **APROVADO** (`variantId`, `sku` e `variantLabel` preservados) |
| **TESTE 3** | Abrir checkout e visualizar resumo | **APROVADO** (`Cor / Opção: Rosa` com badge âmbar visível) |
| **TESTE 4** | Clicar no botão "+" em card com múltiplas variantes | **APROVADO** (Redireciona para página de produto para escolha) |
| **TESTE 5** | Criar pedido com variante Rosa | **APROVADO** (`variantId`, `FEL-GAT-001-ROS` e `Nome - Rosa` no snapshot) |
| **TESTE 6** | Baixa de estoque de variante no `InventoryService` | **APROVADO** (Dedução atômica no registro da variante) |
| **TESTE 7** | Tentar vender variante com estoque insuficiente | **APROVADO** (`BadRequestException` bloqueia a confirmação) |
| **TESTE 8** | Isolamento de variantes | **APROVADO** (Outras cores não sofrem alteração) |
| **TESTE 9** | Idempotência da baixa de estoque | **APROVADO** (Segunda execução ignorada com segurança) |
| **TESTE 10** | Não execução de pagamento / gateway | **APROVADO** (Nenhum pagamento ou CardToken gerado) |
| **Suíte Backend** | `npm test` (Jest) | **33 Test Suites PASS / 283 Tests PASS** |
| **Build Backend** | `nest build` | **Sucesso** (Exit code 0) |
| **Build Frontend** | `tsc -b && vite build` | **Sucesso** (Exit code 0) |
| **Prisma Validate** | `npx prisma validate` | **Sucesso** (Schema válido) |

---

## 7. Status e Classificação

- **O problema D (Risco Comercial / Operacional) foi ELIMINADO.**
- O fluxo de produto, variante, carrinho, checkout, pedido e estoque está agora consistente e integrado.
- **Status F16-B:** Conforme instrução, o status não foi elevado para A.
- **F16-B PAYMENT TEST NÃO EXECUTADO.** O teste de pagamento via Mercado Pago continua pendente e nenhum pagamento real ou simulado foi processado.
