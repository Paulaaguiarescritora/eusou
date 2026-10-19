# F16-B — Relatório de Diagnóstico Definitivo do Fluxo de Cartão de Crédito

**Data:** 11/10/2026  
**Ambiente:** Homologação Local (Frontend: `http://localhost:5173`, Backend: `http://localhost:3000`)  
**Gateway:** Mercado Pago (Ambiente TEST)  
**Provider Configurado:** `MercadoPagoProvider`  
**Mock Utilizado:** NÃO  

---

### A. Reprodução do Cenário
- **Ação:** No formulário de checkout, selecionado **Cartão de Crédito** com os dados de homologação oficial:
  - Titular: `APRO`
  - Número: `5480 8328 0103 3311` (Mastercard de Teste)
  - Validade: `11/30`
  - CVV: `123`
  - CPF: `12345678909`
  - Parcela: `1x`
- **Comportamento Observado pelo Usuário:**
  Ao clicar em "Confirmar e Pagar Agora", o botão entra em loading, o pedido (`Order`) é gerado no backend com sucesso (ex: `9dfdcdea-dec5-4d35-9e61-39bcdd32db2c`), a página rola para o topo e nenhuma mensagem clara de sucesso é exibida.
- **Requisição POST /payments:** **NÃO foi disparada para o backend**.

---

### B. Frontend (Análise Técnica da Camada de Apresentação)
1. **Fluxo de Submissão (`handleSubmit`):**
   - Em [CheckoutView.tsx](file:///d:/eusou/frontend/src/components/CheckoutView.tsx#L96):
     - Passo 1: Executa `POST /orders` criando a `Order` no banco (status `CONFIRMED`).
     - Passo 2: Tenta obter o `CardToken` via SDK oficial:
       ```ts
       const mp = new MercadoPagoSDK(mpPublicKey);
       const tokenResponse = await mp.createCardToken({...});
       ```
2. **Interrupção:**
   - A chamada `mp.createCardToken()` falhou com erro HTTP 404 da API do Mercado Pago.
   - O código cai no bloco `catch (err: any) { setError(err.message); }`.
   - O estado `error` é preenchido com a mensagem de falha, e a página permanece em `/checkout`. Como o alerta de erro (`{error && ...}`) fica posicionado no topo da página (linha 294), o formulário parece ter "recarregado/voltado ao topo" sem que a requisição de pagamento chegasse ao backend.

---

### C. CardToken
- **Token Gerado:** **NÃO** (`null` / `undefined`).
- **Motivo:** A chamada para a API `POST /v1/card_tokens` do Mercado Pago foi rejeitada com `404 Not Found`.

---

### D. paymentMethodId
- **Bandeira Detectada:** Não pôde ser resolvida com sucesso pelo SDK devido à falha de chave pública na API de tokens.

---

### E. Request /payments
- **Status:** **NÃO EXECUTADA**.
- A requisição `POST /payments` nem sequer chegou a ser enviada ao backend do EuSou, pois a exceção ocorreu no cliente durante a chamada de tokenização prévia no SDK do Mercado Pago.
- **Proteção PCI-DSS:** Confirmado que nenhum dado de cartão (número, CVV, validade) foi enviado ou trafegado para o backend.

---

### F. Resposta Oficial da API do Mercado Pago
Chamada simulada/isolada com a chave pública e os dados do cartão de teste:
- **Endpoint:** `POST https://api.mercadopago.com/v1/card_tokens?public_key=TEST-84954e38-4e89-4fa2-9383-c288d6139455`
- **HTTP Status:** `404 Not Found`
- **Corpo da Resposta do Mercado Pago:**
  ```json
  {
    "message": "not found public_key: TEST-84954e38-4e89-4fa2-9383-c288d6139455",
    "status": 404,
    "error": "not_found",
    "code": "not_found",
    "cause": [
      {
        "description": "not found public_key",
        "code": "E501"
      }
    ]
  }
  ```

---

### G. Backend
- O backend do EuSou está saudável (`http://localhost:3000`), rodando com `MercadoPagoProvider` ativo em modo `TEST`.
- Não recebeu chamada para `POST /payments` nessa tentativa, portanto não registrou requisições transacionais rejeitadas ou aprovadas no log do servidor.

---

### H. Banco de Dados
- **Orders criadas pelas tentativas:** 5 pedidos (`Order`) foram criados pelas tentativas manuais no status `CONFIRMED` (pois a criação da ordem ocorre no Passo 1 antes da tokenização).
- **Payments criados:** **0** (nenhum registro em `Payment` para as tentativas de cartão, pois o fluxo travou antes do `POST /payments`).
- **Movimentações de Estoque (`StockMovement`):** **0** (nenhuma reserva ou saída foi debitada).
- **Integridade do Banco:** Intacta.

---

### I. Causa Raiz Provável
1. **Public Key Inexistente / Descasada:**
   - Em [CheckoutView.tsx](file:///d:/eusou/frontend/src/components/CheckoutView.tsx#L112), a `mpPublicKey` foi definida com o fallback hardcoded:
     `'TEST-84954e38-4e89-4fa2-9383-c288d6139455'`
   - A API do Mercado Pago rejeitou essa chave com `E501: not found public_key`.
   - Essa chave pública de teste **não corresponde** à aplicação do `MERCADOPAGO_ACCESS_TOKEN` configurado no backend (`TEST-7623363565484094-...`), ou é uma chave fictícia/expirada.
2. **Ausência da Variável no Frontend:**
   - O arquivo `frontend/.env` não existe localmente. Por consequência, `import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY` resulta em `undefined`, forçando o uso do fallback inválido.
3. **Ordem de Operações (Order criada antes do CardToken):**
   - O `POST /orders` é chamado antes da tokenização. Se o `createCardToken()` falhar, o pedido já existe no banco sem nenhum pagamento associado.

---

### J. Evidência Técnica
- Resposta direta da API oficial `https://api.mercadopago.com/v1/card_tokens?public_key=TEST-84954e38-4e89-4fa2-9383-c288d6139455`:
  `404 Not Found: "not found public_key: TEST-84954e38-4e89-4fa2-9383-c288d6139455" (cause: E501)`
- Frontend capturando e atribuindo `setError(detail)`, permanecendo em tela sem avançar para `/payments`.

---

### K. Correção Necessária
1. **Configurar a Public Key Real de Teste da Aplicação:**
   - Obter a `Public Key` de teste correspondente ao `MERCADOPAGO_ACCESS_TOKEN` da aplicação do Mercado Pago (disponível no painel do Mercado Pago sob "Credenciais de teste" -> "Public key", geralmente no formato `TEST-...`).
   - Configurar `VITE_MERCADOPAGO_PUBLIC_KEY` no frontend ou fornecer via endpoint seguro de configuração pública.
2. **Inverter a Ordem de Chamada no Checkout:**
   - Gerar o `cardToken` **antes** de criar o pedido `POST /orders` (ou criar a ordem somente após a tokenização do cartão ser bem-sucedida), evitando a criação de ordens órfãs quando os dados do cartão estiverem incorretos.

---

### Classificação

**CLASSIFICAÇÃO: B** *(Integração parcialmente funcional, arquitetura correta, erro identificado e corrigível mediante o fornecimento da Public Key de teste legítima da aplicação do Mercado Pago).*

*(Status A não declarado conforme instrução).*

---

### Informações Complementares de Verificação
- **Testes Automatizados:** 13 passed, 0 failed (`npm test -- src/payment/payment.service.spec.ts`).
- **Build Backend:** `nest build` ➔ **PASS**
- **Build Frontend:** `tsc -b && vite build` ➔ **PASS**
- **Lint Frontend:** `oxlint` ➔ **PASS** (0 erros)
- **Prisma Validate:** `The schema at prisma\schema.prisma is valid 🚀` ➔ **PASS**
- **Alterações de Código Realizadas:** **NÃO** (diagnóstico estritamente somente-leitura)
- **Alterações de Banco de Dados:** **NÃO**
- **Commit / Push:** **NÃO REALIZADO**
