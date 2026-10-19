# Dossiê Técnico para Suporte Mercado Pago — Homologação EuSou (F16-B)

## 1. Identificação da Ocorrência

- **Aplicação / Merchant:** EuSou (Plataforma E-commerce)
- **Ambiente:** `TEST` (Sandbox / Homologação)
- **Data e Hora UTC:** `2026-10-11T08:57:48.823Z`
- **Data e Hora Local:** `2026-10-11 05:57:48`
- **Order ID Interno:** `ab2918f0-949a-4fa3-ac89-fb418b381da4`
- **Payment ID Interno:** `b332244f-01bc-45ac-ab3e-7254c2780d5f`
- **Endpoint Chamado:** `POST https://api.mercadopago.com/v1/payments`
- **HTTP Status Retornado:** `500`
- **Header x-request-id Retornado:** `d34e1028-f49e-4a31-8eb1-9fe2f265ab68`

### Response Body Retornado pelo Gateway
```json
{
  "status": 500,
  "message": "internal_error",
  "cause": [],
  "error": null
}
```

---

## 2. Estado Registrado do Mercado Pago

- **externalPaymentId:** `null` (nenhum ID transacional foi emitido pelo gateway)
- **externalStatus:** `"error"`
- **externalStatusDetail:** `"500"`
- **Webhook emitido:** **NÃO** (nenhuma notificação de webhook foi recebida)
- **Geração de CardToken:** O `CardToken` foi gerado com sucesso via SDK oficial `MercadoPago.js` no frontend imediatamente antes da chamada à API.
- **Execução da chamada:** A requisição `POST /v1/payments` foi efetivamente transmitida e recebida pelos servidores do Mercado Pago.
- **Resposta do Gateway:** Os servidores do Mercado Pago responderam com status `HTTP 500`.

---

## 3. Payload Sanitizado Enviado ao Mercado Pago

Abaixo está o payload exato enviado na requisição, com todas as informações confidenciais devidamente sanitizadas:

```json
{
  "transaction_amount": 39.90,
  "token": "[PRESENTE - CARRIER CARDTOKEN SANITIZADO]",
  "description": "Pedido ab2918f0-949a-4fa3-ac89-fb418b381da4",
  "installments": 1,
  "payment_method_id": "master",
  "payer": {
    "email": "test@testuser.com",
    "first_name": "APRO",
    "last_name": "Sobrenome/Default",
    "identification": {
      "type": "CPF",
      "number": "[REDACTED]"
    }
  }
}
```

> **Nota de Segurança:** Nenhuma credencial secreta (`Access Token`), chave pública completa, `CardToken`, número de cartão (PAN), data de expiração ou código de segurança (CVV) está presente neste documento.

---

## 4. Evidências Internas do EuSou & State Machine

A integridade do estado da plataforma EuSou foi rigorosamente confirmada:

- **OrderStatus Final:** `PENDING` (não foi transicionado para confirmado)
- **PaymentStatus Final:** `FAILED`
- **Estoque Físico Antes:** `6` unidades (`2` reservadas)
- **Estoque Físico Depois:** `6` unidades (`2` reservadas)
- **Movimentações de Estoque (`StockMovement`):** `0` (nenhuma saída de estoque foi executada)
- **Segundo Payment:** **NÃO** (exatamente 1 registro de pagamento associado à Order)
- **Segundo StockMovement:** **NÃO**
- **Webhook Recebido:** **NÃO**
- **Retry Automático:** **NÃO**

**Regra da State Machine Confirmada:**  
`Payment FAILED` → `Order` permaneceu estritamente `PENDING` e nenhum `StockMovement OUT` foi acionado.

---

## 5. Validação e Consistência do `x-request-id`

O identificador de rastreabilidade foi capturado e comparado a partir de duas fontes independentes:

1. **Banco de Dados (Tabela `Payment`, coluna `metadata`):**
   ```json
   {
     "xRequestId": "d34e1028-f49e-4a31-8eb1-9fe2f265ab68"
   }
   ```
2. **Log Estruturado do Backend (Task PID 10304):**
   ```text
   [Nest] 10304 - 11/10/2026, 05:57:48 LOG [MercadoPagoProvider] Mercado Pago POST /v1/payments responded with status 500 (x-request-id: d34e1028-f49e-4a31-8eb1-9fe2f265ab68)
   ```

**Conclusão:** Os dois valores são rigorosamente **idênticos**, assegurando a precisão do ID para correlação técnica direta pelo time de suporte do Mercado Pago.

---

## 6. Histórico da Investigação

- **Geração de Token:** O `CardToken` é gerado pelo SDK oficial `MercadoPago.js` no navegador.
- **Autenticação da Aplicação TEST:** Credenciais de teste validadas com sucesso; endpoint `GET /v1/payment_methods` respondeu `HTTP 200`.
- **Identificação da Bandeira:** O `payment_method_id` `"master"` foi identificado corretamente pelo fluxo do SDK a partir do BIN do cartão.
- **Dados do Pagador:** O payload contém os campos exigidos `first_name` e `last_name`, e o e-mail `test@testuser.com` foi utilizado conforme documentação oficial de testes do gateway.
- **Comportamento do Gateway:** O endpoint `POST /v1/payments` retornou `HTTP 500` com `message: "internal_error"` e `cause: []`.
- **Ausência de Rejeição de Negócio:** Não há código de recusa de cartão (ex: `cc_rejected_*`), antifraude ou inconsistência de saldo.
- **Ausência de IDs:** Nenhum `externalPaymentId` foi gerado e nenhum webhook foi disparado pelo gateway.
- **Sem Falha Interna:** Não houve falha de estoque ou violação da máquina de estados do EuSou.

---

## 7. Conclusão Técnica

**CAUSA RAIZ NÃO DETERMINADA — HTTP 500 internal_error retornado pelo Mercado Pago.**

**Classificação: C — ERRO INTERNO / INDETERMINADO DO MERCADO PAGO**

**Fundamentação Técnica:**
1. A aplicação cliente (EuSou) recebeu status `HTTP 500`.
2. O corpo da resposta não possui detalhamento de causa (`cause: []`).
3. Nenhum identificador transacional externo (`externalPaymentId`) foi emitido pelo gateway.
4. Não há evidência suficiente disponível do lado cliente para diagnosticar a causa específica da falha interna nos servidores do Mercado Pago.
5. O `x-request-id` registrado viabiliza a correlação e rastreio direto nos logs internos da infraestrutura do Mercado Pago.

---

## 8. Solicitação ao Mercado Pago

> **Solicitação Técnica para Abertura de Chamado:**
> 
> "Solicitamos a análise técnica da tentativa de pagamento identificada pelo x-request-id abaixo. A aplicação estava em ambiente TEST e recebeu HTTP 500 `internal_error` ao chamar POST /v1/payments. O response body retornou `cause: []` e nenhum externalPaymentId foi gerado.
> 
> Solicitamos verificar nos logs internos do Mercado Pago o motivo associado ao identificador:
> 
> **`d34e1028-f49e-4a31-8eb1-9fe2f265ab68`**
> 
> Solicitamos também confirmar se existe alguma inconsistência relacionada à aplicação, conta de teste, credenciais TEST, payment_method `master`, CardToken ou ambiente de testes."

---

## 9. Declaração de Segurança e Privacidade

Este dossiê técnico foi compilado em estrita observância das normas de segurança da informação e não contém:
- Access Token;
- CardToken;
- PAN (Primary Account Number);
- CVV;
- Data de validade;
- CPF completo;
- Chaves privadas ou segredos comerciais.

---

## 10. Status da Execução
- **Dossiê compilado em:** `2026-10-11`
- **Novas tentativas executadas durante a elaboração:** **NENHUMA**
- **Chamadas de API executadas durante a elaboração:** **NENHUMA**
- **Alterações de código, banco ou configurações:** **NENHUMA**
