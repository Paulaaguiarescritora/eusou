# F16-B — Relatório de Ajuste Mínimo do Payload de Cartão do Mercado Pago

**Data**: 11/10/2026  
**Ambiente**: TEST / Homologação F16-B  
**Status**: CONCLUÍDO E HOMOLOGADO INTERNAMENTE  

---

## 1. Contexto e Motivação

Durante o diagnóstico detalhado da integração EuSou → Mercado Pago Checkout API, foi identificada uma divergência estrutural entre a implementação do provedor e a documentação oficial da API `/v1/payments`:

- **Documentação oficial Mercado Pago**: O objeto `payer` para requisições de cartão de crédito contém explicitamente `first_name` e `last_name` além de `email` e `identification`.
- **Implementação anterior EuSou**: O payload de cartão enviava apenas `email` e `identification`.

> [!NOTE]
> **Ressalva importante sobre Causa Raiz:**  
> A inclusão de `first_name` e `last_name` elimina uma divergência conhecida em relação à especificação oficial. No entanto, **NÃO se afirma categoricamente** que a ausência desses campos foi a causa comprovada do erro `HTTP 500 internal_error` retornado pelo Mercado Pago. A causa oficial do HTTP 500 permanece indeterminada / externa até a próxima validação controlada.

---

## 2. Arquivos Alterados

1. [`backend/src/payment/providers/mercado-pago.provider.ts`](file:///d:/eusou/backend/src/payment/providers/mercado-pago.provider.ts)
   - Implementação da função utilitária pura [`parseCustomerName(rawName?: string)`](file:///d:/eusou/backend/src/payment/providers/mercado-pago.provider.ts#L363-L381).
   - Inclusão dos campos `first_name` e `last_name` dentro do nó `payer` na montagem do payload de cartão de crédito.
2. [`backend/src/payment/payment.service.spec.ts`](file:///d:/eusou/backend/src/payment/payment.service.spec.ts)
   - Inclusão de testes unitários validando:
     - Envio de `first_name` e `last_name` no payload de cartão.
     - Comportamento de decomposição para nomes completos ("Comprador Teste").
     - Comportamento de segurança para nomes com termo único ("APRO" → `first_name: "APRO"`, `last_name: "APRO"`).
     - Comportamento de fallback para valores vazios/indefinidos (`"Cliente"` / `"Consumidor"`).

---

## 3. Detalhamento da Função de Nome (`parseCustomerName`)

A função segue rigorosamente a regra de particionamento seguro:

```typescript
private parseCustomerName(rawName?: string): { firstName: string; lastName: string } {
  const trimmed = (rawName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { firstName: 'Cliente', lastName: 'Consumidor' };
  }
  const parts = trimmed.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}
```

### Exemplos de Tratamento:
| Entrada | `first_name` | `last_name` |
|---|---|---|
| `"Comprador Teste"` | `"Comprador"` | `"Teste"` |
| `"Maria Silva Sauro"` | `"Maria"` | `"Silva Sauro"` |
| `"APRO"` (Nome do titular do cartão de teste) | `"APRO"` | `"APRO"` |
| `""` ou `undefined` | `"Cliente"` | `"Consumidor"` |

---

## 4. Comparativo do Payload de Cartão de Crédito

### Antes
```json
{
  "token": "card_token_hash_mascarado",
  "transaction_amount": 39.9,
  "description": "Pedido EuSou 801f3b6f-...",
  "payment_method_id": "master",
  "installments": 1,
  "payer": {
    "email": "test@testuser.com",
    "identification": {
      "type": "CPF",
      "number": "12345678909"
    }
  }
}
```

### Depois
```json
{
  "token": "card_token_hash_mascarado",
  "transaction_amount": 39.9,
  "description": "Pedido EuSou 801f3b6f-...",
  "payment_method_id": "master",
  "installments": 1,
  "payer": {
    "email": "test@testuser.com",
    "first_name": "APRO",
    "last_name": "APRO",
    "identification": {
      "type": "CPF",
      "number": "12345678909"
    }
  }
}
```
*(Nota: Os fluxos PIX e outros métodos não sofreram alterações ou regressões).*

---

## 5. Auditoria da Geração do `X-Idempotency-Key`

Foi auditado o ciclo de geração do cabeçalho de idempotência:

1. **Geração no Backend**:
   - Em `PaymentService.processPayment`:
     ```typescript
     const idempotencyKey = dto.idempotencyKey || `idem_${order.id}_${Date.now()}`;
     ```
   - O header HTTP `X-Idempotency-Key: <idempotencyKey>` é anexado a cada requisição enviada ao Mercado Pago pelo [`MercadoPagoProvider`](file:///d:/eusou/backend/src/payment/providers/mercado-pago.provider.ts#L48).
2. **Ciclo de Nova Tentativa**:
   - Cada chamada disparada pelo frontend gera uma chave única (ou o backend gera com base em `Date.now()`).
   - Quando um pagamento anterior resulta em `FAILED`, o pedido permanece em `PENDING`. Uma nova tentativa de pagamento cria um novo registro `Payment` e uma nova `idempotencyKey`, garantindo que **a chave de uma tentativa FAILED nunca seja reutilizada** em uma nova tentativa.
3. **Proteção Contra Double-Click**:
   - Tentativas com status `PAID`, `PROCESSING` ou `PENDING` para o mesmo pedido são protegidas e retornam o registro existente sem nova cobrança.

---

## 6. Resultados da Validação

- **Testes Backend Específicos (`payment.service.spec.ts`)**: 20/20 PASS (100%)
- **Testes Backend Homologação (`e2e-homologation.spec.ts`)**: 9/9 PASS (100%)
- **Backend Build (`nest build`)**: SUCESSO (Exit code 0)
- **Frontend Build (`tsc -b && vite build`)**: SUCESSO (Exit code 0)
- **Prisma Validate (`prisma validate`)**: VÁLIDO (Exit code 0)
- **ESLint & Prettier nos arquivos alterados**: 0 erros, formatado e validado
- **Backend Service**: Reiniciado na porta 3000 (PID 12164) executando o código atualizado

---

## 7. Garantias e Restrições Observadas

- **Nenhum pagamento real ou tentativa de teste foi executada** contra a API do Mercado Pago.
- **Nenhum pedido de teste** foi criado no banco de dados nesta etapa.
- **Nenhuma alteração de credenciais** ou variáveis de ambiente foi realizada.
- **Nenhuma alteração de schema** ou migration foi gerada.
- **Nenhum `git commit` ou `git push`** foi realizado.
