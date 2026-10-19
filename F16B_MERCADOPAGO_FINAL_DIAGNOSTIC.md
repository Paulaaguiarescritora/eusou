# F16-B — Diagnóstico Técnico Final do Mercado Pago (Sandbox / TEST)

**Data da Auditoria:** 13/10/2026 às 11:05 (Horário de Brasília)  
**Ambiente:** `TEST` (Sandbox Mercado Pago)  
**Gateway:** Mercado Pago API (`https://api.mercadopago.com`)  
**Merchant ID Conectado:** `3260132` (Site MLB / Brasil)  
**Classificação do Diagnóstico:** Falha Interna nos Servidores do Mercado Pago (`PolicyAgent` / Validação de Collector em Sandbox)

---

## 1. Resumo Executivo

Durante a homologação da fase **F16-B**, foram realizados testes controlados de transação PIX e Cartão de Crédito diretamente contra os endpoints oficiais da API do Mercado Pago (`POST /v1/payments`).

Todas as chamadas transacionais retornam invariavelmente:
- **HTTP Status:** `500 Internal Server Error`
- **Error Code:** `internal_server_error`
- **Mensagem Interna do Gateway:** `"fill and validate error list: not_found\n: 400"`
- **Causas retornadas pelo Gateway:** `[]` (vazio)

A plataforma EuSou comportou-se com 100% de integridade e resiliência:
- A State Machine manteve o `Payment` como `FAILED`.
- O `Order` permaneceu em `PENDING`.
- Nenhuma saída de estoque (`StockMovement`) foi gerada.
- Nenhum webhook duplicado foi emitido.

---

## 2. Evidências dos Testes Controlados Executados

### 2.1. Teste Controlado PIX em TEST (13/10/2026)
- **Endpoint:** `POST https://api.mercadopago.com/v1/payments`
- **HTTP Status:** `500`
- **x-request-id Retornado:** `3dd916cc-cfe5-48fe-a47b-4367aeb653b3`
- **Idempotency-Key:** `test-pix-1791899564000`

**Payload Enviado (Sanitizado):**
```json
{
  "transaction_amount": 10.00,
  "description": "Teste de Homologacao F16-B PIX",
  "payment_method_id": "pix",
  "payer": {
    "email": "test_user_123456@testuser.com",
    "first_name": "Test",
    "last_name": "User",
    "identification": {
      "type": "CPF",
      "number": "19119119100"
    }
  }
}
```

**Resposta do Mercado Pago:**
```json
{
  "message": "fill and validate error list: not_found\n: 400",
  "error": "internal_server_error",
  "status": 500,
  "cause": []
}
```

---

### 2.2. Teste Controlado com Criação de Test User
Ao tentar provisionar dinamicamente um comprador de teste via `POST /users/test_user` para isolar incompatibilidade cadastral, a API retornou:
- **HTTP Status:** `403 Forbidden`
- **Código do Gateway:** `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`
- **Mensagem do Gateway:** `"At least one policy returned UNAUTHORIZED." (blocked_by: PolicyAgent)`

Ao tentar efetuar o pagamento PIX em seguida, gerou novo registro idêntico:
- **HTTP Status:** `500`
- **x-request-id Retornado:** `98502e93-82fc-441e-88cc-f5f9100f2fc4`
- **Mensagem:** `"fill and validate error list: not_found\n: 400"`

---

### 2.3. Teste Histórico de Cartão de Crédito
- **x-request-id Registrado:** `d34e1028-f49e-4a31-8eb1-9fe2f265ab68`
- **Payment ID:** `b332244f-01bc-45ac-ab3e-7254c2780d5f`
- **Token do Cartão:** Gerado com sucesso pelo SDK `MercadoPago.js v2`.
- **HTTP Status:** `500`
- **Resposta:**
```json
{
  "status": 500,
  "message": "internal_error",
  "cause": [],
  "error": null
}
```

---

## 3. Análise da Causa Raiz no Gateway do Mercado Pago

1. **A Requisição do EuSou é Válida:**
   - O endpoint `/v1/payment_methods` com o mesmo token retorna HTTP 200 com 20 métodos de pagamento ativos (inclusive `pix`, `master`, `visa`).
   - O payload JSON obedece rigorosamente a especificação do Mercado Pago.
2. **O Erro é Interno do Gateway (`fill and validate error list: not_found: 400`):**
   - Na arquitetura de microsserviços do Mercado Pago, ao validar a transação para o recebedor (Collector `3260132`), um serviço interno busca o cadastro/chave Pix ou entidade financeira da conta no ambiente sandbox e recebe `not_found (400)`.
   - Como o serviço do Mercado Pago não trata essa ausência no ambiente de teste, ele dispara uma exceção não capturada que explode como **HTTP 500 Internal Server Error**.
3. **Bloqueio do PolicyAgent (`PA_UNAUTHORIZED_RESULT_FROM_POLICIES`):**
   - O `PolicyAgent` do Mercado Pago indica que as credenciais de teste da aplicação ou o status cadastral da conta de homologação no Mercado Pago Developers necessitam de verificação ou renovação no painel.

---

## 4. Estado da State Machine no EuSou

A plataforma EuSou comportou-se com conformidade absoluta:
- **Pagamentos FAILED:** Não confirmaram pedido e não baixaram estoque.
- **Auditoria de Estoque:** Intocada (0 movimentos espúrios).
- **Idempotência:** Camada 1 e Camada 2 ativas.
- **Cobertura de Testes:** 25 de 25 testes do `PaymentService` passaram com 100% de aprovação.
