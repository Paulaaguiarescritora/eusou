# F17-A.1 — Relatório Técnico do Teste de Restauração Off-Site

**Data da Homologação**: 13/10/2026  
**Ambiente do Storage**: Vault Off-Site Dedicado (`HTTP_OFFSITE_VAULT`)  
**Banco de Dados**: PostgreSQL Supabase (`aws-1-sa-east-1.pooler.supabase.com:5432`)  
**Schema Alvo do Restore**: `"restore_isolated_f17a"` (100% isolado da produção)  
**Resultado Geral**: **APROVADO (100% DE INTEGRIDADE COMPROVADA)**

---

## 1. Identificação do Objeto Off-Site Baixado

| Propriedade | Valor Real Auditado |
| :--- | :--- |
| **Provedor de Origem** | `HTTP_OFFSITE_VAULT` (Cofre remoto autenticado via Bearer Token) |
| **Bucket Remoto** | `eusou-backups-offsite` |
| **Chave do Objeto (RemoteKey)** | `eusou_backup_20261013121858.sql` |
| **Tamanho Transferido** | **722.95 KB** (740.303 bytes) |
| **Hash SHA-256 Verificado** | `ce85f4e1557b312d3d90f160227bc9b18608d872a52a6a9c8198e6846cb49e65` |
| **Tempo de Download Remoto** | **18 ms** (transferência de rede para staging local) |
| **Diretório de Staging de Download** | `backups/downloads/` |

---

## 2. Execução da Restauração a Partir do Arquivo Baixado

- **Schema de Restauração**: `"restore_isolated_f17a"`.
- **Proteção Ativa**: Barreira do `restore.js` impediu qualquer impacto no schema de produção (`public`).
- **Comandos SQL Processados**: **1.941 comandos** sequenciais aplicados com sucesso.
- **Tempo de Restauração Real**: **32.840 ms** (~32,8 segundos).
- **Tabelas Restauradas**: 54 tabelas
- **Registros Restaurados**: 1.575 registros
- **Enums Criados**: 30
- **Foreign Keys Criadas**: 78
- **Índices Reconstruídos**: 200

---

## 3. Auditoria Comparativa de Entidades (Produção vs. Restaurado Off-Site)

Resultado obtido via `scripts/backup/compare-integrity.js`:

| Entidade Auditada | Registros no Oficial (`public`) | Registros no Restaurado Off-Site | Status |
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

**Totais Gerais**:
- Tabelas no Oficial: **54** | Tabelas no Restaurado Off-Site: **54** | Ausentes: **0**
- Divergências de Registros: **0**
- Vínculo de Pagamentos (`Payment`): **MATCH (100%)**
- Migrações do Prisma (`_prisma_migrations`): **13/13 idênticas**

---

## 4. Auditoria de Integridade Referencial (Ausência de Órfãos)

Consultas relacionais de validação executadas diretamente no schema restaurado:

| Checagem Relacional | Órfãos Detectados | Resultado |
| :--- | :---: | :---: |
| `OrderItem sem Order` | **0** | **PASS (0 órfãos)** |
| `Payment sem Order` | **0** | **PASS (0 órfãos)** |
| `ProductVariant sem Product` | **0** | **PASS (0 órfãos)** |
| `Inventory sem Product` | **0** | **PASS (0 órfãos)** |
| `ChannelProduct sem Product` | **0** | **PASS (0 órfãos)** |
| `AffiliateConversion sem Affiliate` | **0** | **PASS (0 órfãos)** |

---

## 5. Limpeza e Isolamento Pós-Teste

Após a validação bem-sucedida, o script `clean-isolated.js` executou a destruição do schema `"restore_isolated_f17a"`, confirmando que nenhum resquício temporário permaneceu no banco de dados.

---

## 6. Métricas Reais do Ciclo Completo de Recuperação Off-Site

* **Tempo de Download do Backup:** **18 ms**
* **Tempo de Aplicação do Restore:** **32.840 ms**
* **Tempo de Auditoria de Integridade:** **2.173 ms**
* **RTO Total Comprovado a Partir do Storage Off-Site:** **35.031 ms** (~35,0 segundos)
