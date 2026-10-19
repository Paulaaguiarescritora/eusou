# VALIDACAO_ARQUITETURA_PLANILHA_EUSOU.md
# AUDITORIA DE COMPATIBILIDADE: PLANILHA OFICIAL × ARQUITETURA COMERCIAL DEFINITIVA EUSOU

**Data da Auditoria:** 13/10/2026 às 12:40  
**Ambiente:** EuSou Core Architecture (Prisma Schema, F1 a F17)  
**Arquivo Auditado:** `modelo_importacao_produtos_eusou.xlsx`  
**Classificação Oficial:** **A — PLANILHA COMPATÍVEL E PRONTA PARA IMPORTAÇÃO**

---

## 1. RESPOSTAS OBJETIVAS AOS 12 QUESITOS MANDATÓRIOS

### 1. O campo NICHO está corretamente relacionado à entidade `Niche`?
**SIM.**  
No Prisma, a relação é N:N via tabela de junção `ProductNiche (productId, nicheId)`. O campo `NICHO` ("Pet Shop") da planilha vincula o produto diretamente ao registro da entidade `Niche`, permitindo que o produto pertença a um nicho hoje e seja associado a outros nichos no futuro sem duplicar o cadastro base do produto.

### 2. CATEGORIA e SUBCATEGORIA estão corretamente relacionadas ao `Niche`?
**SIM.**  
No modelo do EuSou, `Category` possui uma relação hierárquica autorreferenciada (`parentId` para subcategorias) e uma chave estrangeira direta `nicheId` vinculada a `Niche`.  
- A coluna `CATEGORIA` ("Gatos", "Cães e Gatos", "Cães") alimenta as categorias principais vinculadas ao nicho.  
- A coluna `SUBCATEGORIA` ("Decoração", "Acessórios") alimenta as subcategorias filhas vinculadas via `parentId` à categoria principal, mantendo integridade estrita e eliminando texto livre solto.

### 3. O produto continua sendo um cadastro central único?
**SIM.**  
O produto é unicamente identificado por `SKU_PRODUTO` e `NOME_PRODUTO`, mapeando para a entidade central `Product`.  
Mesmo que o produto tenha 3 variantes ou pertença a múltiplos nichos, existirá **exatamente 1 registro na tabela `Product`**. As linhas da planilha que compartilham o mesmo `SKU_PRODUTO` são agrupadas sob a mesma entidade mãe.

### 4. CUSTO está sendo tratado como custo central do produto?
**SIM.**  
O campo `CUSTO` é uma propriedade física/produtiva central (matéria-prima + tempo de impressão + acabamento), e **não** um preço de venda.  
No EuSou, ele alimenta o `costBasis` do motor de precificação F12 e a tabela de custos de produção, sem se confundir com ofertas comerciais de atacado ou varejo.

### 5. ESTOQUE_INICIAL está sendo tratado como estoque físico central?
**SIM.**  
O campo `ESTOQUE_INICIAL` alimenta a tabela central `Inventory` (e gera o movimento de balanço de abertura `StockMovement` com `type: ENTRY`, `referenceType: 'MANUAL_ADJUSTMENT'`).  
Ele representa a quantidade física real existente na prateleira da fábrica/estoque central, independente do canal onde o produto será anunciado.

### 6. ATACADO e VAREJO estão sendo tratados como preços/ofertas comerciais, e NÃO como atributos permanentes do produto?
**SIM.**  
No EuSou, o preço de varejo da loja própria é armazenado como referência operacional (`basePrice`), enquanto as políticas de atacado e canais específicos são resolvidas dinamicamente via `PricingProfile` e `PricingChannelRule` (F12). Eles são ofertas comerciais atribuíveis a regras e canais, não colunas engessadas no produto físico.

### 7. MERCADO_LIVRE, FACEBOOK, SHOPEE e TIKTOK_SHOP estão sendo corretamente direcionados para a arquitetura F12/F9, sem criar campos permanentes de marketplace no `Product`?
**SIM.**  
A planilha preserva essas colunas explicitamente para que o importador popule a tabela relacional `ProductChannelPrice (productId, channelId, effectivePrice)`, sem adicionar colunas como `mercadoLivrePrice` ou `shopeePrice` dentro da tabela `Product`. A separação arquitetural da F12 é 100% respeitada.

### 8. A estrutura permite futuramente que o mesmo produto tenha preços diferentes em diferentes nichos sem duplicar o `Product`?
**SIM.**  
Como a precificação do EuSou é modelada via `PricingProfile` associada a regras e canais (e não gravada fixa dentro de `Product`), o mesmo `productId` pode operar com uma tabela de preços na vitrine do Nicho Pet e outra tabela de preços quando exposto em outro nicho temático, sem duplicação de registro físico.

### 9. A estrutura permite futuramente reserva/alocação de estoque sem precisar duplicar o estoque físico?
**SIM.**  
O modelo de `Inventory` já possui campos segregados para `quantity` (físico total) e `reservedQuantity` (alocado temporariamente por pedidos ou canais). A carga da planilha alimenta a quantidade física real, deixando a arquitetura pronta para que módulos futuros façam partições lógicas de alocação sem duplicar o estoque físico.

### 10. As linhas da aba PRODUTOS estão claramente classificadas?
**SIM.**  
A hierarquia das 29 linhas está matematicamente definida:
- **Linhas 2 a 4 (Porta Chaves Gatinho):** Classificadas como **Produto com Múltiplas Variantes** (Mesmo `SKU_PRODUTO: FEL-GAT-001`, com 3 `SKU` de variantes distintas: `PRE`, `BRA`, `VER`).
- **Linhas 5 e 6 (Medalha Pet):** Classificadas como **Produto com Múltiplas Variantes** (Mesmo `SKU_PRODUTO: PET-MED-002`, com 2 `SKU` de variantes: `AZU`, `ROS`).
- **Linhas 7 a 30 (24 Produtos Comerciais):** Classificadas como **Produtos Base / Monovariante** (Cada um possui seu `SKU_PRODUTO: MP-1` a `MP-24`, aguardando definição de cores/opções se houver).

### 11. Para cada uma das 29 linhas, existe risco de criar produtos duplicados ou variantes incorretas?
**NÃO HÁ RISCO.**  
O importador agrupa estritamente por `SKU_PRODUTO` (ou pelo `NOME_PRODUTO` na ausência de SKU):
- 1 chamada `upsert` na tabela `Product` para cada `SKU_PRODUTO` único.
- Chamadas `upsert` em `ProductVariant` baseadas no `SKU` da variante.  
Portanto, as 3 linhas do Porta Chaves criarão exatamente **1 Product** e **3 ProductVariants**, sem nenhuma duplicação.

### 12. A planilha precisa de algum campo adicional para a importação atual?
**NÃO.**  
A planilha já contém as 23 colunas necessárias e suficientes para cobrir 100% das entidades atuais do sistema (produto, variantes, nicho, categoria, subcategoria, tags, estoque físico inicial, preços comerciais e canais F12).

---

## 2. ANÁLISE DETALHADA: O QUE ESTÁ CORRETO, O QUE NÃO DEVE SER ALTERADO E PONTOS DE ATENÇÃO

### O que está rigorosamente correto:
1. **Ausência de Domínio/Template na Planilha:**  
   Domínio próprio e templates visuais pertencem à configuração central da entidade `Niche`, e não à linha do produto. A planilha acertadamente não mistura essas responsabilidades.
2. **Listas Suspensas no Excel:**  
   As abas `LISTAS` e validações de células blindam o arquivo contra digitações erradas como "Cachorro", "Gato" ou "Pet" fora do padrão oficial.
3. **Preservação da Aba `PRECOS_MARKETPLACES`:**  
   A aba de preços originais atua como baseline imutável para conferência comercial e auditoria de margens.
4. **Isolamento de Custos e Margens:**  
   A coluna `CUSTO` é autônoma e não altera fórmulas dinâmicas do banco sem intervenção humana.

### O que NÃO deve ser alterado:
1. **Não alterar a arquitetura do banco de dados (schema.prisma):** O schema já suporta perfeitamente todas as entidades mapeadas.
2. **Não adicionar campos de marketplace na tabela `Product`:** Manter a persistência de canais em `ProductChannelPrice`.
3. **Não alterar a lógica de estoque do F7:** Manter a separação entre estoque físico (`quantity`) e estoque reservado (`reservedQuantity`).

### Podemos importar os 24 produtos comerciais agora?
**SIM, COM UMA CONDICIONAL SIMPLES:**
- Os 24 produtos comerciais possuem todos os preços, custos, margens e categorias perfeitamente definidos.
- No momento da importação, para cada produto que não tiver cor definida, o importador criará a variante padrão ("Padrão" / SKU `MP-XX-PAD`), garantindo que o produto já nasça pronto para venda no catálogo.

### Os 5 registros iniciais precisam de tratamento separado?
**SIM.**
- As 5 variantes iniciais (Porta Chaves e Medalha) possuem fotos, descrições e estoques já preenchidos, mas na planilha estão sem os preços de marketplaces (ML, Facebook, Shopee, TikTok).
- Na importação, o importador carregará essas 5 variantes para a loja própria com o preço de `VAREJO` já cadastrado, deixando as regras de marketplaces pendentes de preenchimento quando esses itens forem enviados aos canais externos.

---

## 3. CLASSIFICAÇÃO FINAL DA AUDITORIA

> **CLASSIFICAÇÃO: STATUS A — PLANILHA COMPATÍVEL E PRONTA PARA IMPORTAÇÃO**

A planilha `modelo_importacao_produtos_eusou.xlsx` atende integralmente a todos os princípios da arquitetura definitiva do EuSou:
- **Centralização do produto e estoque na matriz administrativa privada;**
- **Flexibilidade multicanal e multinicho sem duplicação de registros físicos;**
- **Total aderência aos padrões de banco de dados e regras de negócio F1 a F17.**
