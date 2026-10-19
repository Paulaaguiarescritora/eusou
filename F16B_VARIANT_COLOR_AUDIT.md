# F16-B / UX — Auditoria de Variante de Cor no Checkout

## 1. Sumário Executivo & Classificação

**Classificação: D — RISCO COMERCIAL / OPERACIONAL** (com componente crítico de UX tipo B).

### Diagnóstico Resumido
1. **Frontend / UX:**
   - No `ProductDetail.tsx`, a cliente consegue selecionar a cor (ex: "Rosa", `id: a27be689-7104-4ae4-9220-2f634bf408fd`, `sku: FEL-GAT-001-ROS`).
   - O item entra no carrinho (`useCart.ts`) com `variantId`, `variantLabel: "Rosa"` e `sku: "FEL-GAT-001-ROS"`.
   - O carrinho (`CartView.tsx`) exibe o label da cor abaixo do título (`item.variantLabel`).
   - O checkout (`CheckoutView.tsx`) **tenta** exibir a cor na linha 573:
     ```tsx
     {i.quantity}x {i.variantLabel ? `(${i.variantLabel})` : ''}
     ```
     Porém, a tipagem e o layout são discretos / secundários, e no caso de Quick Add no catálogo/vitrine, o produto é adicionado **sem variante** (`variantId: null`, `variantLabel: undefined`).
2. **Backend / Snapshot Histórico:**
   - Ao criar a ordem (`POST /orders`), o `OrderItemDto` recebe `variantId`.
   - O modelo `OrderItem` do Prisma possui:
     - `variantId String?` (FK relacional com `ProductVariant`)
     - `productNameSnapshot String` (Snapshot histórico textual)
     - `skuSnapshot String?` (Snapshot do SKU da variante, ex: `FEL-GAT-001-ROS`)
   - **GARGALO DE DADOS HISTÓRICOS:** O `OrderItem` **NÃO possui** campo de snapshot para o nome da variante (`variantNameSnapshot` ou `colorSnapshot`). O nome do produto salvo é puramente `product.name` ("Porta Chaves Gatinho Felinodelia De Parede Minimalista"). A informação descritiva da cor "Rosa" depende exclusivamente do relacionamento com `ProductVariant` via chave estrangeira ou da inferência pelo sufixo do SKU (`-ROS`). Se a variante for alterada, renomeada ou excluída no backoffice, o snapshot perde a descrição textual da cor.
3. **Estoque (`Inventory`):**
   - O modelo `Inventory` suporta estoque por variante (`productId + variantId`).
   - No entanto, no banco de homologação atual, **apenas o registro geral de produto (`variantId: null`) possui saldo cadastrado** (`quantity: 6, reservedQuantity: 2`).
   - As 4 variantes de cor (**Vermelho, Preto, Rosa, Branco**) **não possuem linhas na tabela `Inventory`**.
   - No `InventoryService.handleOrderConfirmed`:
     ```ts
     const inventory = await prisma.inventory.findFirst({
       where: { productId: item.productId, variantId: item.variantId || null }
     });
     if (!inventory) {
       // fallback make-to-order: apenas cria StockMovement com quantity negativa sem validar estoque por cor!
     }
     ```
     Ou seja: se a cliente comprar a variante "Rosa", o sistema busca o estoque específico de `variantId: a27be...`. Como não encontra registro, ele **NÃO baixa o estoque do produto geral** (que tem 6 unidades) nem controla a quantidade de peças prontas na cor Rosa, caindo no fallback sem abatimento de saldo da tabela `Inventory`!
4. **Produção (`ProductionJob` / `ProductionProfile`):**
   - Os modelos Prisma de `ProductionJob` e `ProductionProfile` possuem campo `variantId`.
   - No entanto, atualmente há **0 ProductionProfiles** e **0 ProductionJobs** cadastrados no banco para o produto FEL-GAT-001.
   - O pedido (`Order`) não dispara criação automática de `ProductionJob`.

---

## 2. Auditoria da Tela do Produto (`ProductDetail.tsx`)

### Carregamento das Variantes
- As variantes são retornadas na rota pública `GET /public/products/porta-chaves-gatinho`.
- O endpoint retorna:
  ```json
  "variants": [
    {
      "id": "fb603618-d0eb-4fed-9edb-804fad1f6c23",
      "name": "Vermelho",
      "sku": "FEL-GAT-001-VER",
      "price": null,
      "isActive": true,
      "variantAttributeValues": []
    },
    {
      "id": "f5ffcf76-3886-4439-9616-e487a6efd4c5",
      "name": "Preto",
      "sku": "FEL-GAT-001-PRE",
      "price": null,
      "isActive": true,
      "variantAttributeValues": []
    },
    {
      "id": "a27be689-7104-4ae4-9220-2f634bf408fd",
      "name": "Rosa",
      "sku": "FEL-GAT-001-ROS",
      "price": null,
      "isActive": true,
      "variantAttributeValues": []
    },
    {
      "id": "117dda46-c854-4334-a5bc-d9525cac723c",
      "name": "Branco",
      "sku": "FEL-GAT-001-BCO",
      "price": null,
      "isActive": true,
      "variantAttributeValues": []
    }
  ]
  ```

### Seleção e Comportamento
- O estado inicial seleciona a primeira variante:
  ```tsx
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null,
  );
  ```
- O seletor exibe botões com os nomes das variantes ("Vermelho", "Preto", "Rosa", "Branco").
- Ao clicar em uma cor, `setSelectedVariant(v)` atualiza `selectedVariant`.
- **Identificadores armazenados:**
  - `selectedVariant.id` (ex: `a27be689-7104-4ae4-9220-2f634bf408fd`)
  - `currentSku = selectedVariant?.sku || product.sku` (ex: `FEL-GAT-001-ROS`)
  - `variantLabel = selectedVariant.name` (ex: `"Rosa"`)
- **Limitação observada na tela do produto:** A troca da variante de cor **não altera a imagem principal** automaticamente para a foto do gatinho na cor correspondente, pois as mídias estão cadastradas no nível do produto com `variantId: null` em vez de vinculadas a cada variante.

---

## 3. Auditoria do Carrinho (`useCart.ts` & `CartView.tsx`)

### Preservação dos Dados
Na função `handleAdd` de `ProductDetail.tsx`:
```tsx
onAddToCart({
  productId: product.id,
  variantId: selectedVariant?.id || null,
  name: product.name,
  variantLabel,
  sku: currentSku,
  imageUrl: selectedImage ? resolveMediaUrl(selectedImage) : null,
  unitPrice: currentPrice,
  quantity,
});
```
O item no carrinho contém:
- `productId`: `"854fee0d-8ba7-4381-bf1a-eeada2a5610a"`
- `variantId`: `"a27be689-7104-4ae4-9220-2f634bf408fd"`
- `name`: `"Porta Chaves Gatinho Felinodelia De Parede Minimalista"`
- `variantLabel`: `"Rosa"`
- `sku`: `"FEL-GAT-001-ROS"`
- `unitPrice`: `39.9`
- `quantity`: `1`

### Agrupamento e Exibição no Carrinho
- `useCart.ts` diferencia itens pela chave `productId + variantId`.
- No `CartView.tsx` (linhas 73-75):
  ```tsx
  <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
  {item.variantLabel && (
    <span className="text-xs text-slate-500 block">{item.variantLabel}</span>
  )}
  ```
- O carrinho exibe o label da cor ("Rosa").

---

## 4. Auditoria do Checkout (`CheckoutView.tsx`)

### Exibição Visual no Resumo do Pedido
No `CheckoutView.tsx` (linhas 568-580):
```tsx
<div className="space-y-3 max-h-72 overflow-y-auto pr-1">
  {items.map((i) => (
    <div key={`${i.productId}-${i.variantId}`} className="flex justify-between text-xs">
      <div>
        <span className="font-semibold text-slate-800 block">{i.name}</span>
        <span className="text-slate-500">
          {i.quantity}x {i.variantLabel ? `(${i.variantLabel})` : ''}
        </span>
      </div>
      <span className="font-bold text-slate-900">
        R$ {(i.unitPrice * i.quantity).toFixed(2).replace('.', ',')}
      </span>
    </div>
  ))}
</div>
```

### Problemas Observados no Checkout
1. **Hierarquia Visual Fraca:** O texto aparece compacto em cinza claro: `1x (Rosa)`. Não há destaque visual em bloco (ex: badge ou linha própria com `Cor: Rosa`), nem thumbnail da imagem do produto no resumo do checkout.
2. **Risco de Perda se Adicionado por Vitrine / Catálogo:** Se o cliente clica no botão "+" direto no catálogo ou página inicial (`ProductCard`), o handler `onQuickAdd` adiciona apenas `productId`, sem abrir modal para escolher a cor:
   ```tsx
   onQuickAdd={(prod) =>
     handleAddToCart({
       productId: prod.id,
       name: prod.name,
       unitPrice: prod.basePrice ? Number(prod.basePrice) : 0,
       quantity: 1,
       imageUrl: prod.media && prod.media[0] ? prod.media[0].url : null,
       nicheName: extractProductNiche(prod),
     })
   }
   ```
   Neste caso, `variantId` e `variantLabel` chegam como `null` ao checkout e ao pedido, mesmo sendo um produto com variantes de cor obrigatórias!

---

## 5. Auditoria do Payload do Pedido (`POST /orders`)

### Envio do Frontend
No `CheckoutView.tsx` (linhas 88-93):
```typescript
items: items.map((i) => ({
  productId: i.productId,
  variantId: i.variantId || undefined,
  quantity: i.quantity,
}))
```

### Exemplo de Payload Real Enviado:
```json
{
  "customerName": "Cliente Homologação",
  "customerEmail": "cliente@teste.com",
  "customerPhone": "11999999999",
  "street": "Rua Exemplo",
  "number": "123",
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01001-000",
  "items": [
    {
      "productId": "854fee0d-8ba7-4381-bf1a-eeada2a5610a",
      "variantId": "a27be689-7104-4ae4-9220-2f634bf408fd",
      "quantity": 1
    }
  ]
}
```

---

## 6. Auditoria de Order e OrderItem

### Validação do Prisma Schema e OrderService
- Modelo Prisma `OrderItem`:
  ```prisma
  model OrderItem {
    id                  String          @id @default(uuid())
    orderId             String
    productId           String
    variantId           String?
    productNameSnapshot String
    skuSnapshot         String?
    quantity            Int
    unitPrice           Decimal         @db.Decimal(10, 2)
    subtotal            Decimal         @db.Decimal(10, 2)
    createdAt           DateTime        @default(now())

    order               Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
    product             Product         @relation(fields: [productId], references: [id])
    variant             ProductVariant? @relation(fields: [variantId], references: [id])
  }
  ```

### Respostas às Perguntas de Auditoria:
- **OrderItem possui `variantId`?** Sim (`variantId String?`).
- **OrderItem possui snapshot da variante?**
  - O SKU da variante é gravado no snapshot: `skuSnapshot = variant.sku` (`FEL-GAT-001-ROS`).
  - **O NOME / COR da variante NÃO possui campo de snapshot dedicado** (não existe `variantNameSnapshot`).
- **O pedido preserva a cor escolhida depois de criado?**
  - Imediatamente após a criação, pode ser recuperada consultando `variant.name` através do relation `include: { variant: true }` ou inferida pelo `skuSnapshot` (`FEL-GAT-001-ROS`).
  - **Fragilidade Histórica:** Se um operador editar o nome da variante no catálogo para outro nome, ou excluir/desativar a variante, a informação nominal do pedido histórico não estará preservada em texto estático imutável no `OrderItem`, restando apenas o código `FEL-GAT-001-ROS`.

---

## 7. Auditoria de Estoque

### Como o estoque é controlado:
- O modelo `Inventory` possui chave única `@@unique([productId, variantId])`, permitindo controle tanto por produto geral (`variantId: null`) quanto por variante específica (`variantId: UUID`).
- **Estado atual no banco de dados:**
  ```json
  [
    {
      "id": "0ad4cccc-6c9f-412f-863c-ca641bdfa288",
      "productId": "854fee0d-8ba7-4381-bf1a-eeada2a5610a",
      "variantId": null,
      "quantity": 6,
      "reservedQuantity": 2,
      "minimumQuantity": 5
    }
  ]
  ```
  - Existe saldo apenas no produto geral (`variantId: null`).
  - **Não existem registros na tabela `Inventory` para as variantes `FEL-GAT-001-VER`, `PRE`, `ROS` ou `BCO`**.

### Comportamento na Confirmação do Pedido (`InventoryService.handleOrderConfirmed`):
Quando um pedido com a variante Rosa (`variantId: a27be689...`) é confirmado:
1. O backend busca `Inventory` onde `productId == product.id && variantId == item.variantId`.
2. Como não existe linha para essa variante, `inventory` retorna `null`.
3. O código entra no bloco de exceção Make-To-Order:
   ```ts
   if (!inventory) {
     await prisma.stockMovement.create({
       data: {
         productId: item.productId,
         variantId: item.variantId || null,
         type: StockMovementType.OUT,
         quantity: -item.quantity,
         referenceType: 'ORDER',
         referenceId: order.id,
         reason: `Venda Pedido #${order.id.slice(0, 8)}`,
       },
     });
     continue;
   }
   ```
4. **Consequência crítica:** O estoque físico de 6 unidades que está cadastrado no produto geral **NÃO é decrementado**. Apenas é gerada uma linha de histórico solta em `StockMovement`.
5. Se uma compra da variante "Rosa" for realizada, ela **NÃO baixa o estoque da variante Rosa** (porque a variante não tem saldo cadastrado) e **NÃO baixa o estoque do produto geral**.

---

## 8. Auditoria de Produção (`ProductionService` / `ProductionJob`)

### Capacidade do modelo:
- `ProductionJob` possui `variantId String?` e pode rastrear jobs por variante específica.
- `ProductionProfile` também possui `variantId String?`.

### Estado Atual no Banco:
- O produto FEL-GAT-001 possui **0 perfis de produção** e **0 ordens de produção** ativas.
- A criação de um pedido (`Order`) **não agenda ou gera automaticamente um `ProductionJob`**. A produção hoje depende de intervenção manual do operador no painel administrativo (`/admin/production`).
- No entanto, quando um operador abrir o pedido, o `skuSnapshot` (`FEL-GAT-001-ROS`) e a relação com a `variant` permitem saber que a cor é Rosa, desde que o pedido tenha sido criado via página de detalhes do produto.

---

## 9. Arquivos e Componentes Envolvidos no Fluxo

| Componente / Arquivo | Responsabilidade | Status na Auditoria |
| :--- | :--- | :--- |
| [ProductDetail.tsx](file:///d:/eusou/frontend/src/components/ProductDetail.tsx) | Seleção da variante de cor pelo cliente | **OK** (seleciona a variante e gera `variantLabel`) |
| [ProductCard.tsx](file:///d:/eusou/frontend/src/components/ProductCard.tsx) | Botão de compra rápida ("+") na vitrine | ⚠️ **FALHA**: Permite adicionar ao carrinho sem selecionar cor quando o produto tem variantes |
| [useCart.ts](file:///d:/eusou/frontend/src/useCart.ts) | Gerenciador de estado do carrinho | **OK** (preserva `variantId`, `variantLabel` e `sku`) |
| [CartView.tsx](file:///d:/eusou/frontend/src/components/CartView.tsx) | Visualização do carrinho | **OK** (exibe `item.variantLabel`) |
| [CheckoutView.tsx](file:///d:/eusou/frontend/src/components/CheckoutView.tsx) | Resumo do pedido e finalização | ⚠️ **UX DEFICIENTE**: Exibe `(Rosa)` muito pequeno; não destaca em linha própria |
| [OrderConfirmation.tsx](file:///d:/eusou/frontend/src/components/OrderConfirmation.tsx) | Tela de sucesso pós-pedido | ⚠️ **PARCIAL**: Mostra `productNameSnapshot` e `skuSnapshot`, mas não mostra o nome da cor explicitamente |
| [order.service.ts](file:///d:/eusou/backend/src/order/order.service.ts) | Criação e snapshot do pedido | ⚠️ **FALTA SNAPSHOT NOMINAL**: Grava `skuSnapshot`, mas não grava `variantNameSnapshot` |
| [inventory.service.ts](file:///d:/eusou/backend/src/inventory/inventory.service.ts) | Baixa de estoque | ⚠️ **RISCO OPERACIONAL**: Não há saldo por variante criado na tabela `Inventory`; baixa não abate o estoque geral |

---

## 10. Recomendações Objetivas para Implementação Posterior (Fase de Ajuste)

1. **UX no Checkout (`CheckoutView.tsx`):**
   - No resumo do pedido à direita, exibir a cor de forma destacada:
     ```tsx
     <div className="font-semibold text-slate-800">{i.name}</div>
     {i.variantLabel && (
       <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded bg-slate-100 text-[11px] font-medium text-slate-700">
         <span>Cor:</span> <strong>{i.variantLabel}</strong>
       </div>
     )}
     ```
   - Incluir a miniatura da foto do produto no resumo do checkout para confirmação visual rápida pela cliente.
2. **Prevenção de Pedido Sem Cor no Catálogo (`ProductCard.tsx`):**
   - Se o produto possuir variantes ativas (`product.variants.length > 0`), o botão "+" rápido deve redirecionar para a página do produto (`/produtos/:slug`) para forçar a escolha da cor, ou abrir um mini-modal de seleção de cor.
3. **Resguardo de Snapshot no Backend (`OrderItem`):**
   - Incluir o nome da variante no snapshot do item (seja em `productNameSnapshot: "Porta Chaves Gatinho Felinodelia - Rosa"` ou adicionando `variantNameSnapshot`).
4. **Alinhamento de Estoque (`Inventory`):**
   - Criar linhas de estoque para cada variante de cor em `Inventory`, distribuindo as unidades disponíveis entre as cores ativas (Vermelho, Preto, Rosa, Branco) para que a baixa por cor funcione de forma exata.

---

### Declaração de Conformidade
**F16-B PAYMENT TEST NÃO EXECUTADO.**  
Nenhum pagamento, criação de pedido, chamada de gateway ou modificação em banco de dados/código foi realizada durante esta auditoria.
