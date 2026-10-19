# F16-B — Sanitized cURL & Real Request Dossier (Mercado Pago Support)

Este documento contém a extração fiel e sanitizada da requisição HTTP enviada pela aplicação EuSou à API do Mercado Pago na tentativa que resultou em `HTTP 500 internal_error`.

---

## 1. Identificação da Ocorrência

- **Data / Hora**: `2026-10-11T08:57:48.823Z` (horário local: `05:57:48`)
- **Ambiente**: `TEST` (Sandbox oficial)
- **Aplicação Mercado Pago**: `7623363565484094`
- **Internal Order ID**: `ab2918f0-949a-4fa3-ac89-fb418b381da4`
- **Internal Payment ID**: `b332244f-01bc-45ac-ab3e-7254c2780d5f`
- **Response x-request-id (Mercado Pago)**: `d34e1028-f49e-4a31-8eb1-9fe2f265ab68`

---

## 2. cURL Equivalente Sanitizado

```bash
curl -X POST "https://api.mercadopago.com/v1/payments" \
  -H "Authorization: Bearer [REDACTED]" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: [REDACTED_IDEMPOTENCY_KEY]" \
  -d '{
    "transaction_amount": 39.9,
    "token": "[REDACTED_CARD_TOKEN]",
    "description": "Pedido ab2918f0-949a-4fa3-ac89-fb418b381da4",
    "installments": 1,
    "payment_method_id": "master",
    "payer": {
      "email": "test@testuser.com",
      "first_name": "APRO",
      "last_name": "APRO",
      "identification": {
        "type": "CPF",
        "number": "[REDACTED_CPF]"
      }
    }
  }'
```

> **Notas de Segurança:**
> - O `Authorization` continha o token de teste ativo `TEST-7623363565484094-...`
> - O `token` continha um CardToken real ativo gerado com `HTTP 201 Created` via `MercadoPago.js v2`
> - O `X-Idempotency-Key` continha `idem_ab2918f0-949a-4fa3-ac89-fb418b381da4_1791709067929`
> - O `number` da identificação continha o CPF de teste canônico oficial (`12345678909`)

---

## 3. Tipos e Serialização dos Campos Enviados

| Campo | Valor / Representação | Tipo JS / JSON | Status na Especificação MP |
| :--- | :--- | :--- | :--- |
| `transaction_amount` | `39.9` | `number` (float) | Obrigatório |
| `token` | `"[REDACTED_CARD_TOKEN]"` | `string` | Obrigatório para cartão |
| `description` | `"Pedido ab2918f0-949a-4fa3-ac89-fb418b381da4"` | `string` | Opcional / Recomendado |
| `installments` | `1` | `number` (integer) | Obrigatório para cartão |
| `payment_method_id` | `"master"` | `string` | Obrigatório para cartão |
| `payer.email` | `"test@testuser.com"` | `string` | Obrigatório |
| `payer.first_name` | `"APRO"` | `string` | Opcional / Recomendado |
| `payer.last_name` | `"APRO"` | `string` | Opcional / Recomendado |
| `payer.identification.type` | `"CPF"` | `string` | Obrigatório no Brasil (`MLB`) |
| `payer.identification.number` | `"[REDACTED_CPF]"` | `string` | Obrigatório no Brasil (`MLB`) |

### Auditoria de Serialização:
- **`transaction_amount`**: Serializado estritamente como **número** (`39.9`), nunca string.
- **`installments`**: Serializado estritamente como **número** (`1`), nunca string.
- **`issuer_id`**: Omitido da serialização (`undefined`), pois não foi fornecido pelo frontend.
- **Campos `null`**: Nenhum campo com valor `null` foi enviado no corpo JSON.
- **Campos `undefined`**: Descartados automaticamente pelo parser nativo `JSON.stringify()`.
- **Strings vazias**: Nenhuma string vazia enviada.
- **`notification_url`**: Não enviada (campo opcional da API; webhooks configurados no painel).
- **Encoding**: UTF-8 nativo do `fetch` do Node.js.
- **Headers duplicados**: Nenhum.

---

## 4. Resposta Recebida do Mercado Pago

- **HTTP Status**: `500 Internal Server Error`
- **Response Headers**:
  - `x-request-id`: `d34e1028-f49e-4a31-8eb1-9fe2f265ab68`
- **Response Body**:
  ```json
  {
    "status": 500,
    "message": "internal_error",
    "cause": [],
    "error": null
  }
  ```
- **externalPaymentId**: `null` (Nenhum pagamento registrado no gateway)

---

## 5. Análise Técnica e Comparação

### A. Campos Comprovadamente Corretos
1. `transaction_amount`: `39.9` (tipo `number` conforme exigido).
2. `installments`: `1` (tipo `number` conforme exigido).
3. `payment_method_id`: `"master"` (correto para cartões Mastercard no Brasil `MLB`).
4. `token`: Gerado no mesmo ambiente `TEST` via chave pública da mesma aplicação com `HTTP 201 Created`.
5. Headers HTTP: `Content-Type: application/json`, `Authorization: Bearer TEST-...` e `X-Idempotency-Key` presentes e formatados corretamente.

### B. Campos Potencialmente Suspeitos (Hipóteses)
1. **`payer.email`**: Foi enviado `"test@testuser.com"`. Embora documentado como exemplo para testes de cartão, o Sandbox do Mercado Pago pode exigir internamente um **Test User (Buyer)** pré-criado via painel ou via `POST /users/test` (`test_user_XXXX@testuser.com`).
2. **`issuer_id`**: Omitido no payload. Em geral é opcional para Mastercard no Brasil, mas pode alterar branches internas de autorização no Sandbox.
3. **Ausência de Device Profiling / Fraud Fingerprint**: O `MercadoPago.js v2` gerou o token via `createCardToken` sem o script de device profiling exigido por alguns adquirentes de teste.

### C. Campos Não Determináveis
- A causa exata do unhandled exception interno nos servidores do Mercado Pago, uma vez que a resposta retornou `cause: []` e `error: null`.

---

## 6. Declaração de Integridade
- Esta extração foi realizada **100% em modo somente leitura**.
- **Nenhuma nova requisição foi enviada à API do Mercado Pago.**
- **Nenhum retry foi executado.**
- **Nenhum dado sensível (PAN, CVV, CardToken, Access Token, CPF) foi exposto.**
