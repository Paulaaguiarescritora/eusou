# F16-B — Diagnóstico Controlado do HTTP 500 (Tentativa Controlada Única)

**Data**: 11/10/2026  
**Ambiente**: Sandbox Mercado Pago (`MERCADOPAGO_ENVIRONMENT=TEST`)  
**Produto Testado**: `FEL-GAT-001` (Porta Chaves Gatinho Felinodelia) — R$ 39,90  
**Cartão de Teste**: Mastercard `5480 8328 0103 3311` | APRO | 11/30 | CVV 123  
**Comprador de Teste**: `test@testuser.com` | CPF `12345678909` | 1 parcela  
**Restrição de Execução**: Exatamente UMA tentativa controlada realizada sem alteração de código, banco, schema, credenciais ou arquitetura.

---

## 1. Verificação Prévia de Segurança e Registro de Dados

Antes da execução, foi verificado como a integração EuSou → Mercado Pago processa e persiste as informações:
- **HTTP status do Mercado Pago**: Registrado e mapeado (`failureCode: 500`).
- **Endpoint utilizado**: `POST https://api.mercadopago.com/v1/payments`.
- **Ambiente**: `TEST` (Sandbox oficial).
- **Payment Method ID**: `"master"`.
- **External Payment ID**: Persistido quando retornado (neste caso, `null` devido à falha remota).
- **Sanitização de Dados**:
  - Número de cartão, validade e CVV **NUNCA** trafegam pelo backend EuSou.
  - O `cardToken` é gerado diretamente no navegador/SDK client via `POST /v1/card_tokens`.
  - O `Access Token` é injetado via header `Authorization` e nunca gravado em logs ou banco.
  - A resposta bruta salva em `Payment.metadata` contém apenas a resposta pública sanitizada do gateway.

---

## 2. Resultado da Tentativa Controlada Única

### Identificadores da Tentativa:
- **Order ID**: `801f3b6f-9243-4539-adff-3eff35b2a875`
- **Payment ID**: `c582d4e2-2633-495b-b5a0-4fe4885c462d`
- **Timestamp**: `2026-10-11T05:57:53.562Z`
- **Idempotency Key**: `idem_801f3b6f-9243-4539-adff-3eff35b2a875_1791698272752`

### Etapa 1: Geração do CardToken (MercadoPago.js v2)
- **Endpoint**: `POST https://api.mercadopago.com/v1/card_tokens?public_key=TEST-37fcab39-...`
- **HTTP Status**: `201 Created`
- **Status do Token**: `active`
- **Resultado**: CardToken real gerado com sucesso imediato pelo sandbox do Mercado Pago.

### Etapa 2: Criação do Pagamento (`POST /v1/payments`)
- **HTTP Status retornado pelo Mercado Pago**: `500 Internal Server Error`
- **Corpo retornado pelo Mercado Pago**:
  ```json
  {
    "cause": [],
    "error": null,
    "status": 500,
    "message": "internal_error"
  }
  ```
- **externalPaymentId**: `null` (Nenhum pagamento foi gerado no lado do gateway)
- **Status do Pagamento no EuSou**: `FAILED`
- **Status do Pedido no EuSou**: `CONFIRMED`
- **Movimentação de Estoque**: 1 movimentação `OUT` vinculada à criação do pedido (`quantity: -1`). Nenhuma movimentação duplicada.

---

## 3. Registro Técnico de Cabeçalhos e Rastreabilidade

- **HTTP Status**: `500`
- **Message**: `internal_error`
- **Cause**: `[]` (array vazio, sem causas de validação de negócio)
- **Header x-request-id**: O `MercadoPagoProvider` atual captura os headers internamente em `res.headers`, mas a persistência no modelo `Payment.metadata` armazena estritamente o corpo JSON retornado (`res.data`).
- **Data da Transação**: `Sun, 11 Oct 2026 05:57:53 GMT`

---

## 4. Classificação Conclusiva

Conforme as diretrizes estabelecidas:

> ### **CLASSIFICAÇÃO: C — ERRO EXTERNO / INDETERMINADO**
>
> 1. O payload enviado pelo EuSou seguiu rigorosamente todas as diretrizes documentadas pelo Mercado Pago:
>    - `transaction_amount`: `39.9`
>    - `payment_method_id`: `"master"`
>    - `installments`: `1`
>    - `payer.email`: `"test@testuser.com"`
>    - `payer.identification`: `{ "type": "CPF", "number": "12345678909" }`
>    - `token`: CardToken ativo gerado com `HTTP 201`.
> 2. O Mercado Pago retornou novamente `HTTP 500 internal_error` com `cause: []`.
> 3. Nenhuma nova tentativa será executada.
> 4. Nenhuma alteração foi realizada em arquivos de código, banco ou credenciais.
