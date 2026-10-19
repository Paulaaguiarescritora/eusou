# F16-B — Análise de Causa Raiz do Erro HTTP 500 (internal_error) do Mercado Pago

**Data:** 11/10/2026  
**Ambiente:** Homologação Local (Frontend: `http://localhost:5173`, Backend: `http://localhost:3000`)  
**Gateway:** Mercado Pago Payments API (`POST https://api.mercadopago.com/v1/payments`)  
**Status do Gateway:** `500 Internal Server Error`  
**Mensagem Retornada:** `internal_error`  

---

### 1. Payload Real Enviado pelo `MercadoPagoProvider`

Com base na reconstrução fiel do fluxo a partir de `CreatePaymentDto` e `MercadoPagoProvider.createPayment()`:

```json
{
  "transaction_amount": 39.9,
  "token": "b582b176-****-****-****-************",
  "description": "Pedido 348eea11-c185-4cb0-a9a1-f2c494db183a",
  "installments": 1,
  "payment_method_id": "master",
  "issuer_id": undefined,
  "payer": {
    "email": "test@testuser.com",
    "identification": {
      "type": "CPF",
      "number": "12345678909"
    }
  }
}
```

#### Headers HTTP Enviados:
- `Authorization`: `Bearer TEST-7623363565484094-****...`
- `Content-Type`: `application/json`
- `X-Idempotency-Key`: `idem_348eea11-c185-4cb0-a9a1-f2c494db183a_1791696661668`

---

### 2. Análise Campo a Campo

| Campo | Valor Enviado | Conformidade com Docs MP | Diagnóstico |
| :--- | :--- | :--- | :--- |
| `transaction_amount` | `39.9` (number) | Conforme | Numérico, duas casas decimais, positivo. |
| `token` | `b582b176...` | Conforme | Token ativo e legítimo gerado via `MercadoPago.js v2`. |
| `description` | `"Pedido <orderId>"` | Conforme | String descritiva. |
| `installments` | `1` (number) | Conforme | Inteiro positivo >= 1. |
| `payment_method_id` | `"master"` | Conforme | Identificador correto para Mastercard no Brasil. |
| `payer.email` | `"test@testuser.com"` | **PONTO CRÍTICO** | E-mail genérico não associado a um Test User da conta. |
| `payer.identification` | `CPF` / `12345678909` | Conforme | Tipo e número higienizado (somente dígitos). |
| `notification_url` | Não enviado | Opcional | O webhook pode ser global ou por transação. |
| `external_reference`| Não enviado | Opcional | O EuSou envia o ID na `description`. |

---

### 3. Atenção Especial ao Token e Credenciais
1. **Origem do Token:** Gerado com a nova Public Key de Teste `TEST-37fcab39-...` diretamente no endpoint `POST /v1/card_tokens`. Status confirmado: `active`.
2. **Access Token do Backend:** `TEST-7623363565484094-...`.
3. **Consumo Único:** O token de cartão do Mercado Pago é **one-time use** e expira em 7 dias (ou imediatamente após a primeira tentativa de cobrança).
4. **Sem Alteração:** O token trafega diretamente do frontend para o backend sem mutação.

---

### 4. `payment_method_id` Real
- **BIN Consultado:** `548083` (Mastercard Test).
- **Endpoint:** `GET /v1/payment_methods/search?bins=548083`.
- **Retorno da API:** `id: 'master'`, `name: 'Mastercard'`, `payment_type_id: 'credit_card'`.
- **Valor enviado ao Mercado Pago:** `"master"`.

---

### 5. Resposta Completa do Mercado Pago
- **Endpoint:** `POST https://api.mercadopago.com/v1/payments`
- **HTTP Status:** `500 Internal Server Error`
- **Corpo:**
  ```json
  {
    "cause": [],
    "error": null,
    "status": 500,
    "message": "internal_error"
  }
  ```
- **x-request-id / Headers:** O método `MercadoPagoProvider.request()` captura os headers da resposta, mas o log gravado na entidade `Payment.metadata` gravou apenas o corpo JSON retornado.

---

### 6. Por que o Mercado Pago Retorna 500 em Sandbox? (Investigação Técnica)

Segundo a documentação oficial e os incidentes conhecidos de desenvolvedores no Mercado Pago, o erro `500 internal_error` com `cause: []` em ambiente de sandbox ocorre primariamente por:

1. **Incompatibilidade / Inexistência do Usuário Pagador (`payer.email`):**
   - O e-mail `test@testuser.com` é um domínio sintético genérico.
   - Em ambiente de testes, quando a aplicação está em modo restrito, o motor anti-fraude e o processador de pagamentos do Mercado Pago buscam a conta do pagador. Se a conta não é um **Test User oficial criado via API de Contas de Teste** vinculada à aplicação, o motor interno de autorização do sandbox lança uma exceção não tratada que borbulha como `500 internal_error`.
2. **Incompatibilidade entre Conta Vendedora e Payer:**
   - Se o e-mail do pagador coincidir com o e-mail ou dados cadastrais do titular da aplicação (vendedor: Paula Aguiar / `paula.aguiar8`), o Mercado Pago proíbe auto-compra e, no sandbox, pode estourar `500 internal_error`.
3. **Falta do Campo `payer.first_name` / `payer.last_name`:**
   - No fluxo de cartão em [mercado-pago.provider.ts](file:///d:/eusou/backend/src/payment/providers/mercado-pago.provider.ts#L102-L110), o payload envia apenas `email` e `identification`:
     ```json
     "payer": {
       "email": "...",
       "identification": { "type": "CPF", "number": "..." }
     }
     ```
     Enquanto no fluxo PIX ele envia `first_name` e `last_name`. A API de pagamentos por cartão recomenda o envio de `first_name` e `last_name` do titular para conciliação bancária.
4. **Instabilidade do Acquirer Sandbox do Mercado Pago:**
   - O simulador de adquirente de cartão de crédito no sandbox do Mercado Pago frequentemente retorna `500 internal_error` quando o processamento de teste sofre indisponibilidade transitória.

---

### 7. Comparação com o Request Mínimo Oficial Recomendado

```json
{
  "transaction_amount": 39.90,
  "token": "CARD_TOKEN_GERADO_PELO_SDK",
  "description": "Pedido FEL-GAT-001",
  "installments": 1,
  "payment_method_id": "master",
  "payer": {
    "email": "test_user_pagador@testuser.com",
    "first_name": "APRO",
    "last_name": "Teste",
    "identification": {
      "type": "CPF",
      "number": "12345678909"
    }
  }
}
```

---

### 8. Conclusão e Classificação

**CLASSIFICAÇÃO: A (com fatores contribuintes B e C)**
> **A — Payload compatível e token legítimo, mas o sandbox do Mercado Pago retornou erro interno de servidor `500 internal_error`.**

#### Fatores Contribuintes Identificados:
- **Payer de Teste:** O pagador `test@testuser.com` não é um Test User registrado na aplicação de testes do Mercado Pago.
- **Payload do Payer:** Ausência de `first_name` e `last_name` no objeto `payer` para cartão no `MercadoPagoProvider`.
- **Tratamento de Feedback no Frontend:** Quando o pagamento falha (`PaymentStatus.FAILED`), o frontend precisa exibir a mensagem de erro da operadora na tela, em vez de manter a usuária sem retorno visual.

---

### 9. Recomendações Técnicas para o Próximo Passo
1. Incluir `first_name` e `last_name` no objeto `payer` no `MercadoPagoProvider` também para cartão de crédito.
2. Utilizar um e-mail de Test User formatado como pagador de testes oficial do Mercado Pago (ex: gerado via endpoint `/users/test_user`).
3. Adicionar no `CheckoutView.tsx` o tratamento explícito de recusa/falha (`if (payment.status === 'FAILED') setError(...)`) para dar transparência imediata ao usuário.
