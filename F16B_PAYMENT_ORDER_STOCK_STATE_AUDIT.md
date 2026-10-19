# F16-B — Auditoria de Consistência State Machine: Payment → Order → Stock

**Data**: 11/10/2026  
**Ambiente**: Backend NestJS + PostgreSQL (Prisma ORM)  
**Objeto da Auditoria**: Pedido `801f3b6f-9243-4539-adff-3eff35b2a875` (e retrospectivamente os pedidos `348eea11...` e `93990cd6...`)  
**Cenário Identificado**:  
- `Payment.status`: `FAILED` (`failureCode: 500`, `failureMessage: internal_error`)
- `Order.status`: `CONFIRMED`
- `StockMovement`: `OUT` (-1 unidade)
- `externalPaymentId`: `null` (Nenhum pagamento efetivado no gateway)

---

## 1. Qual serviço/método alterou o Order para `CONFIRMED`?

**Serviço / Método**: `OrderService.create()` em [`backend/src/order/order.service.ts`](file:///d:/eusou/backend/src/order/order.service.ts#L101-L125).

### Evidência no Código:
```typescript
// backend/src/order/order.service.ts (linhas 101-121)
const order = await this.prisma.order.create({
  data: {
    customerName: dto.customerName.trim(),
    // ...
    status: OrderStatus.CONFIRMED, // Mock payment confirms order (LEGACY F3/F7)
    // ...
  },
  // ...
});
```

O método `OrderService.create()` persiste o pedido **diretamente com status `CONFIRMED` no momento de sua criação**, herdando uma premissa legada da fase de mock inicial (comentada no próprio código como `// Mock payment confirms order`). O pedido nasce imediatamente como `CONFIRMED` no banco de dados antes mesmo de qualquer tentativa de pagamento ser iniciada.

---

## 2. Qual serviço/método criou o StockMovement `OUT`?

**Serviço / Método**: `InventoryService.handleOrderConfirmed()` em [`backend/src/inventory/inventory.service.ts`](file:///d:/eusou/backend/src/inventory/inventory.service.ts#L221-L260), disparado por `OrderService.create()` em [`backend/src/order/order.service.ts`](file:///d:/eusou/backend/src/order/order.service.ts#L146-L149).

### Evidência no Código:
```typescript
// backend/src/order/order.service.ts (linhas 146-149)
// F7: Deduct stock on confirmation
if (order.status === OrderStatus.CONFIRMED) {
  await this.inventoryService.handleOrderConfirmed(order.id);
}
```
Como o pedido foi criado já com status `CONFIRMED`, o `if (order.status === OrderStatus.CONFIRMED)` avalia imediatamente como verdadeiro, invocando a dedução de inventário e gerando o registro `StockMovement` com tipo `OUT` e quantidade `-1`.

---

## 3. Qual condição permitiu essas ações apesar de `Payment = FAILED`?

A condição que permitiu esse comportamento foi o **desacoplamento assíncrono invertido entre criação de pedido e processamento de pagamento**:

1. **Separação de Rotas HTTP**:
   - `POST /orders` cria a ordem de compra.
   - `POST /payments` recebe o `orderId` e tenta efetuar a cobrança junto ao provedor (`MercadoPagoProvider`).
2. **Ausência de Reversão em caso de `PaymentStatus.FAILED` quando o pedido não está `PENDING`**:
   No `PaymentService` ([`backend/src/payment/payment.service.ts`](file:///d:/eusou/backend/src/payment/payment.service.ts#L350-L370)):
   ```typescript
   private async handlePaymentFailed(payment: Payment, order: any) {
     if (order.status === OrderStatus.PENDING) {
       await this.prisma.order.update({
         where: { id: order.id },
         data: { status: OrderStatus.CANCELLED },
       });
       // ...
     }
   }
   ```
   - O `PaymentService` espera que um pedido recém-criado aguardando pagamento esteja com status `PENDING`.
   - Se o pagamento falhar, a intenção da arquitetura era transicionar o pedido de `PENDING` para `CANCELLED`.
   - No entanto, como `OrderService.create()` gravou o pedido já como `CONFIRMED`, a condição `if (order.status === OrderStatus.PENDING)` não é atendida e o pedido permanece permanentemente `CONFIRMED`.
   - Além disso, no fluxo síncrono de criação de pagamento (`POST /payments`), quando `res.status === 500`, o `PaymentService` apenas grava a entidade `Payment` com status `FAILED` e retorna o resultado sem cancelar a `Order` ou reverter o inventário.

---

## 4. Essa confirmação/baixa ocorreu ANTES ou DEPOIS da resposta HTTP 500?

**Ocorreu rigorosamente ANTES da resposta HTTP 500.**

### Rastreabilidade Cronológica nos Logs de Auditoria (`AuditLog`):
Consultando a trilha de auditoria do banco de dados para a transação `801f3b6f...`:

| Timestamp (UTC) | Entidade | Ação | Descrição / Contexto |
| :--- | :--- | :--- | :--- |
| **05:57:21.179Z** | `Order` (`801f3b6f...`) | `STOCK_OUT` | **Baixa de estoque efetuada pelo `InventoryService`** |
| **05:57:21.218Z** | `Order` (`801f3b6f...`) | `ORDER_CREATED` | Pedido persistido com status `CONFIRMED` |
| **05:57:53.618Z** | `Payment` (`c582d4e2...`) | `PAYMENT_CREATED` | **Recebimento da resposta `HTTP 500` do Mercado Pago e gravação de `Payment` como `FAILED`** |

**Intervalo**: A confirmação do pedido e a baixa de estoque aconteceram cerca de **32 segundos antes** de o Mercado Pago responder o `POST /v1/payments` com `HTTP 500`.

---

## 5. O fluxo é idempotente?

- **Em relação ao Estoque (`InventoryService.handleOrderConfirmed`)**: **SIM, É IDEMPOTENTE PARA BAIXA DUPLICADA.**  
  O `InventoryService` verifica se já existe uma movimentação `OUT` com `referenceId: orderId`. Havendo, ele aborta e não baixa duas vezes para o mesmo pedido.
- **Em relação à Transação Financeira vs. Pedido**: **NÃO É IDEMPOTENTE NEM CONSISTENTE.**  
  Se um pagamento falha, o cliente pode clicar novamente em pagar ou tentar outro cartão gerando novos registros de `Payment` vinculados a um pedido que o backend já considera irrevogavelmente faturado/confirmado, sem que haja validação de que os fundos foram garantidos.

---

## 6. O mesmo comportamento poderia ocorrer em produção?

**SIM, CERTAMENTE.**

Em ambiente de produção com credenciais reais (`APP_USR-...`), qualquer falha de pagamento (seja cartão recusado por saldo insuficiente `cc_rejected_insufficient_amount`, suspeita de fraude `cc_rejected_high_risk`, dados inválidos ou instabilidade momentânea do adquirente) resultará exatamente no mesmo cenário:
- O cliente verá erro de cartão na tela.
- O gateway não capturará nenhum centavo.
- O sistema EuSou manterá a `Order` como `CONFIRMED`.
- O produto físico terá seu estoque subtraído do inventário da loja.
- A equipe de expedição/produção receberá um pedido com status de faturado/confirmado sem que o pagamento tenha entrado na conta bancária/Mercado Pago da empresa.

---

## 7. Classificação Conclusiva do Risco

> ### **CLASSIFICAÇÃO: C — INCONSISTÊNCIA CRÍTICA QUE CONFIRMA PEDIDO E BAIXA ESTOQUE SEM PAGAMENTO APROVADO**

---

## 8. Correção Mínima Recomendada (Proposta Arquitetural — NÃO IMPLEMENTADA)

Para restabelecer a consistência transacional do ciclo de vida `Order → Payment → Stock`:

### Correção no Backend:
1. **Em [`backend/src/order/order.service.ts`](file:///d:/eusou/backend/src/order/order.service.ts)**:
   - Alterar o status inicial do pedido na criação:
     ```typescript
     status: OrderStatus.PENDING, // Pedido nasce aguardando pagamento
     ```
   - Remover a chamada prematura a `this.inventoryService.handleOrderConfirmed(order.id)` dentro do método `create()`.
   - Remover a dependência de simulação legada `MockPaymentProvider` de dentro do `OrderService.create()`, delegando o pagamento estritamente ao `PaymentService`.

2. **Em [`backend/src/payment/payment.service.ts`](file:///d:/eusou/backend/src/payment/payment.service.ts)**:
   - Garantir que a transição para `Order.status = CONFIRMED` e a respectiva baixa de estoque via `inventoryService.handleOrderConfirmed(order.id)` ocorram **exclusivamente** dentro de `handlePaymentSuccess()` quando `payment.status === PaymentStatus.PAID` (tanto via webhook quanto no retorno síncrono aprovado de cartão de crédito).
   - Manter a regra em `handlePaymentFailed()` para marcar `Order.status = CANCELLED` quando a tentativa final falhar ou expirar.

*(Nenhuma dessas alterações foi implementada. O código e o banco permanecem inalterados aguardando aprovação).*
