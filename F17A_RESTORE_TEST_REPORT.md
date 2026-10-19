# F17-A — Relatório Técnico do Teste de Restauração em Ambiente Isolado

**Data do Teste**: 11/10/2026  
**Ambiente de Execução**: PostgreSQL Supabase (São Paulo, `sa-east-1`)  
**Schema Alvo do Restore**: `"restore_isolated_f17a"` (100% isolado do schema oficial `"public"`)  
**Resultado Geral**: **APROVADO (100% DE INTEGRIDADE E CONFORMIDADE)**

---

## 1. Identificação do Backup Utilizado

| Propriedade | Valor Real Auditado |
| :--- | :--- |
| **Arquivo de Origem** | `backups/eusou_backup_20261011093409.sql` |
| **Manifesto** | `backups/eusou_backup_20261011093409.manifest.json` |
| **Tamanho em Disco** | **754.17 KB** (772.275 bytes) |
| **Hash SHA-256** | `d44416d60016fcdf4e9e9044ab3be9c315209e59d4322469e631fd56a2994894` |
| **Timestamp de Geração** | `2026-10-11T09:34:09.000Z` |
| **Tempo de Dump (Geração)** | **3.081 ms** (~3,08 segundos) |
| **Tabelas Exportadas** | 54 tabelas |
| **Registros Exportados** | 1.575 registros |

---

## 2. Execução da Restauração

- **Destino**: Schema isolado `"restore_isolated_f17a"`.
- **Proteção Ativa**: O engine `scripts/backup/restore.js` barrou automaticamente qualquer escrita no schema `public`.
- **Comandos SQL Processados**: **2.019 comandos** sequenciais (sequences, enums DDL, table DDL, insert DML, primary keys, unique constraints, foreign keys e índices).
- **Tempo de Execução do Restore (RTO Técnico)**: **37.071 ms** (~37,07 segundos).
- **Status da Aplicação**: Sucesso com zero erros ou comandos rejeitados.

---

## 3. Auditoria Comparativa de Entidades (Oficial vs. Restaurado)

Resultado da conferência realizada via `scripts/backup/compare-integrity.js`:

| Entidade Auditada | Registros no Oficial (`public`) | Registros no Restaurado (`restore_isolated_f17a`) | Status |
| :--- | :---: | :---: | :---: |
| `User` | 2 | 2 | **MATCH (100%)** |
| `Role` | 1 | 1 | **MATCH (100%)** |
| `Product` | 1 | 1 | **MATCH (100%)** |
| `ProductVariant` | 4 | 4 | **MATCH (100%)** |
| `AttributeDefinition` | 0 | 0 | **MATCH (100%)** |
| `Niche` | 1 | 1 | **MATCH (100%)** |
| `Category` | 1 | 1 | **MATCH (100%)** |
| `Catalog` | 3 | 3 | **MATCH (100%)** |
| `Collection` | 2 | 2 | **MATCH (100%)** |
| `Order` | 66 | 66 | **MATCH (100%)** |
| `OrderItem` | 66 | 66 | **MATCH (100%)** |
| `Affiliate` | 1 | 1 | **MATCH (100%)** |
| `AffiliateLink` | 0 | 0 | **MATCH (100%)** |
| `AffiliateConversion` | 44 | 44 | **MATCH (100%)** |
| `Printer` | 0 | 0 | **MATCH (100%)** |
| `Material` | 0 | 0 | **MATCH (100%)** |
| `ProductionJob` | 0 | 0 | **MATCH (100%)** |
| `Inventory` | 1 | 1 | **MATCH (100%)** |
| `StockMovement` | 189 | 189 | **MATCH (100%)** |
| `Channel` | 1 | 1 | **MATCH (100%)** |
| `ChannelProduct` | 1 | 1 | **MATCH (100%)** |
| `ChannelOrder` | 1 | 1 | **MATCH (100%)** |
| `PricingProfile` | 1 | 1 | **MATCH (100%)** |
| `PricingChannelRule` | 1 | 1 | **MATCH (100%)** |
| `ProductChannelPrice` | 1 | 1 | **MATCH (100%)** |
| `Payment` | 12 | 12 | **MATCH (100%)** |
| `AuditLog` | 1.014 | 1.014 | **MATCH (100%)** |
| `MarketplaceEvent` | 44 | 44 | **MATCH (100%)** |

**Totais Globais**:
- Tabelas no Oficial: **54**
- Tabelas no Restaurado: **54**
- Tabelas Ausentes: **0**
- Divergências de Contagem: **0**

---

## 4. Auditoria de Integridade Referencial (Checagem de Órfãos)

Consultas relacionais diretas executadas no schema restaurado para garantir que nenhuma chave estrangeira quebrou:

| Checagem de Chave Estrangeira | Órfãos Detectados | Resultado |
| :--- | :---: | :---: |
| `OrderItem sem Order correspondente` | **0** | **PASS (0 órfãos)** |
| `Payment sem Order correspondente` | **0** | **PASS (0 órfãos)** |
| `ProductVariant sem Product correspondente` | **0** | **PASS (0 órfãos)** |
| `Inventory sem Product correspondente` | **0** | **PASS (0 órfãos)** |
| `ChannelProduct sem Product correspondente` | **0** | **PASS (0 órfãos)** |
| `AffiliateConversion sem Affiliate correspondente` | **0** | **PASS (0 órfãos)** |

---

## 5. Homologação do Prisma ORM no Schema Restaurado

O script `scripts/backup/test-prisma-restored.js` direcionou temporariamente o datasource para o schema `"restore_isolated_f17a"` e executou:

1. **`prisma validate`**:  
   `The schema at prisma\schema.prisma is valid 🚀` (PASS).
2. **`prisma migrate status`**:  
   `Datasource db at schema restore_isolated_f17a: 13 migrations found in prisma/migrations. Database schema is up to date!` (PASS).
3. **Restauração do `.env`**:  
   Arquivo `.env` original com datasource `public` reestabelecido imediatamente com 100% de integridade.

---

## 6. Métricas Reais Medidas: RPO e RTO

- **RPO (Recovery Point Objective)**:
  - *Medição Técnica de Geração:* **3.081 ms** (~3,1 segundos para produzir o dump completo de 1.575 registros e 54 tabelas).
  - *RPO Operacional:* Determinado pela frequência de execução (recomendado diário / 24h ou sob demanda antes de deploys).
- **RTO (Recovery Time Objective)**:
  - *Medição Técnica Real de Restauração:* **37.071 ms** (~37,1 segundos).
  - *RTO de Ponta a Ponta:* **< 45 segundos** (3,1s dump + 37,1s restore + 3s validações de integridade).
