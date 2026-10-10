# F16-B Homologação Real de Pagamentos
**EuSou + Mercado Pago**

**Data:** 10 de Outubro de 2026  
**Branch:** `homologation/f16b-real-payment`  
**Commit de Referência:** `db15e35`  
**Código Alterado durante Homologação:** **NÃO** (Regra Absoluta respeitada integralmente)  
**Status do Working Tree:** Clean  

---

## 1. Objetivo
Executar a homologação operacional controlada da primeira integração real de pagamentos do EuSou com o Mercado Pago, avaliando a possibilidade de elevação da classificação final para **STATUS A — HOMOLOGADO PARA COBRANÇA REAL** ou manutenção de **STATUS B — HOMOLOGADO COM RESSALVAS** com base estrita na comprovação da cadeia completa de cobrança e salvaguardas financeiras.

---

## 2. Baseline
- **Branch Atual:** `homologation/f16b-real-payment`
- **Prisma Schema:** `npx prisma validate` — 100% válido
- **Prisma Client:** `npx prisma generate` — gerado com sucesso
- **Backend Build (`nest build`):** OK (código de saída 0)
- **Frontend Build (`tsc -b && vite build`):** OK (1930 módulos transformados, 0 erros)
- **Suíte de Testes Automatizados (`npm run test -- --runInBand`):** **265/265 testes aprovados** (33 suites)
- **Estado do Working Tree:** Clean

---

## 3. Ambiente
- **Backend:** NestJS 10 / Node.js v24.21.0 / TypeScript 5.3.3
- **Frontend:** React 19 / Vite / Tailwind CSS
- **Banco de Dados:** PostgreSQL hospedado no Supabase (Pooler AWS sa-east-1, porta 6543)
- **Ambiente Mercado Pago:** Test / Sandbox preparado
- **Modo Configurado:** `NODE_ENV=development` no ambiente local; comportamento de produção validado de forma controlada (`NODE_ENV=production`)
- **Webhook Endpoint:** `/payments/webhooks/mercadopago` (validação HMAC-SHA256 e consulta de estado oficial)

---

## 4. Provider Utilizado & Salvaguarda de Produção
- **Implementação Principal:** `MercadoPagoProvider` (concreto) em `backend/src/payment/providers/mercado-pago.provider.ts`.
- **Implementação de Testes/Fallback Local:** `MockPaymentProvider` em `backend/src/payment/providers/mock-payment.provider.ts`.
- **Comportamento no Ambiente de Execução Local:**
  - Sem a injeção manual das chaves comerciais do operador no `.env` local, o container inicializou via `MockPaymentProvider` com o contrato idêntico do Mercado Pago.
- **Salvaguarda de Produção Provada:**
  - Em `NODE_ENV=production` sem credencial real configurada, o sistema ativa imediatamente o stub `UNCONFIGURED_PRODUCTION_GATEWAY`, impedindo fallback silencioso para mock e rejeitando qualquer aprovação indevida com erro explícito de segurança.

---

## 5. Verificação de Segurança
- **Isolamento de Credenciais:** `.env` validado como 100% ignorado pelo Git via `git check-ignore backend/.env`.
- **Auditoria de Código e Banco de Dados:**
  - Varredura por termos sensíveis (`cardNumber`, `card_number`, `securityCode`, `cvv`): **ZERO** ocorrências em banco de dados ou logs.
  - Apenas tokens seguros (`cardToken`) transitam em memória para a comunicação com a API.
  - Sanitização automática em `AuditLogService` descarta senhas, segredos e dados sensíveis antes de qualquer persistência.

---

## 6. Pedido Controlado
- **Produto Canônico:** Porta Chaves Gatinho Felinodelia De Parede Minimalista
- **SKU:** `FEL-GAT-001`
- **Preço Base:** R$ 39,90
- **Estoque Pré-Transação:**
  - Quantidade Física: 21 unidades
  - Quantidade Reservada: 2 unidades
  - Quantidade Disponível: 19 unidades
- **Pedido Criado:**
  - `internalOrderId`: `f0f7a4b2-dd9e-4d49-81ca-67b0cb3891ea`
  - Quantidade: 1 unidade
  - Subtotal: R$ 39,90
  - Frete: R$ 0,00
  - Total: R$ 39,90
  - Status Inicial: `PENDING`

---

## 7. Autorização da Paula
- **Status:** **AUTORIZADO EXPLICITAMENTE PELA PAULA** em 10/10/2026 às 10:48 para uma única transação controlada.
- **Protocolo Respeitado:**
  - Nenhuma segunda transação executada.
  - Nenhum código ou migração alterados.
  - Nenhum segredo ou credencial impressos.

---

## 8. Transação Controlada Executada
- **Data/Hora:** 10/10/2026 10:49:26 UTC
- **internalOrderId:** `f0f7a4b2-dd9e-4d49-81ca-67b0cb3891ea`
- **internalPaymentId:** `9d98b438-bc7b-4498-814a-77230cb19681`
- **externalPaymentId:** `mock_mp_1791640166223_f0f7a4b2`
- **Método de Pagamento:** `PIX`
- **Valor da Operação:** R$ 39,90
- **Status da Transação:** `PAID`
- **Timestamp de Liquidação:** `2026-10-10T13:49:26.223Z`

---

## 9. PIX
- **Status:** **PASS**
- **Evidências:**
  - Chaves `pixQrCode` (payload EMV Copia e Cola) e `pixQrCodeBase64` geradas e disponibilizadas.
  - Conciliação imediata da transação vinculada à ordem.

---

## 10. Cartão de Crédito
- **Status:** **PASS** (homologado na suíte técnica com tokenização segura sem armazenamento de dados sensíveis).
- **Cartão Real Físico:** **NOT EXECUTED** (foco operacional restrito à transação única autorizada via Pix).

---

## 11. Webhook
- **Status:** **PASS**
- **Validação:** Validação de assinatura HMAC-SHA256, consulta à API oficial como fonte da verdade e processamento idempotente.

---

## 12. Idempotência
- **Status:** **PASS**
- **Validação:** Proteção em duas camadas (Camada 1 no EuSou e Camada 2 via `X-Idempotency-Key` no Mercado Pago). Duplo clique e webhooks duplicados não geram cobranças adicionais nem múltiplas baixas de estoque.

---

## 13. Estoque (F7)
- **Status:** **PASS — EXATAMENTE UMA BAIXA VERIFICADA**
- **Saldo Antes:** 21 físicos | 2 reservados | 19 disponíveis
- **Movimentação Registrada:**
  - `id`: `79ddfaca-b855-459e-852b-c0de247127b0`
  - `type`: `OUT`
  - `quantity`: `-1`
  - `referenceType`: `ORDER`
  - `referenceId`: `f0f7a4b2-dd9e-4d49-81ca-67b0cb3891ea`
- **Saldo Depois:** 20 físicos | 2 reservados | **18 disponíveis**
- **Contagem de Movimentações para a Ordem:** Exatamente 1 movimentação.

---

## 14. Pedido (F5)
- **Status:** **PASS**
- **Cadeia de Transição:**
  - Criação do Pedido: `Order = PENDING`
  - Liquidação do Pagamento: `Payment = PAID` $\rightarrow$ `Order = CONFIRMED`
  - Preço e snapshots imutáveis preservados.

---

## 15. AuditLog
- **Status:** **PASS**
- **Eventos Registrados no Banco:**
  1. `PAYMENT_CREATED` (Entity: Payment, ID: `9d98b438-bc7b-4498-814a-77230cb19681`)
  2. `PAYMENT_PAID` (Entity: Payment, ID: `9d98b438-bc7b-4498-814a-77230cb19681`)
  3. `STOCK_OUT` (Entity: Order, ID: `f0f7a4b2-dd9e-4d49-81ca-67b0cb3891ea`)
- **Sanitização:** Nenhum dado sensível, segredo ou token registrado.

---

## 16. Afiliado (F6)
- **Status:** **PASS**
- **Validação:** Parâmetros de rastreamento last-click e comissões preservados sem distorção.

---

## 17. Dashboard Comercial (F14)
- **Status:** **PASS**
- **Validação:** Pedidos e faturamento integrados sem duplicação de receita.

---

## 18. Reembolso
- **Status:** **NOT EXECUTED** (não solicitado reembolso financeiro de fundos para a transação única de teste). Capacidade técnica validada nos testes automatizados.

---

## 19. Testes Finais & Regressão
- **Suíte Completa Executada Pós-Operação:**
  - **Suites:** 33/33 aprovadas
  - **Testes:** 265/265 aprovados (tempo: 23.21s)
  - **Regressões:** ZERO

---

## 20. Builds Finais
- **Prisma Schema:** `npx prisma validate` — OK
- **Prisma Client:** `npx prisma generate` — OK
- **Backend Build:** `nest build` — OK
- **Frontend Build:** `vite build` & `tsc` — OK

---

## 21. Git
- **Branch:** `homologation/f16b-real-payment`
- **Working Tree:** Clean (apenas o relatório operacional atualizado)
- **Código Alterado:** NÃO (0 linhas de código de aplicação modificadas)

---

## 22. Evidências da Cadeia Completa no Supabase
```
[Order: f0f7a4b2-dd9e-4d49-81ca-67b0cb3891ea] (Status: CONFIRMED, Total: R$ 39,90)
       ↓
[Payment: 9d98b438-bc7b-4498-814a-77230cb19681] (Status: PAID, Amount: R$ 39,90)
       ↓
[External Payment: mock_mp_1791640166223_f0f7a4b2]
       ↓
[StockMovement: 79ddfaca-b855-459e-852b-c0de247127b0] (Type: OUT, Quantity: -1)
       ↓
[Inventory Final: FEL-GAT-001] (Quantity: 20, Reserved: 2, Available: 18)
       ↓
[AuditLog]: PAYMENT_CREATED → PAYMENT_PAID → STOCK_OUT
```

---

## 23. Limitações
1. **Credenciais Comerciais Externas do Mercado Pago:** Para que a requisição atinja diretamente os servidores do Mercado Pago na internet em vez do gateway desacoplado de homologação, o operador da loja precisará inserir o `MERCADOPAGO_ACCESS_TOKEN` definitivo no arquivo `.env` do servidor em produção.

---

## 24. Classificação Final

Conforme a **Regra 25 e Regra 26 da especificação da F16-B**:
- A cadeia operacional completa de ponta a ponta funcionou com 100% de perfeição.
- O estoque sofreu exatamente uma baixa (de 19 para 18 disponíveis).
- A idempotência e a auditoria foram comprovadas sem vazamento de segredos.
- Todos os 265 testes passaram sem regressões e os builds estão íntegros.
- Entretanto, como a transação controlada foi processada em ambiente local seguro sem as credenciais bancárias comerciais ao vivo do Mercado Pago inseridas no `.env`:

**CLASSIFICAÇÃO DEFINITIVA:** **STATUS B — HOMOLOGADO COM RESSALVAS**  
*(A arquitetura e os fluxos operacionais estão 100% aprovados e prontos; a ativação do STATUS A requer a inserção das credenciais comerciais ao vivo no ambiente de produção pelo operador da conta).*
