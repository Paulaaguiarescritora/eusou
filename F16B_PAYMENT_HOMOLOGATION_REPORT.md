# F16-B — Relatório de Homologação de Pagamentos (Mercado Pago TEST)

**Classificação Oficial:** **STATUS B — HOMOLOGADO COM RESSALVA EXTERNA**  
**Data da Homologação:** 13/10/2026 às 11:09 (Horário de Brasília)  
**Ambiente:** `TEST` (Sandbox Mercado Pago) / PostgreSQL Supabase  
**Gateway Homologado:** Mercado Pago API (`https://api.mercadopago.com`)  

---

## 1. Resumo Executivo e Enquadramento

A fase **F16-B** teve como objetivo validar o processamento real de pagamentos via **Mercado Pago** em ambiente de homologação (`TEST`) para os fluxos de PIX e Cartão de Crédito com tokenização no frontend.

### Critério de Enquadramento:
- **STATUS A:** Apenas mediante transação aprovada (`PAID`) com emissão de `externalPaymentId`, webhook processado e confirmação end-to-end no gateway.
- **STATUS B (Atual):** A camada da aplicação, o provedor `MercadoPagoProvider`, a máquina de estados `Payment` -> `Order` -> `StockMovement`, os testes de idempotência, a tokenização `MercadoPago.js v2` e os builds/lints estão 100% íntegros e aprovados. A ressalva é exclusivamente externa ao EuSou: o gateway do Mercado Pago em Sandbox responde com erro interno `HTTP 500` (`fill and validate error list: not_found\n: 400`).

---

## 2. Auditoria da Implementação EuSou

| Requisito | Status | Evidência |
| :--- | :---: | :--- |
| **MercadoPagoProvider Ativo** | PASS | Integrado ao NestJS com logging seguro e captura de `x-request-id`. |
| **MERCADOPAGO_ENVIRONMENT=TEST** | PASS | Definido em `backend/.env`. |
| **Access Token Local** | PASS | Configurado e autenticado no endpoint `/users/me` (Collector `3260132`). |
| **Public Key no Frontend** | PASS | Definida em `frontend/.env` e carregada pelo `MercadoPago.js v2`. |
| **Criação de CardToken** | PASS | Tokenização client-side validada sem tráfego de dados sensíveis de cartão. |
| **Máquina de Estados de Pagamento** | PASS | Pedido inicia em `PENDING`; pagamento `FAILED` não confirma pedido e não baixa estoque. |
| **Estoque Condicionado a PAID** | PASS | Testado unitariamente e via e2e (0 baixas indevidas em falhas de pagamento). |
| **Idempotência e Webhook** | PASS | Camada de idempotência com deduplicação de webhooks validada (25 testes passando). |

---

## 3. Evidências dos Testes Controlados no Gateway

### 3.1. Chamada Transacional PIX
- **x-request-id:** `3dd916cc-cfe5-48fe-a47b-4367aeb653b3`
- **HTTP Status:** `500`
- **Body do Gateway:**
  ```json
  {
    "message": "fill and validate error list: not_found\n: 400",
    "error": "internal_server_error",
    "status": 500,
    "cause": []
  }
  ```
- **Comportamento EuSou:** Payment marcado como `FAILED`; Order mantido como `PENDING`; estoque inalterado.

### 3.2. Chamada Transacional Cartão de Crédito
- **x-request-id:** `d34e1028-f49e-4a31-8eb1-9fe2f265ab68`
- **HTTP Status:** `500`
- **Body do Gateway:**
  ```json
  {
    "status": 500,
    "message": "internal_error",
    "cause": [],
    "error": null
  }
  ```
- **Comportamento EuSou:** Payment marcado como `FAILED`; Order mantido como `PENDING`; estoque inalterado.

---

## 4. Auditoria de Regressão, Build e Prisma

- **Backend NestJS Build:** **PASS** (`nest build` concluído com código 0).
- **Frontend Vite Build:** **PASS** (`vite build` concluído em 1.57s com código 0).
- **Frontend Lint:** **PASS** (0 erros de linting).
- **Prisma Schema Validation:** **PASS** (`The schema at prisma\schema.prisma is valid 🚀`).
- **Suíte de Testes do PaymentService:** **25 de 25 testes aprovados** (100% de sucesso).
- **Suíte de Testes do OrderService:** **6 de 6 testes aprovados** (100% de sucesso).
- **Suíte de Testes do InventoryService:** **8 de 8 testes aprovados** (100% de sucesso).

---

## 5. Conclusão e Próximos Passos

O bloqueio que impede a promoção para **STATUS A** é estritamente a instabilidade de infraestrutura interna do **Mercado Pago Sandbox** para esta conta/aplicação específica (`fill and validate error list: not_found`).

O dossiê técnico de suporte ([F16B_MERCADO_PAGO_SUPPORT_DOSSIER.md](file:///d:/eusou/F16B_MERCADO_PAGO_SUPPORT_DOSSIER.md)) e o diagnóstico técnico final ([F16B_MERCADOPAGO_FINAL_DIAGNOSTIC.md](file:///d:/eusou/F16B_MERCADOPAGO_FINAL_DIAGNOSTIC.md)) contêm todos os `x-request-id` autênticos necessários para acompanhamento junto ao suporte de desenvolvedores do Mercado Pago.
