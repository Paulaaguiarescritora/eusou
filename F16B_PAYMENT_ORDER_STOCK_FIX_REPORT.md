# F16-B — Relatório de Correção Crítica da State Machine: Payment → Order → Stock

**Data**: 11/10/2026  
**Módulos Alterados**: Backend NestJS (`OrderModule`, `PaymentModule`, `InventoryModule`)  
**Status da Homologação**: **A — CORRIGIDO E HOMOLOGADO**  
**Diretiva de Segurança**: Nenhum pagamento real foi gerado, nenhum dado sensível foi exposto, nenhuma migration de banco foi necessária e nenhum commit/push foi efetuado.

---

## 1. Causa Raiz Identificada

Na implementação legada de prototipação (F3/F7):
1. O endpoint `POST /orders` invocava `OrderService.create()`, que persistia os pedidos diretamente com status `OrderStatus.CONFIRMED` (`// Mock payment confirms order`).
2. Imediatamente após a criação, `OrderService.create()` invocava `inventoryService.handleOrderConfirmed(order.id)`.
3. Essa ordem prematura provocava o abate de estoque (`StockMovement OUT`, `-1`) e confirmação do pedido **antes** de qualquer contato com o gateway financeiro.
4. Quando o cliente realizava o pagamento via `POST /payments` e o provedor retornava `FAILED` (como ocorreu nos testes com `HTTP 500 internal_error`), o `PaymentService` registrava `Payment.status = FAILED`, mas a `Order` continuava `CONFIRMED` e o estoque já subtraído.
5. O método de estorno/cancelamento `PaymentService.handlePaymentFailed()` possuía a condição `if (order.status === OrderStatus.PENDING)`. Como o pedido nascera como `CONFIRMED`, o cancelamento não ocorria, resultando em:
   `Payment = FAILED + Order = CONFIRMED + StockMovement OUT = -1`.

---

## 2. Arquivos Alterados

1. [`backend/src/order/order.service.ts`](file:///d:/eusou/backend/src/order/order.service.ts):
   - Alteração do status inicial do pedido na criação para `OrderStatus.PENDING`.
   - Remoção do instanciamento e chamada ao `MockPaymentProvider` legado dentro da criação do pedido.
   - Remoção da chamada prematura a `inventoryService.handleOrderConfirmed(order.id)` no método `create()`.
2. [`backend/src/order/order.service.spec.ts`](file:///d:/eusou/backend/src/order/order.service.spec.ts):
   - Atualização do teste de criação para validar que o pedido nasce estritamente como `OrderStatus.PENDING` e que `handleOrderConfirmed()` **não** é chamado na criação do pedido.
3. [`backend/src/payment/payment.service.spec.ts`](file:///d:/eusou/backend/src/payment/payment.service.spec.ts):
   - Adicionado conjunto completo de testes de máquina de estados (`describe('10. F16-B State Machine...')`) cobrindo todos os cenários obrigatórios: `FAILED`, `PAID`, retentativas, idempotência de webhooks duplicados, e consistência do `MockPaymentProvider`.
4. [`backend/src/marketplace/e2e-homologation.spec.ts`](file:///d:/eusou/backend/src/marketplace/e2e-homologation.spec.ts):
   - Atualizado o teste de fluxo E2E para confirmar explicitamente a nova regra: o pedido nasce `PENDING` e só abate o estoque após a transição para `CONFIRMED`.

---

## 3. Alterações Realizadas

### Em `OrderService.create()`:
```typescript
// ANTES
status: OrderStatus.CONFIRMED, // Mock payment confirms order
// ...
await this.paymentProvider.createPayment(...);
if (order.status === OrderStatus.CONFIRMED) {
  await this.inventoryService.handleOrderConfirmed(order.id);
}

// DEPOIS
status: OrderStatus.PENDING,
// Sem criação de pagamento fictício
// Sem chamada antecipada a handleOrderConfirmed
```

### Em `PaymentService`:
A lógica central já existente foi preservada e agora opera com plena integridade, pois recebe os pedidos no estado correto (`PENDING`):
- **Pagamento Aprovado (`PaymentStatus.PAID`)**:
  - Tanto no fluxo síncrono (cartão aprovado/Mock) quanto assíncrono (webhook de notificação Pix/cartão):
  - Chama o método central `handlePaymentSuccess(payment, order)`:
    1. Transiciona `Order` para `CONFIRMED`.
    2. Abate o estoque com proteção de idempotência via `inventoryService.handleOrderConfirmed(order.id)`.
    3. Notifica o subsistema de afiliados via `affiliateService.handleOrderStatusChanged()`.
- **Pagamento Falhado (`PaymentStatus.FAILED`)**:
  - `Payment` é salvo como `FAILED`.
  - A `Order` **NUNCA** transiciona para `CONFIRMED`.
  - O estoque **NUNCA** é abatido (nenhum `StockMovement OUT` é gerado).
  - Em fluxos de expiração ou webhook cancelado, transiciona para `CANCELLED`.
  - Em tentativas síncronas de cartão que falham, o cliente pode tentar novamente com outro cartão; quando aprovado, o fluxo transiciona e baixa o estoque uma única vez.

---

## 4. Comparativo de Fluxo: ANTES vs. DEPOIS

```
FLUXO ANTERIOR (COM INCONSISTÊNCIA):
[POST /orders] ──────────► Order = CONFIRMED ───► StockMovement OUT (-1)
                                 │
                                 ▼
[POST /payments] ────────► Gateway HTTP 500
                                 │
                                 ▼
                           Payment = FAILED
                           (Order permaneceu CONFIRMED!)
                           (Estoque permaneceu BAIXADO!)


FLUXO CORRIGIDO (F16-B):
[POST /orders] ──────────► Order = PENDING (Estoque INTACTO)
                                 │
                                 ▼
[POST /payments]
        │
        ├── Se FAILED/500 ──► Payment = FAILED
        │                     Order NÃO CONFIRMADO (sem baixa de estoque)
        │
        └── Se PAID ───────► Payment = PAID
                              └──► Order = CONFIRMED
                              └──► StockMovement OUT (-1) [1 única vez]
```

---

## 5. State Machine Final

| Evento | Status Inicial Order | Resposta do Provedor | Status Final Payment | Status Final Order | Estoque (`StockMovement OUT`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Criação do Pedido** | — | — | — | `PENDING` | **Nenhuma alteração (0)** |
| **Pagamento Falhou** | `PENDING` | `HTTP 500` / Recusa | `FAILED` | Permanece `PENDING` ou `CANCELLED` | **Nenhuma alteração (0)** |
| **Pagamento Aprovado** | `PENDING` | `HTTP 201` (`approved`) | `PAID` | `CONFIRMED` | **Exatamente 1 baixa (`-1`)** |
| **Retentativa (Falha ➔ Sucesso)**| `PENDING` | Falha 1 ➔ Sucesso 2 | `FAILED` ➔ `PAID` | `CONFIRMED` | **Exatamente 1 baixa (`-1`)** |
| **Webhook Duplicado** | `CONFIRMED` | `approved` repetido | `PAID` | `CONFIRMED` | **Ignorado idempotentemente (`-1`)** |

---

## 6. Prova de Estados Proibidos (Impossíveis após a Correção)

- ❌ `Payment FAILED + Order CONFIRMED`: **IMPOSSÍVEL.** Pedido só transiciona para `CONFIRMED` se o pagamento estiver `PAID`.
- ❌ `Payment FAILED + StockMovement OUT`: **IMPOSSÍVEL.** `handleOrderConfirmed` nunca é invocado quando `Payment` é `FAILED`.
- ❌ `Order CONFIRMED sem Payment PAID`: **IMPOSSÍVEL.** A criação do pedido não marca mais `CONFIRMED`.
- ❌ `StockMovement OUT provocado por criação de Order`: **IMPOSSÍVEL.** Linhas de dedução em `OrderService.create()` foram eliminadas.
- ❌ `Payment PENDING + Order CONFIRMED`: **IMPOSSÍVEL.** O pagamento pendente mantém o pedido em `PENDING`.

---

## 7. Resultados das Validações e Testes Automatizados

### A. Testes Unitários e de Integração
- **Suíte Completa do Backend**: **33 Test Suites PASS / 273 Tests PASS (100% de aprovação)**
  - `src/order/order.service.spec.ts`: **5/5 PASS**
  - `src/payment/payment.service.spec.ts`: **19/19 PASS** (incluindo os cenários F16-B)
  - `src/inventory/inventory.service.spec.ts`: **5/5 PASS**
  - `src/marketplace/e2e-homologation.spec.ts`: **9/9 PASS**

### B. Build e Validação de Esquema
- **Backend Build (`nest build`)**: **PASS (0 erros)**
- **Frontend Build (`tsc -b && vite build`)**: **PASS (0 erros)**
- **Prisma Validate (`npx prisma validate`)**: **PASS (The schema at prisma\schema.prisma is valid 🚀)**
- **ESLint nos Arquivos Modificados**: **PASS (0 erros)**

### C. Confirmação do Caso Real Auditado (`Order 801f3b6f...`)
- O pedido histórico `801f3b6f-9243-4539-adff-3eff35b2a875` que sofreu a inconsistência não foi alterado nem submetido a nova cobrança.
- Com a nova máquina de estados em vigor, nenhum novo pedido poderá reproduzir o cenário anterior: se uma nova tentativa resultar em `HTTP 500`, o pedido permanecerá não confirmado e o estoque permanecerá intacto.

---

## 8. Checklist de Diretrizes

- [x] Nenhum pagamento no Mercado Pago foi executado.
- [x] Nenhuma alteração foi feita em credenciais, Access Token ou Public Key.
- [x] Nenhuma alteração estrutural no banco / nenhuma migration necessária.
- [x] O MockPaymentProvider e o provedor real obedecem à mesma máquina de estados.
- [x] Nenhum commit ou push foi realizado.

---

## 9. Classificação Final

> ### **STATUS: A — CORRIGIDO E HOMOLOGADO**
>
> A consistência transacional e a máquina de estados `Payment → Order → Stock` foram totalmente restauradas. A falha de pagamento (`FAILED`) está matematicamente e logicamente dissociada de qualquer confirmação de pedido ou baixa de estoque.
