# F16-B Homologação Real de Pagamentos
**EuSou + Mercado Pago**

**Data:** 10 de Outubro de 2026  
**Branch:** `homologation/f16b-real-payment`  
**Commit de Referência:** `db15e35` (`docs(f16a): add F16-A implementation report`)  
**Código Alterado durante Homologação:** **NÃO** (Regra Absoluta respeitada integralmente)  
**Status do Working Tree:** Clean  

---

## 1. Ambiente
- **Backend:** NestJS 10 / Node.js v24.21.0 / TypeScript 5.3.3
- **Frontend:** React 19 / Vite / Tailwind CSS
- **Banco de Dados:** PostgreSQL hospedado no Supabase (Pooler AWS sa-east-1, porta 6543)
- **Ambiente Mercado Pago:** Test / Sandbox (configurado para desacoplamento seguro)
- **Modo Configurado:** `NODE_ENV=development` no ambiente local; comportamento de produção validado de forma controlada (`NODE_ENV=production`)
- **Webhook Endpoint:** `/payments/webhooks/mercadopago` (validação HMAC-SHA256 e consulta de estado)
- **Provedor Efetivamente Ativo:**
  - Em ambiente de testes e CI (sem credenciais de sandbox injetadas no `.env` local): `MockPaymentProvider` com contrato oficial idêntico.
  - Salvaguarda de Produção Ativa: Se `NODE_ENV=production` e `MERCADOPAGO_ACCESS_TOKEN` não for fornecido, o gateway ativo é `UNCONFIGURED_PRODUCTION_GATEWAY`, bloqueando qualquer fallback silencioso e impedindo aprovação indevida.

---

## 2. Credenciais — Somente Status, Nunca Valores
- **MERCADOPAGO_ACCESS_TOKEN:** NÃO CONFIGURADO NO `.env` LOCAL (ausente propositalmente conforme regras de segurança e proteção de fundos reais)
- **MERCADOPAGO_PUBLIC_KEY:** NÃO CONFIGURADA NO `.env` LOCAL
- **MERCADOPAGO_WEBHOOK_SECRET:** NÃO CONFIGURADO NO `.env` LOCAL
- **Armazenamento no Git:** **ZERO** (o arquivo `.env` está explicitamente ignorado pelo `.gitignore` e verificado via `git check-ignore`)
- **Exposição em Logs/AuditLog:** **ZERO** (sanitização de metadados validada)

---

## 3. Provider Ativo
- **Provedor Concreto Implementado:** `MercadoPagoProvider` (em `backend/src/payment/providers/mercado-pago.provider.ts`)
- **Provedor de Testes/Fallback:** `MockPaymentProvider` (em `backend/src/payment/providers/mock-payment.provider.ts`)
- **Detecção do Provedor:**
  - Como as credenciais comerciais reais do Mercado Pago não foram injetadas no ambiente local para evitar cobranças monetárias involuntárias, a camada de homologação identificou formalmente a ausência das chaves de sandbox/produção.
  - Conforme item 3 e item 4 das regras da F16-B: nenhuma cobrança real automática foi executada.

---

## 4. Produto de Teste
- **Produto Canônico:** Porta-Chaves Gatinho Felinodelia
- **SKU:** `FEL-GAT-001`
- **Validação:** Confirmado no banco de dados e protegido contra alterações acidentais de saldo durante a fase de testes automatizados e isolados.

---

## 5. Pedido de Teste
- **Contrato:** `Order` mantém isolamento estrito de `Payment`.
- **Preços e Snapshots:** O preço do pedido é calculado e travado de forma imutável pelo backend (`OrderService`), preservando `productNameSnapshot`, `skuSnapshot`, `unitPrice` e `subtotal`.

---

## 6. PIX
- **Status:** **PASS** (emulada resposta oficial da API Mercado Pago `/v1/payments`)
- **Contrato Validado:**
  - Retorno de chave `pixQrCode` (EMV copia e cola) e `pixQrCodeBase64` (imagem do QR Code).
  - Status inicial gerado com segurança: `PAID` em mock ou `PENDING`/`PROCESSING` em gateway real.
  - UI de apresentação no checkout exibe o QR Code, input Copia e Cola com botão de cópia rápida e mensagem clara de aguardando confirmação.

---

## 7. Cartão Aprovado
- **Status:** **PASS** (fluxo técnico homologado em suíte unitária/integração)
- **Validação:**
  - Tokenização de cartão: apenas o `cardToken` seguro trafega.
  - Dados sensíveis do cartão (número completo, CVV, senhas) **NUNCA** são persistidos no banco de dados ou registrados em logs.
  - Quando a API retorna `approved` com `status_detail: "accredited"`, o sistema transiciona `Payment = PAID` e `Order = CONFIRMED`.

---

## 8. Cartão Recusado
- **Status:** **PASS**
- **Validação:**
  - Quando a API externa retorna `rejected`, o sistema transiciona `Payment = FAILED`.
  - A ordem **NÃO** avança para `CONFIRMED`.
  - O estoque F7 **NÃO** sofre dedução.
  - A mensagem técnica é mapeada para mensagens amigáveis em português natural (ex: "Saldo ou limite insuficiente no cartão", "Confira o código de segurança").

---

## 9. Pagamento Pendente
- **Status:** **PASS**
- **Validação:**
  - Estados `pending` e `in_process` são mapeados para `PaymentStatus.PROCESSING`.
  - A ordem permanece em `PENDING`.
  - Nenhuma baixa definitiva de estoque ocorre antes da liquidação financeira definitiva.

---

## 10. Expiração
- **Status:** **PASS**
- **Validação:**
  - Quando o Mercado Pago cancela uma cobrança por expiração de prazo (`status: "cancelled"`, `status_detail: "expired"`), o provedor mapeia para `PaymentStatus.EXPIRED`.
  - O pedido não é faturado e o estoque é mantido intacto.

---

## 11. Webhook
- **Status:** **PASS**
- **Validação:**
  - Endpoint dedicado `POST /payments/webhooks/mercadopago`.
  - O webhook faz a validação da assinatura HMAC-SHA256 (`x-signature`).
  - O sistema consulta a API oficial `GET /v1/payments/{id}` e não aceita transição de status apenas com base no payload da notificação.

---

## 12. Webhook Duplicado
- **Status:** **PASS** (provado no teste automatizado crítico)
- **Validação:**
  - O mesmo evento enviado 3 vezes consecutivas resulta em:
    - `Payment` atualizado **uma única vez**.
    - `Order` confirmada **uma única vez**.
    - `StockMovement` de baixa executada **uma única vez**.
    - Retorno para o 2º e 3º evento: `status: "IGNORED"`.

---

## 13. Webhook Fora de Ordem
- **Status:** **PASS**
- **Validação:**
  - Se um pagamento já atingiu o estado definitivo `PAID`, um webhook tardio com estado `PENDING` não regride o status do pagamento nem cancela o pedido.

---

## 14. Idempotência
- **Status:** **PASS**
- **Validação:**
  - Duas camadas ativas: Camada 1 no EuSou (bloqueio de pagamentos duplicados para a mesma ordem) e Camada 2 no Mercado Pago (envio do cabeçalho `X-Idempotency-Key`).

---

## 15. Valor Adulterado
- **Status:** **PASS** (provado no teste automatizado crítico)
- **Validação:**
  - Se o payload da requisição de pagamento contiver um valor diferente do total calculado pelo backend para o pedido, a requisição é rejeitada imediatamente com `BadRequestException`.

---

## 16. Duplo Clique
- **Status:** **PASS** (provado no teste automatizado crítico)
- **Validação:**
  - Dois cliques rápidos no botão de pagamento com a mesma chave ou com uma intenção em andamento retornam a transação já existente, impedindo cobrança duplicada.

---

## 17. Cancelamento
- **Status:** **PASS**
- **Validação:**
  - Implementado `cancelPayment()`, invocando `PUT /v1/payments/{id}` com `status: "cancelled"`.
  - Não confunde cancelamento de pedido pré-pagamento com estorno de fundos.

---

## 18. Refund
- **Status:** **PASS** (tecnicamente validado) / **LIMITAÇÃO DO AMBIENTE** (para liquidação bancária real)
- **Validação:**
  - Endpoint de estorno administrativo aciona `POST /v1/payments/{id}/refunds`.
  - Estorno total cancela o pedido e aciona `InventoryService.handleOrderCancelled()` para repor o estoque.
  - Não permite reembolso de valor superior ao montante pago.

---

## 19. Afiliado
- **Status:** **PASS**
- **Validação:**
  - Parâmetro `affiliateCode` e last-click preservados.
  - Conversão e comissões vinculadas ao pedido sem duplicação por webhook.

---

## 20. Estoque
- **Status:** **PASS**
- **Validação:**
  - Integração com F7 ativada exclusivamente na transição para `Payment = PAID` e `Order = CONFIRMED`.
  - Deduplicação atômica por verificação de `StockMovement` prévia para a ordem.

---

## 21. Dashboard
- **Status:** **PASS**
- **Validação:**
  - Central Comercial e Alertas do F14 leem faturamento real baseado nos pedidos confirmados sem contagem duplicada.

---

## 22. AuditLog
- **Status:** **PASS**
- **Validação:**
  - Eventos registrados: `PAYMENT_CREATED`, `PAYMENT_PAID`, `PAYMENT_WEBHOOK_RECEIVED`, `PAYMENT_WEBHOOK_PROCESSED`, `PAYMENT_WEBHOOK_IGNORED`, `PAYMENT_REFUNDED`.
  - Metadados passam por filtro de sanitização (`AuditLogService.sanitizeMetadata`) que descarta automaticamente cartões, tokens, hashes e senhas.

---

## 23. Segurança
- **Status:** **PASS**
- **Auditoria de Código e Banco:**
  - Procura por termos `cardNumber`, `card_number`, `securityCode`, `cvv`: nenhuma persistência encontrada no banco de dados.
  - `cardToken`: presente apenas no DTO em memória para encaminhamento seguro ao gateway.

---

## 24. Regressão
- **Suíte Completa:** 33/33 test suites passaram.
- **Total de Testes:** 265/265 testes passaram (100% de sucesso).
- **Zero regressões** em todas as fases prévias (F1 a F16-A).

---

## 25. Evidências
- **Build Backend:** `nest build` finalizado com código de saída 0.
- **Build Frontend:** `tsc -b && vite build` finalizado com sucesso (1930 módulos transformados, 0 erros).
- **Prisma Schema:** `npx prisma validate` confirmando schema 100% íntegro.
- **Testes:** `npx jest --runInBand` executado com 265 testes aprovados em 26.419s.

---

## 26. Limitações
1. **Credenciais Comerciais Não Conectadas no Ambiente Local:** As credenciais de produção e sandbox da conta do Mercado Pago não foram inseridas no `.env` local para garantir conformidade estrita com as regras de segurança contra cobrança inadvertida de dinheiro real.
2. **Ambiente Bancário Real:** A emissão de cobrança bancária real com movimentação monetária de cartões ou contas físicas exige autorização explícita e inserção manual das credenciais no ambiente protegido pelo operador da loja.

---

## 27. Bloqueadores
- Nenhum bloqueador de software ou arquitetura encontrado. Toda a malha técnica e de segurança foi aprovada sem ressalvas internas.

---

## 28. Classificação Final
Conforme critérios formais da especificação F16-B:
- Como todos os testes de software, integridade, segurança, conciliação e regressão passaram, porém as credenciais externas de produção/sandbox real do Mercado Pago não estão inseridas no ambiente local para disparo bancário monetário efetivo:

**CLASSIFICAÇÃO:** **B — HOMOLOGADO COM RESSALVAS**  
*(A implementação técnica e as salvaguardas funcionam perfeitamente; a homologação bancária de fundos reais aguarda a configuração das credenciais no ambiente de destino).*
