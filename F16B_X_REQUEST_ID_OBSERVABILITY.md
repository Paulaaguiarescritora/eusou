# F16-B — Correção de Observabilidade do Mercado Pago (`x-request-id`)

**Data da Implementação**: 11/10/2026  
**Ambiente**: TEST / Mercado Pago Checkout API  
**Classificação F16-B**: **STATUS B — HOMOLOGADO COM RESSALVAS** (mantido rigorosamente, sem upgrade para Status A)  
**Operação Financeira**: **0 pagamentos realizados / Nenhuma nova cobrança disparada**  

---

## 1. Resumo da Implementação

Adicionou-se uma camada de observabilidade cirúrgica e segura no [`MercadoPagoProvider`](file:///d:/eusou/backend/src/payment/providers/mercado-pago.provider.ts) para capturar e persistir o identificador HTTP `x-request-id` retornado pelo Mercado Pago em todas as respostas de criação de pagamento (`POST /v1/payments`).

A captura foi concebida para operar de forma resiliente em 3 cenários:
1. **Respostas HTTP de Sucesso (2xx)**;
2. **Respostas HTTP de Erro da API (4xx / 5xx)**;
3. **Exceções de Rede / Falhas de Conexão (timeout, falha de socket)**.

---

## 2. Arquivos Alterados

1. [`backend/src/payment/providers/mercado-pago.provider.ts`](file:///d:/eusou/backend/src/payment/providers/mercado-pago.provider.ts)
   - Adicionada captura defensiva do header `x-request-id` a partir de `res.headers` (suportando tanto `Headers.get('x-request-id')` quanto objetos Record chave/valor).
   - Anexado `xRequestId` dentro de `rawResponse` tanto em cenários de sucesso (`status >= 200 && status < 300`) quanto de erro (`status >= 400`).
   - Adicionado `try/catch` envolvendo a chamada `this.request` para absorver exceções de rede e extrair o `x-request-id` caso presente no erro sem quebrar a execução, retornando um status `PaymentStatus.FAILED` seguro com os metadados de observabilidade.
   - Adicionado log estruturado `this.logger.log` / `this.logger.error` registrando o `x-request-id` e status HTTP para rastreamento imediato.
2. [`backend/src/payment/payment.service.spec.ts`](file:///d:/eusou/backend/src/payment/payment.service.spec.ts)
   - Adicionados 5 testes unitários dedicados à observabilidade do `x-request-id`, conformidade da resposta e integridade de segurança.

---

## 3. Onde o `x-request-id` é Armazenado

O `x-request-id` é armazenado no campo:
```
Payment.metadata.xRequestId
```
- **Modelo Prisma**: `Payment.metadata` (tipo `Json?` no banco PostgreSQL / SQLite / Supabase).
- **Sem necessidade de migrations**: O campo `metadata` já existe no schema do Prisma e no banco de produção/homologação, eliminando qualquer risco de alteração estrutural de banco de dados ou execução de DDL.
- **Estrutura Armazenada em Falha (Exemplo HTTP 500)**:
  ```json
  {
    "status": 500,
    "message": "internal_error",
    "cause": [],
    "error": null,
    "xRequestId": "48b0a9fc-5c91-4993-9c59-dcf675845c4e"
  }
  ```
- **Estrutura Armazenada em Sucesso (Exemplo HTTP 201)**:
  ```json
  {
    "id": 123456789,
    "status": "approved",
    "status_detail": "accredited",
    "transaction_amount": 39.9,
    "xRequestId": "48b0a9fc-5c91-4993-9c59-dcf675845c4e"
  }
  ```

---

## 4. Garantia de Segurança e Sanitização de Segredos

O campo de observabilidade e o payload persistido em `metadata` foram auditados contra vazamento de segredos:
- **Access Token**: **NUNCA persistido** (permanece restrito aos headers privados da chamada HTTP).
- **Public Key**: **NUNCA persistida** nos logs ou metadados de pagamento.
- **CardToken**: **NUNCA persistido** no banco de dados ou em `metadata`.
- **Dados do Cartão (PAN, CVV, expiração)**: **NUNCA recebidos no backend** e **NUNCA persistidos**.
- **x-request-id**: Identificador opaco de rastreamento técnico (UUID ou hash) emitido pelo gateway, seguro para auditoria e suporte.

---

## 5. Testes Executados e Resultados

Foram adicionados 5 novos testes cobrindo todas as especificações:

| Teste | Cenário | Resultado |
|---|---|---|
| **Teste 1** | Resposta HTTP 200 com `x-request-id` → identificador capturado em `rawResponse.xRequestId` | ✅ PASS |
| **Teste 2** | Resposta HTTP 400 com `x-request-id` → identificador capturado em `rawResponse.xRequestId` | ✅ PASS |
| **Teste 3** | Resposta HTTP 500 com `x-request-id` → identificador capturado em `rawResponse.xRequestId` | ✅ PASS |
| **Teste 4** | Resposta sem `x-request-id` → fluxo não quebra e opera normalmente | ✅ PASS |
| **Teste 5** | Exceção de rede (timeout/disconnect) → identificador capturado se disponível e retorno `FAILED` seguro | ✅ PASS |
| **Segurança** | Sanitização em todos os testes: serialização de `rawResponse` não contém `Access Token` nem `CardToken` | ✅ PASS |

### Resumo dos Testes e Builds:
- **`payment.service.spec.ts`**: **25/25 PASS (100%)**
- **`e2e-homologation.spec.ts`**: **9/9 PASS (100%)**
- **Backend Build (`nest build`)**: **PASS (código 0)**
- **Frontend Build (`tsc -b && vite build`)**: **PASS (código 0)**
- **Prisma Validate**: **PASS (schema íntegro)**
- **Prisma Generate**: **PASS (cliente atualizado)**
- **ESLint & Prettier**: **0 erros** nos arquivos modificados
- **Backend Service**: Reiniciado na porta 3000 (PID 16856) com o código de observabilidade ativo em memória

---

## 6. Migrations

- **Nenhuma migration necessária**: O modelo `Payment` já continha a coluna `metadata Json?`.
- Nenhuma alteração de schema (`schema.prisma`) foi feita.
- Nenhum DDL foi executado no banco de dados.

---

## 7. Garantias Observadas

- **Nenhum pagamento real ou teste foi realizado**.
- **Nenhum clique ou retry no checkout foi efetuado**.
- **Nenhum pedido novo foi criado**.
- **Nenhum dado comercial existente foi alterado**.
- **Nenhuma credencial foi alterada**.
- **Nenhum commit/push foi realizado**.

---

## 8. Status da Fase F16-B

> **STATUS ATUAL: B — HOMOLOGADO COM RESSALVAS**  
> *(Mantido rigorosamente como Status B conforme instruído, pois a homologação real com pagamento aprovado no gateway do Mercado Pago ainda não ocorreu).*
