# Relatório de Diagnóstico F16-B: Validação da Identidade dos Test Users no Mercado Pago

**Data**: 11/10/2026  
**Ambiente**: Desenvolvimento Local / Sandbox Mercado Pago  
**Objetivo**: Verificar estritamente a compatibilidade entre a conta vendedora de teste, a aplicação cadastrada e a conta compradora de teste, identificando a origem do retorno `HTTP 500 internal_error` no endpoint `POST /v1/payments`.  
**Diretiva de Segurança**: Não foram executados pagamentos, chamadas de mutação, modificações de código, migrations de banco ou commits. Nenhuma credencial sensível foi exposta.

---

## 1. Identificação da Aplicação

- **Application ID**: `7623363565484094`
- **Produto / Integração**: Checkout Transparente (Mercado Pago SDK v2 + Payments API `/v1/payments`)
- **API Utilizada**: `POST https://api.mercadopago.com/v1/payments`
- **Ambiente de Execução**: `TEST` (Sandbox oficial do Mercado Pago)
- **País / Site da Integração**: Brasil (`MLB`)

---

## 2. Compatibilidade de Credenciais

- **Access Token Backend**: `TEST-7623363565484094-051912-3d735cba12972c62d8c4f48e92876620-3260132`
  - Estrutura: Prefixo `TEST` + App ID `7623363565484094` + Sufixo do Proprietário `3260132`.
- **Public Key Frontend**: `TEST-37fcab39-cf74-4116-8670-e4177e88969e`
  - Validada via MercadoPago.js v2 / `POST https://api.mercadopago.com/v1/card_tokens?public_key=...` com retorno `HTTP 201 Created`.
- **Status da Associação**: **CONFIRMADO**
  - O Access Token e a Public Key pertencem comprovadamente à aplicação de teste `7623363565484094`. A geração do CardToken ocorre com total sucesso em ambiente de teste.

---

## 3. Identificação do Vendedor de Teste (Test Seller)

- **ID do Usuário Vendedor**: `3260132`
- **Identificador de Conta / Nickname**: `PAULA.AGUIAR8`
- **País / Site**: `MLB` (Brasil)
- **Status do Vendedor**: **CONFIRMADO**
  - A aplicação e as credenciais de teste estão diretamente vinculadas à conta do vendedor `3260132` no site `MLB`.

---

## 4. Identificação do Comprador de Teste (Test Buyer)

- **E-mail submetido no checkout**: `test@testuser.com`
- **CPF submetido no checkout**: `12345678909` (CPF sintético de teste)
- **Cartão utilizado**: `5480 8328 0103 3311` (Mastercard de teste para autorização `APRO`)
- **Origem do Usuário Comprador**: Dado arbitrário / sintético genérico de exemplo documental.
- **Vínculo com a aplicação**: **NÃO CONFIRMADO / INCOMPATÍVEL**
  - O e-mail `test@testuser.com` **não** corresponde a uma conta compradora de teste oficial (`test_user_...`) gerada no painel de desenvolvedor da aplicação `7623363565484094`.

---

## 5. Regras Oficiais do Mercado Pago para Sandbox e Test Users

Segundo a documentação oficial do Mercado Pago para Checkout Transparente e testes de integração:

1. **Geração Obrigatória de Test Users**:
   - Os testes de pagamento em ambiente de Sandbox (`TEST`) exigem contas de teste criadas através da seção **Contas de teste** (*Test accounts*) do Painel do Desenvolvedor ou via API `/users/test_user`.
2. **Separação Obrigatória entre Vendedor e Comprador**:
   - O e-mail informado no nó `payer.email` do `POST /v1/payments` **não** pode ser o mesmo da conta vendedora.
   - Deve ser utilizado o e-mail de uma conta compradora de teste gerada especificamente para o mesmo país (`MLB`).
3. **Comportamento em Falha de Validação do Sandbox**:
   - Quando o `POST /v1/payments` recebe um CardToken gerado por SDK v2 em conjunto com um `payer.email` fictício não cadastrado como Test User do sandbox, o sistema interno de risco/autorização do Mercado Pago rejeita o processamento em nível de gateway de teste, retornando frequentemente `HTTP 500 internal_error` (em vez de um erro 400 descritivo de negócio).

---

## 6. Quadro Comparativo e Classificação de Diagnóstico

| Componente | Valor / Identificação | Classificação | Observações |
| :--- | :--- | :--- | :--- |
| **Aplicação** | App ID `7623363565484094` | **CONFIRMADO** | Aplicação ativa em modo teste (`MLB`). |
| **Credenciais** | Access Token & Public Key | **CONFIRMADO** | Ambos são oficiais de teste da mesma aplicação. |
| **Vendedor (Seller)** | User ID `3260132` (`PAULA.AGUIAR8`) | **CONFIRMADO** | Vendedor cadastrado e associado à aplicação. |
| **Comprador (Buyer)** | `test@testuser.com` | **INCOMPATÍVEL** | E-mail genérico fictício; não é um Test User oficial da aplicação. |
| **Documentação (CPF)** | `12345678909` | **NÃO CONFIRMADO** | CPF fictício, não vinculado a uma conta compradora oficial. |
| **Token de Cartão** | CardToken real via MP.js | **CONFIRMADO** | Gerado com sucesso HTTP 201 no frontend. |

---

## 7. Próximo Passo Recomendado

Para que o Mercado Pago aprove o pagamento sem disparar o `HTTP 500 internal_error`:
- Gerar ou coletar no Painel de Desenvolvedores do Mercado Pago (sob a mesma conta do App `7623363565484094`):
  - O e-mail oficial da conta compradora de teste (formato padrão: `test_user_XXXXX@testuser.com`).
- Utilizar este e-mail oficial de teste no campo de e-mail do checkout ao testar com o cartão `5480 8328 0103 3311`.
