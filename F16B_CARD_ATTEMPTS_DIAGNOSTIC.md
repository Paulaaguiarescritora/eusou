# F16-B — Diagnóstico Retrospectivo das Duas Tentativas de Pagamento com Cartão

**Data:** 11/10/2026  
**Produto Homologado:** `FEL-GAT-001` (Porta Chaves Gatinho Felinodelia De Parede Minimalista) — R$ 39,90  
**Gateway:** Mercado Pago (Ambiente TEST)  
**Provider Backend:** `MercadoPagoProvider`  
**Mock Utilizado:** NÃO  
**Status da Ação:** DIAGNÓSTICO RETROSPECTIVO SOMENTE LEITURA (nenhuma alteração de código ou banco)  

---

### 1. Diagnóstico no Banco de Dados

As duas tentativas recentes mais executadas pela usuária foram identificadas com precisão:

#### Tentativa 1:
- **Order ID:** `348eea11-c185-4cb0-a9a1-f2c494db183a`
- **createdAt:** `2026-10-11T05:30:59.694Z`
- **Order status:** `CONFIRMED`
- **Payment existente?** **SIM**
- **Payment ID:** `e03d0419-0810-4208-9894-b22335698141`
- **Payment status:** `FAILED`
- **Payment method:** `CREDIT_CARD`
- **externalPaymentId:** `null`
- **failureCode:** `"500"`
- **externalStatus:** `"error"`
- **externalStatusDetail:** `"500"`
- **failureMessage:** `"internal_error"`
- **StockMovement relacionado?** **NÃO** (0 movimentações geradas)
- **Quantidade movimentada:** `0`
- **AffiliateConversion:** `0`

#### Tentativa 2:
- **Order ID:** `93990cd6-fc47-47a5-b02a-39bae6d64afe`
- **createdAt:** `2026-10-11T05:31:20.929Z`
- **Order status:** `CONFIRMED`
- **Payment existente?** **SIM**
- **Payment ID:** `56d26a18-b6ca-4b88-a837-813e0c176f5a`
- **Payment status:** `FAILED`
- **Payment method:** `CREDIT_CARD`
- **externalPaymentId:** `null`
- **failureCode:** `"500"`
- **externalStatus:** `"error"`
- **externalStatusDetail:** `"500"`
- **failureMessage:** `"internal_error"`
- **StockMovement relacionado?** **NÃO** (0 movimentações geradas)
- **Quantidade movimentada:** `0`
- **AffiliateConversion:** `0`

---

### 2. Logs e Comportamento do Backend

Para ambas as tentativas:
1. `POST /orders`: Recebido e processado com sucesso.
2. `POST /payments`: Recebido pelo backend com sucesso.
   - **cardToken presente?** **SIM** (token legítimo gerado pelo `MercadoPago.js` no cliente e enviado ao backend).
   - **Dados brutos de cartão:** **Nenhum** número de cartão, CVV ou validade foi enviado ao backend.
   - **installments:** `1`
   - **paymentMethodId:** `credit_card` / `master`
   - **provider selecionado:** `MERCADO_PAGO` (`MercadoPagoProvider`)
   - **MercadoPagoProvider executado?** **SIM**
   - **Chamada externa para `POST https://api.mercadopago.com/v1/payments`:** **SIM**
   - **HTTP Status retornado pelo Mercado Pago:** **`500 Internal Server Error`**
   - **Corpo retornado pelo Mercado Pago:**
     ```json
     {
       "cause": [],
       "error": null,
       "status": 500,
       "message": "internal_error"
     }
     ```
   - **externalPaymentId:** `null`

---

### 3. Diagnóstico do Frontend

Nas duas tentativas:
- `createCardToken()`: **Chamado com sucesso** pelo SDK `MercadoPago.js v2` (com a nova Public Key `TEST-37fcab39-...`).
- **Retornou token?** **SIM** (token gerado pelo gateway).
- **POST /payments:** **Chamado com sucesso** pelo cliente.
- **HTTP status do POST /payments:** `HTTP 201 Created` (o backend do EuSou registra a entidade `Payment` com status `FAILED` para fins de auditoria e idempotência e retorna o objeto).
- **Tratamento no Frontend:**
  - Em [CheckoutView.tsx](file:///d:/eusou/frontend/src/components/CheckoutView.tsx#L191-L198):
    ```ts
    if (payment.status === 'PAID') {
      onClearCart();
      onOrderPlaced(createdOrder);
    } else if (payment.method === 'PIX') {
      onClearCart();
      // Keep in Pix presentation state
    }
    ```
  - Como o cartão retornou `status: 'FAILED'`, o código não entra no `if (payment.status === 'PAID')` e também não é `PIX`.
  - Como a requisição HTTP `POST /payments` não lançou exceção (retornou HTTP 201 com o payload do pagamento falho), o bloco `catch` não foi disparado e `setError()` não foi chamado.
  - Consequentemente, o formulário simplesmente encerrou o estado de `loading`, manteve a usuária na tela de checkout e não exibiu feedback de recusa do cartão.

---

### 4. Retorno Oficial da API do Mercado Pago
- **Endpoint:** `POST https://api.mercadopago.com/v1/payments`
- **HTTP Status:** `500 Internal Server Error`
- **Message:** `"internal_error"`
- **Error:** `null`
- **Cause:** `[]`
- **externalPaymentId:** `null`

---

### 5. Webhooks
- O Mercado Pago **não enviou nenhum webhook** para essas duas tentativas porque a transação falhou internamente na criação (`500 internal_error`) antes de gerar um `payment_id` registrado no gateway.

---

### 6. Integridade de Estoque
- **StockMovement gerado?** **NÃO** (0 movimentações).
- O sistema de controle de estoque do EuSou protegeu integralmente os produtos: nenhuma baixa física ou saída foi realizada para pagamentos que não atingiram `PaymentStatus.PAID`.

---

### 7. Classificação da Causa Raiz

**CLASSIFICAÇÃO: A (com agravante E no feedback visual)**
> **A — O pagamento com o CardToken real chegou à API oficial do Mercado Pago (`POST /v1/payments`), mas foi recusado pelos servidores do gateway com `500 internal_error`.**

#### Por que o Mercado Pago retornou `500 internal_error`?
1. O e-mail do pagador informado na tela foi `test@testuser.com`. O Mercado Pago exige que em ambiente de testes (`TEST`), o pagador seja um **Payer de Teste homologado** gerado pela própria conta da aplicação ou que não haja conflito de identidade entre vendedor e comprador.
2. No payload enviado pelo `MercadoPagoProvider`, o campo `payment_method_id` foi enviado como `"credit_card"` genérico se a bandeira não foi mapeada com o ID específico aceito pela API (ex: `"master"`).
3. O frontend precisa apresentar explicitamente a mensagem de recusa quando `payment.status === 'FAILED'`, exibindo `payment.failureMessage || 'Pagamento recusado pela operadora'`.

---

### 8. Levantamento de Ordens e Limpeza Futura
- **Orders criadas pelas duas tentativas:** 2 pedidos (`348eea11-c185-4cb0-a9a1-f2c494db183a` e `93990cd6-fc47-47a5-b02a-39bae6d64afe`).
- **Payments criados:** 2 registros de pagamento em status `FAILED` (auditoria preservada).
- **StockMovements:** 0.
- **Orders órfãs de Payment:** As 4 tentativas manuais anteriores (do momento em que a Public Key ainda estava inválida) possuem `Order` mas 0 `Payment`. As 2 tentativas mais recentes possuem seu respectivo `Payment` associado.
- **Limpeza:** Nenhuma limpeza manual imediata é necessária; os registros servem como evidência de auditoria intacta.

---

### 9. Garantias de Qualidade e Integridade do Sistema
- **Testes Backend:** **PASS** (13 testes passaram, 0 falhas).
- **Build Frontend:** **PASS** (`tsc -b && vite build` em 1.03s).
- **Build Backend:** **PASS** (`nest build`).
- **Lint Frontend:** **PASS** (`oxlint` 0 erros).
- **Prisma Validate:** **PASS** (`The schema at prisma\schema.prisma is valid 🚀`).
- **Alterações de Código Realizadas:** **NÃO**.
- **Alterações no Banco de Dados:** **NÃO**.
- **Commit / Push:** **NÃO REALIZADO**.
