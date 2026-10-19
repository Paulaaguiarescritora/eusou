# F16-B — Relatório de Pré-Verificação Técnica para Homologação Real do Mercado Pago

**Data**: 11/10/2026  
**Ambiente**: Desenvolvimento Local / Sandbox Mercado Pago  
**Objetivo**: Realizar a checagem técnica de pré-requisitos antes de qualquer nova tentativa controlada de pagamento.  
**Diretiva de Execução**: Não foram executados novos pagamentos, não foram criados pedidos, não foram alteradas credenciais ou código, nenhuma migration foi executada e nenhum commit/push foi efetuado.

---

## 1. Quadro de Verificação dos 16 Critérios Obrigatórios

| # | Item de Verificação | Status | Detalhes Técnicos / Evidência |
|:---|:---|:---:|:---|
| **1** | **Credenciais TEST configuradas** | **SIM** | `MERCADOPAGO_ENVIRONMENT="TEST"`, `MERCADOPAGO_ACCESS_TOKEN` com prefixo `TEST-`, `VITE_MERCADOPAGO_PUBLIC_KEY` com prefixo `TEST-`. |
| **2** | **Autenticação Mercado Pago** | **PASS** | Chamada técnica sanitizada a `GET /v1/payment_methods` retornou `HTTP 200 OK` (20 meios de pagamento ativos). |
| **3** | **MercadoPago.js v2** | **PASS** | Script oficial `https://sdk.mercadopago.com/js/v2` carregado no `index.html` e servido no frontend Vite. |
| **4** | **createCardToken disponível** | **PASS** | Consulta de teste a `GET /v1/payment_methods/search?bins=548083` via Public Key retornou `HTTP 200 OK` e método `master`. |
| **5** | **Provider correto** | **PASS** | `MercadoPagoProvider` inicializado em modo `TEST` no `PaymentService` (`providerName = 'MERCADO_PAGO'`). |
| **6** | **Endpoint correto** | **PASS** | Configurado para `POST https://api.mercadopago.com/v1/payments`. |
| **7** | **State Machine Payment → Order → Stock** | **PASS** | `OrderService.create()` gera pedidos estritamente com `status: PENDING`. Confirmação e baixa de estoque ocorrem exclusivamente em `handlePaymentSuccess()` com `PaymentStatus.PAID`. |
| **8** | **Webhook** | **PASS** | Endpoint `/payments/webhooks/mercadopago` ativo com validação HMAC-SHA256, consulta server-to-server e proteção de idempotência. |
| **9** | **Idempotência** | **PASS** | Layer 1 duplo clique com `X-Idempotency-Key` e chave única por transação ativa. `InventoryService` previne movimentações `OUT` duplicadas via `referenceId`. |
| **10** | **Observabilidade** | **PASS** | Mapeamento seguro de `orderId`, `idempotencyKey`, `providerPaymentId`, `failureCode`, `externalStatus` e `metadata` sem exposição de cartões, CVV ou tokens. |
| **11** | **Produto canônico disponível** | **PASS** | SKU `FEL-GAT-001` ("Porta Chaves Gatinho Felinodelia De Parede Minimalista") ativo com valor R$ 39,90. |
| **12** | **Estoque disponível** | **PASS** | Saldo atual de estoque consultado: **6 unidades** em `Inventory` (saldo positivo). |
| **13** | **Nenhum pagamento executado** | **CONFIRMAR** | Nenhuma chamada a `POST /v1/payments` ou teste de cartão/Pix foi efetuado. |
| **14** | **Nenhuma alteração de banco** | **CONFIRMAR** | Banco de dados PostgreSQL/Prisma intacto; nenhuma mutação ou migration realizada. |
| **15** | **Nenhuma alteração de credenciais** | **CONFIRMAR** | Arquivos `.env` mantidos exatamente como estavam. |
| **16** | **Nenhum commit/push** | **CONFIRMAR** | Nenhuma operação de Git commit ou push foi executada. |

---

## 2. Detalhamento dos Componentes

### 2.1 Configuração de Ambiente e SDK
- **Backend**: Conectado à API do Mercado Pago utilizando `TEST-7623363565484094-...` associado ao Seller ID `3260132`.
- **Frontend**: SDK v2 pronto para tokenização no cliente utilizando a Public Key de testes `TEST-37fcab39-...`.
- **Comunicação de Cartão**: O frontend gera o `cardToken` diretamente na infraestrutura do Mercado Pago e envia apenas o token sanitizado ao backend do EuSou.

### 2.2 Integridade da Máquina de Estados
- **Geração do Pedido**: `POST /orders` ➔ `Order.status = PENDING`. Nenhuma movimentação de estoque é gerada.
- **Sucesso (`PAID`)**: `POST /payments` (ou webhook) ➔ `Payment.status = PAID` ➔ `Order.status = CONFIRMED` ➔ `StockMovement.type = OUT` (`-1`).
- **Recusa / Falha (`FAILED`)**: `Payment.status = FAILED` ➔ Pedido **não** confirma ➔ Estoque permanece **intacto** (0 baixas).

### 2.3 Estoque e Produto Homologado
- **Produto**: `FEL-GAT-001`
- **Nome**: Porta Chaves Gatinho Felinodelia De Parede Minimalista
- **Valor Base**: R$ 39,90
- **Status Cadastral**: `ACTIVE`
- **Estoque em Prateleira**: `6 unidades`

---

## 3. Classificação Conclusiva

> ### **STATUS A — PRONTO PARA HOMOLOGAÇÃO REAL DO MERCADO PAGO**
>
> Todas as camadas técnicas, credenciais de teste, serviços em background (porta 3000 e 5173), produto canônico, estoque e garantias transacionais da máquina de estados foram validadas com sucesso.
