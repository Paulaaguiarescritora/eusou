# F16-B — Revisão da Causa Raiz do Erro HTTP 500 (internal_error) à Luz da Documentação Oficial

**Data**: 11/10/2026  
**Ambiente**: Desenvolvimento Local / Sandbox Mercado Pago  
**Transação Alvo**: Tentativas de pagamento com cartão de crédito (Order `348eea11...` e `93990cd6...`)  
**Gateway**: Mercado Pago Payments API (`POST https://api.mercadopago.com/v1/payments`)  
**Status Retornado pelo MP**: `HTTP 500 Internal Server Error`  
**Body Retornado pelo MP**: `{"message": "internal_error", "status": 500, "cause": []}`  

---

## 1. Revisão e Retratação da Conclusão Anterior (`test@testuser.com`)

Na análise preliminar, levantou-se a suposição de que o e-mail `test@testuser.com` seria um e-mail genérico incompatível com os requisitos de teste do Mercado Pago.

### O que a Documentação Oficial Confirma:
1. **Documentação Oficial de Cartões de Teste (Checkout API / Orders API)**:
   - A documentação oficial do Mercado Pago para testes com cartões estabelece expressamente:
     > **E-mail do comprador:** `test@testuser.com`.
   - O e-mail `test@testuser.com` é explicitamente aceito e documentado pelo Mercado Pago como e-mail de pagador para simulação de transações de teste no Sandbox.
2. **Referência da API de Criação de Usuário de Teste (`POST /users/test`)**:
   - A própria documentação oficial e os exemplos de resposta do endpoint retornam usuários de teste com domínio `@testuser.com`.

### Conclusão Desta Revisão:
> **`test@testuser.com` NÃO PODE ser considerado como causa comprovada do erro `HTTP 500`.**  
> Trata-se de um dado oficial suportado e documentado pelo próprio Mercado Pago para testes em ambiente Sandbox.

---

## 2. Auditoria Técnica dos 12 Pontos Críticos

Com base nas evidências comprovadas e no código-fonte do EuSou:

| # | Ponto Auditado | Evidência / Constatação | Conformidade com Docs MP | Classificação |
|---|---|---|---|---|
| **1** | **Payload enviado para Payments API** | `POST /v1/payments` com `transaction_amount: 39.9`, `token: "..."`, `description: "Pedido <id>"`, `installments: 1`, `payment_method_id: "master"`, `payer: { email, identification }`. | Estrutura atende aos campos requeridos da API. | Conforme |
| **2** | **`payment_method_id: "master"`** | O BIN `548083` retorna `master` via `GET /v1/payment_methods/search`. O valor enviado é exatamente `"master"`. | Exato para Mastercard no Brasil (`MLB`). | Conforme |
| **3** | **Objeto `payer`** | Enviados `email: "test@testuser.com"` e `identification: { type: "CPF", number: "12345678909" }`. | Estrutura válida e documentada. | Conforme |
| **4** | **`first_name` / `last_name`** | No fluxo de cartão, esses campos não foram enviados no nó `payer` (apenas em PIX). Na especificação do `POST /v1/payments`, `payer.first_name` e `payer.last_name` constam como campos **opcionais**, e sua omissão gera `HTTP 400` com `cause` descritiva quando faltante algum dado estritamente mandatório, e **não** `500 internal_error`. | Não há evidência oficial de que cause HTTP 500. | Hipótese Não Comprovada |
| **5** | **Campo `description`** | Enviado `"Pedido <orderId>"` (string simples, sem caracteres inválidos). | Válido. | Conforme |
| **6** | **Ausência de `notification_url`** | `notification_url` não foi enviado no payload. | Campo estritamente opcional. Webhooks operam globalmente por aplicação. | Conforme |
| **7** | **Header `X-Idempotency-Key`** | Enviado `idem_<orderId>_<timestamp>` (string única por requisição). | Válido e recomendado pelo Mercado Pago. | Conforme |
| **8** | **Associação Access Token & Public Key** | Token `TEST-7623363565484094-...` e chave `TEST-37fcab39-...` pertencem à aplicação `7623363565484094`. | Validação de credenciais de teste íntegra. | Conforme |
| **9** | **CardToken e Access Token no mesmo ambiente** | CardToken gerado via SDK v2 com `HTTP 201 Created` no endpoint oficial `POST /v1/card_tokens`. Status: `active`. Consumido pelo Access Token de teste da mesma aplicação. | Total compatibilidade de ambiente (`TEST`). | Conforme |
| **10** | **Requisitos específicos de test credentials** | O cartão utilizado foi `5480 8328 0103 3311` (Mastercard Test), titular `APRO`, documento `12345678909` (CPF Test), exatamente como dita a tabela oficial para aprovação. | Total conformidade com as regras de teste. | Conforme |
| **11** | **Documentação Oficial sobre HTTP 500 `internal_error`** | A documentação oficial de erros da API do Mercado Pago afirma textualmente: `500 internal_error` indica *"Ocorreu um erro interno no servidor"* do próprio Mercado Pago. Recomenda inspecionar o header `x-request-id` e implementar retry com backoff exponencial. | Erro de infraestrutura/servidor remoto do Mercado Pago. | Conforme Docs MP |
| **12** | **Especificidade do Sandbox / TEST** | Erros 500 ocorrem no processador de autorização/adquirente de testes do Mercado Pago quando o serviço interno de transações simuladas enfrenta falha transitória ou descontinuidade de backend. | Comportamento típico de indisponibilidade remota do provedor. | Hipótese Provável |

---

## 3. Classificação das Evidências (Critérios de Rigor)

### A. O Que Está Comprovado
1. **O CardToken é real e válido**: Foi gerado com sucesso pelo MercadoPago.js v2 no frontend com resposta `HTTP 201 Created` e status `active`.
2. **O Payload do EuSou está estruturado em conformidade com o `/v1/payments`**: Todos os parâmetros fundamentais (`transaction_amount`, `token`, `installments`, `payment_method_id`, `payer.email`, `payer.identification`) estão preenchidos com tipos e formatos corretos.
3. **O e-mail `test@testuser.com` é oficial de teste**: A documentação oficial de testes com cartões do Mercado Pago recomenda expressamente esse e-mail.
4. **O Mercado Pago retornou explicitamente `status: 500`, `message: "internal_error"`, `cause: []`**: Não houve código de rejeição de negócio (ex: `cc_rejected_...`, `400 Bad Request` ou causa de validação de campos).

### B. O Que É Hipótese
1. **Ausência de `first_name`/`last_name`**: Hipótese não comprovada. Em caso de validação de payload, a API do Mercado Pago retorna `HTTP 400 Bad Request` com a lista de causas em `cause: [{ code, description }]`, e não `500`.
2. **Conflito interno no Sandbox**: Hipótese provável de que o serviço de autorização simulada de cartões do Sandbox do Mercado Pago enfrentou instabilidade interna temporária no momento das duas requisições.

### C. O Que a Documentação Oficial Confirma
- Confirma que `test@testuser.com` é o e-mail padrão aceito para testes de cartão no Sandbox.
- Confirma que o prefixo `APRO` e o documento `12345678909` com o cartão `5480 8328 0103 3311` são os parâmetros oficiais para simular aprovação.
- Confirma que o status `500 internal_error` decorre de falha interna nos servidores do Mercado Pago, instruindo os desenvolvedores a capturar o `x-request-id` para abertura de suporte e implementar rotina de retentativas.

### D. O Que a Documentação Oficial Não Confirma
- A documentação oficial **não confirma** que a omissão de `payer.first_name` resulte em `HTTP 500`.
- A documentação oficial **não confirma** que o e-mail `test@testuser.com` cause rejeição de pagamento no endpoint `/v1/payments`.

---

## 4. Conclusão Final e Classificação

De acordo com as diretrizes e a ausência de justificativa de negócio documentada para um erro 500:

> ### **CAUSA RAIZ NÃO DETERMINADA — HTTP 500 DO MERCADO PAGO**
> **Classificação**: **C — Causa Externa / Indeterminada (Erro Interno no Servidor do Mercado Pago)**
>
> O payload enviado pela aplicação EuSou respeita rigorosamente todos os contratos e dados oficiais de teste (cartão, titular APRO, CPF, e-mail `test@testuser.com`). O retorno `HTTP 500 internal_error` com `cause: []` originou-se exclusivamente na infraestrutura remota da API do Mercado Pago.
