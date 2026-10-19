# MODELO_IMPORTACAO_PRODUTOS_EUSOU_REPORT.md
# RELATÓRIO — REESTRUTURAÇÃO DA PLANILHA OFICIAL DE IMPORTAÇÃO DE PRODUTOS EUSOU

**Data da Geração:** 13/10/2026 às 12:32  
**Arquivo Gerado:** `modelo_importacao_produtos_eusou.xlsx`  
**Objetivo:** Criar o modelo oficial, robusto e padronizado para importação de catálogo no EuSou, respeitando estritamente a arquitetura de produtos, variantes, nichos, categorias, subcategorias, estoques e o motor multicanal F12.

---

## A. ARQUIVOS ANALISADOS

1. **`modelo_produtos_eusou.csv`**
   - Continha 5 registros de produtos/variantes preliminares (Porta Chaves Gatinho em 3 cores e Medalha Pet em 2 cores).
   - Não possuía colunas de canais de marketplace, custo, atacado ou subcategorias estruturadas.
2. **`tabela-precos-marketplaces.xlsx`**
   - Planilha de referência comercial contendo 24 produtos (Cod 1 a 24).
   - Continha custos, atacado, varejo e preços de canais (Mercado Livre, Facebook, Shopee, TikTok Shop).
   - Não continha SKUs de variantes individuais (cores/tamanhos), controle de estoque ou imagens.

---

## B. ESTRUTURA CRIADA (`modelo_importacao_produtos_eusou.xlsx`)

O arquivo foi criado com **4 abas dedicadas e protegidas por validação de dados**:

### Aba 1 — `PRODUTOS` (23 colunas oficiais):
1. **SKU:** Código único da variante/item físico (ex: `FEL-GAT-001-PRE`).
2. **SKU_PRODUTO:** Código base da família do produto (ex: `FEL-GAT-001` ou `MP-1`).
3. **NOME_PRODUTO:** Nome comercial completo exibido na vitrine.
4. **NICHO:** Restrito via lista suspensa a: `Pet Shop`.
5. **CATEGORIA:** Restrito via lista suspensa a: `Gatos`, `Cães e Gatos`, `Cães`.
6. **SUBCATEGORIA:** Restrito via lista suspensa a: `Decoração`, `Acessórios`.
7. **DESCRICAO_CURTA:** Resumo de 1 a 2 linhas do produto.
8. **DESCRICAO:** Texto detalhado com características técnicas e diferenciais.
9. **VARIANTE:** Nome amigável da opção (ex: `Preto`, `Vermelho`, `Azul`).
10. **COR:** Cor específica da variante (para filtros e seletores visuais).
11. **TAMANHO:** Tamanho (ex: `P`, `M`, `G`, `Único` ou dimensões).
12. **CUSTO:** Custo de fabricação/aquisição em R$ (moeda).
13. **ATACADO:** Preço de venda para compras em lote/atacado em R$ (moeda).
14. **VAREJO:** Preço base oficial da loja própria EuSou em R$ (moeda).
15. **MERCADO_LIVRE:** Preço praticado no canal Mercado Livre em R$ (moeda).
16. **FACEBOOK:** Preço praticado no canal Facebook/Instagram em R$ (moeda).
17. **SHOPEE:** Preço praticado no canal Shopee em R$ (moeda).
18. **TIKTOK_SHOP:** Preço praticado no canal TikTok Shop em R$ (moeda).
19. **ESTOQUE_INICIAL:** Quantidade física pronta em estoque para carga inicial no F7.
20. **IMAGEM_PRINCIPAL:** URL da foto principal em alta resolução.
21. **IMAGENS_ADICIONAIS:** URLs secundárias separadas por ponto e vírgula (`;`).
22. **TAGS:** Palavras-chave separadas por ponto e vírgula (`;`).
23. **STATUS:** Restrito via lista suspensa a: `ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`.

### Aba 2 — `PRECOS_MARKETPLACES`
- Cópia fiel, integral e intocada dos 24 produtos e fórmulas da tabela `tabela-precos-marketplaces.xlsx` para servir como base de auditoria e referência histórica.

### Aba 3 — `LISTAS`
- Tabela de valores permitidos que alimenta as listas suspensas (Data Validation) do Excel:
  - **NICHO:** `Pet Shop`
  - **CATEGORIA:** `Gatos`, `Cães e Gatos`, `Cães`
  - **SUBCATEGORIA:** `Decoração`, `Acessórios`
  - **STATUS:** `ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`

### Aba 4 — `VALIDACAO`
- Registra todas as linhas e produtos que possuem divergências ou pendências antes da importação.
- Colunas: `LINHA`, `SKU`, `PRODUTO`, `CAMPO`, `PROBLEMA`, `ORIGEM`, `ACAO_NECESSARIA`.

---

## C. CORRESPONDÊNCIAS ENCONTRADAS

- Os arquivos originais possuíam origens distintas: o CSV possuía a estrutura do catálogo inicial do EuSou (com SKUs, descrições e estoques parciais), enquanto a planilha de marketplaces continha os 24 itens calculados comercialmente.
- Nenhuma correspondência forçada ou aproximada por nome foi aplicada, cumprindo estritamente a Regra 7 ("Não fazer correspondência aproximada apenas pelo nome").

---

## D. PRODUTOS SEM CORRESPONDÊNCIA E DIVERGÊNCIAS REGISTRADAS

Todas as ocorrências foram documentadas na aba **`VALIDACAO`**:
1. **5 Linhas Iniciais (Porta Chaves e Medalha):**  
   - Constaram no CSV com descrições e imagens, mas sem os custos e preços de marketplaces definidos na tabela de precificação.
2. **24 Itens da Tabela de Marketplaces (Cod 1 a 24):**  
   - Possuem todos os preços e canais completos (Custo, Atacado, Varejo, ML, Facebook, Shopee, TikTok Shop).
   - Ficaram com o `SKU_PRODUTO` como `MP-{Cod}`, e com o `SKU` individual de variante, cores e imagens pendentes de definição antes da importação.

---

## E. PREÇOS PREENCHIDOS A PARTIR DA TABELA DE MARKETPLACES

Para os 24 produtos originários da `tabela-precos-marketplaces.xlsx`, todos os 7 preços foram preenchidos com exatidão e formatados monetariamente:
- **Custo:** R$ 2,10 a R$ 6,71
- **Atacado:** R$ 2,90 a R$ 12,42
- **Varejo:** R$ 6,90 a R$ 16,90
- **Mercado Livre:** R$ 15,90 a R$ 22,90
- **Facebook:** R$ 6,90 a R$ 16,90
- **Shopee:** R$ 12,90 a R$ 21,90
- **TikTok Shop:** R$ 10,90 a R$ 17,90

---

## F. CAMPOS AINDA VAZIOS (DEPENDENTES DE PREENCHIMENTO MANUAL)

Para a aprovação final e carga do catálogo, os seguintes campos precisam ser preenchidos ou conferidos:
1. **SKU da Variante:** Definir os códigos das cores/modelos para os produtos da tabela de marketplaces.
2. **Imagens:** Inserir os links das fotos dos produtos (principais e adicionais).
3. **Descrições:** Inserir a descrição curta e longa dos itens 1 a 24.
4. **Estoque Inicial:** Inserir a quantidade física inicial disponível de cada item.

---

## G. COMPATIBILIDADE COM A ARQUITETURA DO EUSOU

Quando a planilha for importada, cada coluna alimentará uma entidade nativa existente no EuSou, **sem alterar o banco ou criar campos paralelos**:

| Coluna da Planilha | Entidade no Prisma EuSou | Campo / Relação no Banco |
| :--- | :--- | :--- |
| `SKU_PRODUTO`, `NOME_PRODUTO`, `STATUS` | `Product` | `Product.sku`, `Product.name`, `Product.status` |
| `DESCRICAO_CURTA`, `DESCRICAO` | `Product` | `Product.shortDescription`, `Product.description` |
| `VAREJO` | `Product` | `Product.basePrice` (Preço oficial da loja própria) |
| `SKU`, `VARIANTE`, `COR`, `TAMANHO` | `ProductVariant` | `ProductVariant.sku`, `ProductVariant.name` |
| `NICHO` (`Pet Shop`) | `Niche`, `ProductNiche` | Vinculação com o nicho oficial |
| `CATEGORIA`, `SUBCATEGORIA` | `Category`, `ProductCategory` | Categorização taxonômica |
| `ESTOQUE_INICIAL` | `Inventory`, `StockMovement` | Carga inicial no estoque físico (F7) |
| `IMAGEM_PRINCIPAL`, `IMAGENS_ADICIONAIS` | `Media` | Galeria de fotos do produto |
| `TAGS` | `Tag`, `ProductTag` | Filtros e busca de vitrine |
| `CUSTO` | `ProductChannelPrice` / `PricingProfile` | Base de custo do motor F12 |
| `MERCADO_LIVRE` | `ProductChannelPrice` | Preço associado ao canal `Mercado Livre` |
| `FACEBOOK` | `ProductChannelPrice` | Preço associado ao canal `Facebook` |
| `SHOPEE` | `ProductChannelPrice` | Preço associado ao canal `Shopee` |
| `TIKTOK_SHOP` | `ProductChannelPrice` | Preço associado ao canal `TikTok Shop` |

---

## H. RESUMO OBJETIVO DA ENTREGA

- **Total de linhas criadas na aba PRODUTOS:** **29 linhas** (5 variantes iniciais + 24 produtos comerciais).
- **Produtos com preços completos multicanal:** **24 produtos**.
- **Produtos pendentes de precificação multicanal:** **5 variantes** (registradas na aba `VALIDACAO`).
- **Validação de Listas Suspensas (Dropdowns):** Ativas no Excel para `NICHO`, `CATEGORIA`, `SUBCATEGORIA` e `STATUS`.
- **Alterações de Código e Banco de Dados:** **ZERO**. Nenhum dado foi importado para o banco sem a prévia aprovação da planilha.
