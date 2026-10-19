# F16-B — Diagnóstico Read-Only da Última Tentativa de Pagamento

## 1. Declaração de Conformidade & Integridade
- **Nenhum novo pagamento executado durante o diagnóstico.**
- **Nenhum retry executado.**
- **Nenhuma alteração de banco de dados.**
- **Nenhuma alteração de credenciais.**
- **Nenhuma alteração de código ou configuração.**
- **Nenhum commit ou push realizado.**
- Auditoria 100% realizada em modo de leitura a partir do banco de dados e dos logs estruturados do backend.

---

## 2. Identificação da Última Tentativa

| Item | Campo | Valor Auditado |
| :--- | :--- | :--- |
| **1** | **Order ID** | `ab2918f0-949a-4fa3-ac89-fb418b381da4` |
| **2** | **Payment ID** | `b332244f-01bc-45ac-ab3e-7254c2780d5f` |
| **3** | **Data / Hora da Tentativa** | `2026-10-11T08:57:48.823Z` (horário local: `05:57:48`) |
| **4** | **OrderStatus Final** | `PENDING` |
| **5** | **PaymentStatus Final** | `FAILED` |
| **6** | **HTTP Status Retornado** | `500` |
| **7** | **Response Body Sanitizado** | `{"status": 500, "message": "internal_error", "cause": [], "error": null}` |
| **8** | **x-request-id REAL** | `d34e1028-f49e-4a31-8eb1-9fe2f265ab68` |
| **9** | **externalPaymentId** | `null` (não gerado pelo gateway devido ao erro 500) |
| **10** | **externalStatus** | `"error"` |
| **11** | **externalStatusDetail** | `"500"` |
| **12** | **Houve Webhook?** | **NÃO** (nenhum webhook recebido para essa transação) |
| **13** | **Webhook Processado?** | **NÃO** |
| **14** | **Houve StockMovement?** | **NÃO** (0 movimentações geradas para esta Order) |
| **15** | **Quantidade de Estoque Antes** | `6` unidades físicas (`2` reservadas) |
| **16** | **Quantidade de Estoque Depois** | `6` unidades físicas (`2` reservadas) |
| **17** | **Qtd StockMovement para essa Order** | `0` (zero) |
| **18** | **Houve Segundo Payment nessa Order?** | **NÃO** (exatamente 1 registro de Payment) |
| **19** | **Houve Segunda Saída de Estoque?** | **NÃO** |

---

## 3. Comparação do `x-request-id`

- **Valor em `Payment.metadata.xRequestId` no banco:**  
  `d34e1028-f49e-4a31-8eb1-9fe2f265ab68`
- **Valor nos Logs Estruturados do Backend (Task PID 10304):**  
  `[Nest] 10304 - 11/10/2026, 05:57:48 LOG [MercadoPagoProvider] Mercado Pago POST /v1/payments responded with status 500 (x-request-id: d34e1028-f49e-4a31-8eb1-9fe2f265ab68)`
- **Conclusão:** Ambos os valores coincidem com **100% de exatidão**. O `x-request-id` foi perfeitamente persistido no banco e registrado nos logs do servidor.

---

## 4. Payload Sanitizado Enviado ao Mercado Pago

- **transaction_amount:** `39.9`
- **token:** Presente (`[TOKEN SANITIZADO - REAL CARRIER CARDTOKEN]`)
- **payment_method_id:** `"master"` (ou detecção via BIN do cartão)
- **installments:** `1`
- **description:** `"Pedido ab2918f0-949a-4fa3-ac89-fb418b381da4"`
- **payer.email:** `"test@testuser.com"`
- **payer.first_name:** `"APRO"`
- **payer.last_name:** `"Sobrenome/Default"`
- **payer.identification.type:** `"CPF"`
- **payer.identification.number:** `***.***.***-**` (CPF sanitizado)

---

## 5. Validação da State Machine e Integridade de Negócio

- ✅ **Payment FAILED não gerou Order CONFIRMED:** A Order `ab2918f0-949a-4fa3-ac89-fb418b381da4` permaneceu estritamente em estado `PENDING`.
- ✅ **Payment FAILED não gerou StockMovement OUT:** Nenhuma baixa de estoque ocorreu (`StockMovement` para esta Order = 0).
- ✅ **Nenhum segundo Payment gerado:** Apenas um registro de Payment existe para a ordem.
- ✅ **Nenhuma saída de estoque indevida:** O saldo do produto `FEL-GAT-001` permaneceu intacto em 6 unidades.
- ✅ **A mensagem de erro no frontend:** Foi uma consequência direta do status `FAILED` retornado pelo backend após a tentativa das 05:57:48 ter recebido `HTTP 500 internal_error` dos servidores do Mercado Pago.

---

## 6. Classificação

Critério:
- Resposta HTTP: `500`
- Response Body: `{"status": 500, "message": "internal_error", "cause": [], "error": null}`
- Causa objetiva: Nenhuma rejeição de regra de negócio, limite ou cartão reportada; falha no lado do gateway.

**Classificação: C — ERRO INTERNO / INDETERMINADO DO MERCADO PAGO**
