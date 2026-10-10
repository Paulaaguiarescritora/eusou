# F16-A — IMPLEMENTATION REPORT
## Implementação Técnica do Pagamento Real (Mercado Pago) no EuSou

**Data:** 10 de Outubro de 2026  
**Branch:** `feature/f16a-real-payment`  
**Commit:** `cf083cad67a7c29a55dd9e0f6132792cb2c479af`  
**Status da Fase:** **A — IMPLEMENTAÇÃO TÉCNICA COMPLETA**  
**Produção Comercial:** **NÃO HOMOLOGADA NESTA FASE (HOMOLOGAÇÃO EXTERNA PENDENTE PARA F16-B)**  

---

### 1. Baseline e Auditoria Pré-Implementação (Gate 2)
Antes de qualquer alteração de código, foram mapeados todos os módulos existentes:
- **F5 (Orders / Checkout / PaymentProvider):** Encontrada a abstração oficial `PaymentProvider` e seu `MockPaymentProvider` em `backend/src/order/payment/payment-provider.interface.ts`.
- **F6 (Affiliates):** Mecanismo de last-click e comissões preservado intacto.
- **F7 (Inventory):** Métodos atômicos `handleOrderConfirmed` e `handleOrderCancelled` garantindo deduplicação por `StockMovement`.
- **F12 (Pricing Engine):** Resolução de preços canônicos e snapshots históricos preservados intactos.
- **F14 (Commercial Dashboard):** Métricas e alertas consolidados sem alterações de contratos.
- **F15 (UX & Checkout):** Checkout público adaptado para suportar Pix e Cartão com tokenização sem vazamento de dados sensíveis.

**Divergências Encontradas no Blueprint Inicial:**
- No modelo de banco original de F5, `Order` não possuía uma tabela relacional de pagamentos (`Payment`). Os pagamentos eram simulados diretamente no `OrderService.create()`.
- **Resolução Arquitetural:** Foi criado o módulo dedicado `PaymentModule` e o model `Payment` com enums `PaymentStatus` e `PaymentMethod`, sem duplicar `Order`, preservando `OrderService` e integrando ambos via `order.payments`.

---

### 2. Arquitetura Implementada
A separação arquitetural obrigatória foi rigorosamente implementada:

```
OrderService (F5)
    ↓
PaymentService (F16)
    ↓
PaymentProvider (Interface Oficial)
    ├── MockPaymentProvider (Testes / CI / Fallback Dev)
    └── MercadoPagoProvider (Provedor Concreto Oficial)
```

- **Isolamento de Domínio:** `PaymentStatus` (PENDING, PROCESSING, AUTHORIZED, PAID, FAILED, CANCELLED, REFUNDED, PARTIALLY_REFUNDED, EXPIRED) é independente de `OrderStatus` (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED).
- **Fallback Seguro de Produção:** Se `NODE_ENV=production` e `MERCADOPAGO_ACCESS_TOKEN` não estiver configurado, o sistema **NÃO** faz fallback silencioso para `MockPaymentProvider`. Ele rejeita a operação com erro explícito (`UNCONFIGURED_PRODUCTION_GATEWAY`).

---

### 3. Documentação Oficial Mercado Pago Consultada
- **Documentação:** Portal Mercado Pago Developers (v1 Payments, Checkout API, Webhooks).
- **Endpoints Escolhidos:**
  - `POST /v1/payments`: Criar pagamento online transparente (Pix e Cartão de Crédito).
  - `GET /v1/payments/{id}`: Consulta do estado oficial do pagamento durante conciliação e webhooks.
  - `PUT /v1/payments/{id}`: Cancelamento de pagamentos pendentes/em processamento antes da captura (`status: "cancelled"`).
  - `POST /v1/payments/{id}/refunds`: Reembolso total ou parcial de pagamentos aprovados.
- **Motivo da Escolha:**
  - `/v1/payments` é o contrato oficial do Mercado Pago para checkout transparente online, compatível com Pix instantâneo (retornando QR code base64 e payload EMV copia e cola) e com tokens gerados pelo SDK de cartão (`card_token`), em conformidade com o PCI-DSS.

---

### 4. Fluxo Pix
1. Frontend envia dados do pedido e solicita pagamento Pix.
2. Backend valida os itens e recalcula o total histórico no `OrderService`.
3. `PaymentService` invoca `MercadoPagoProvider.createPayment()` com `payment_method_id: 'pix'`.
4. Idempotência é garantida enviando `X-Idempotency-Key`.
5. Gateway retorna `transaction_data.qr_code` e `transaction_data.qr_code_base64`.
6. Dados são persistidos na entidade `Payment` e retornados de forma limpa ao frontend.
7. Frontend exibe imagem do QR Code, campo de Copia e Cola e botão com feedback de cópia.
8. Webhook do Mercado Pago notifica o recebimento, o backend valida o estado na API oficial e atualiza `Payment = PAID` e `Order = CONFIRMED`.
9. `InventoryService.handleOrderConfirmed` dá baixa no estoque exatamente uma vez.

---

### 5. Fluxo Cartão de Crédito
1. Cartão de crédito coletado através de formulário seguro.
2. O sistema gera/recebe token seguro (`cardToken`). Nenhum número de cartão, CVV ou dados sensíveis trafegam ou são persistidos no banco de dados.
3. Backend valida total com base no pedido registrado.
4. Requisição com `X-Idempotency-Key`, `installments` e `token` enviada para `/v1/payments`.
5. Se aprovado imediatamente, o backend marca `Payment = PAID`, `Order = CONFIRMED` e aciona o estoque F7 e afiliados F6.
6. Se rejeitado, o código de falha (`status_detail`) é mapeado para mensagem natural em português (ex: "Saldo ou limite insuficiente no cartão", "Confira o código de segurança").

---

### 6. Idempotência em Duas Camadas
- **Camada 1 (EuSou Backend):**
  - Checagem prévia no banco de dados por `idempotencyKey` ou pagamentos ativos para a mesma ordem (`orderId` com status `PAID`, `PROCESSING` ou `PENDING`).
  - Previne cobrança duplicada caso o usuário clique duas vezes rapidamente no botão "Pagar".
- **Camada 2 (Mercado Pago):**
  - Envio obrigatório do cabeçalho `X-Idempotency-Key` com identificador único UUID/idempotente por requisição de escrita externa.

---

### 7. Webhook & Deduplicação de Notificações
- **Endpoint Dedicado:** `POST /payments/webhooks/mercadopago`
- **Validação de Integridade:** Suporte ao cálculo e verificação HMAC-SHA256 utilizando o cabeçalho `x-signature` (`ts`, `v1`, `x-request-id` e `data.id`).
- **Consulta à Fonte da Verdade:** O backend nunca confia cegamente no payload recebido; ele consulta `GET /v1/payments/{id}` no Mercado Pago para atestar o estado oficial.
- **Deduplicação de Eventos:** Se o mesmo webhook for recebido 3 vezes consecutivas, a primeira processa a transição, enquanto a 2ª e a 3ª identificam que o status já é o mesmo e são marcadas como `IGNORED`, garantindo que o estoque F7 seja debitado **apenas uma vez**.

---

### 8. Ordem de Confirmação & Integração com Estoque (F7)
```
Pagamento Confirmado no Gateway
              ↓
       Payment = PAID
              ↓
       Order = CONFIRMED
              ↓
  handleOrderConfirmed() [F7]
```
- Pagamentos com erro ou cancelados antes da aprovação não acionam baixa de estoque.
- Reembolso total de pedido pago cancela o pedido e invoca `handleOrderCancelled()`.

---

### 9. Rastreamento e Afiliados (F6)
- Preservados parâmetros de last-click (`affiliateCode`).
- Conversões e comissões permanecem vinculadas ao pedido sem recálculos duplicados por webhook.

---

### 10. Audit Log
Eventos registrados de forma auditável e sanitizada:
- `PAYMENT_CREATED`
- `PAYMENT_PAID`
- `PAYMENT_FAILED`
- `PAYMENT_CANCELLED`
- `PAYMENT_REFUNDED`
- `PAYMENT_WEBHOOK_RECEIVED`
- `PAYMENT_WEBHOOK_PROCESSED`
- `PAYMENT_WEBHOOK_IGNORED`
- `PAYMENT_WEBHOOK_FAILED`

Tokens de acesso, cartões e segredos são sanitizados automaticamente pelo `AuditLogService`.

---

### 11. Testes Automatizados
- **Testes Unitários e de Integração de Pagamento:** 11 novos testes cobrindo todas as regras críticas:
  - Inicialização segura e bloqueio de mock em produção.
  - Rejeição de valores divergentes enviados pelo frontend.
  - Prevenção de cobrança duplicada por duplo clique.
  - Fluxo Pix com geração de QR Code.
  - Deduplicação de Webhook (3 disparos = 1 baixa de estoque).
  - Reembolso com restauração de estoque.
  - Mapeamento de status e verificação de assinatura HMAC-SHA256.
- **Suíte Completa de Regressão (F5 a F16):**
  - **33/33 test suites passaram**
  - **265/265 testes passaram**
  - Zero regressões em F5, F6, F7, F9, F10, F12, F13, F14 e F15.

---

### 12. Build & Validação de Schema
- **Prisma Schema:** `npx prisma validate` — Válido.
- **Prisma Client:** `npx prisma generate` — Gerado.
- **Migration SQL:** `prisma/migrations/20261010020000_create_f16a_payments/migration.sql` aplicada com sucesso no Supabase.
- **Backend Build:** `npm run build` — Sucesso (dist gerada sem erros de compilação).
- **Frontend Build:** `npm run build` — Sucesso (TypeScript compilado e bundle gerado via Vite).

---

### 13. Limitações Conhecidas & Homologação Comercial Pendente
1. **Credenciais Reais de Produção:** O ambiente de homologação comercial requer a inserção de credenciais oficiais do Mercado Pago (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` e `MERCADOPAGO_WEBHOOK_SECRET`) no arquivo `.env` seguro do servidor.
2. **Homologação Comercial Efetiva:** A classificação atual é técnica (F16-A). A homologação comercial com transações bancárias em sandbox/produção externa será conduzida na fase F16-B.
