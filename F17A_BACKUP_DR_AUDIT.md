# F17-A — Auditoria de Backup, Recuperação e Disaster Recovery

**Data da Auditoria**: 11/10/2026  
**Ambiente**: Desenvolvimento Local / Nuvem Supabase  
**Objetivo**: Mapear o inventário completo dos mecanismos de backup, recuperação e disaster recovery do EuSou, registrando objetivamente a conformidade de cada componente.

---

## 1. Inventário de Componentes e Status de Existência

| Item | Componente | Descrição / Evidência | Classificação |
| :--- | :--- | :--- | :---: |
| **1.1** | **Supabase Cloud Project** | Projeto ativo na região São Paulo (`sa-east-1`). Proteção nativa de infraestrutura e backups automáticos diários em nível de plataforma (gerenciados pelo Supabase). | **EXISTE** |
| **1.2** | **PostgreSQL** | Engine PostgreSQL v15+ gerenciado pelo Supabase. | **EXISTE** |
| **1.3** | **Método de Conexão** | Session Pooler Supabase via porta `5432` (`aws-1-sa-east-1.pooler.supabase.com`) para queries normais e migrações DDL. | **EXISTE** |
| **1.4** | **Prisma ORM** | Schema canônico `backend/prisma/schema.prisma` com 54 modelos mapeados. Client gerado e integrado ao NestJS. | **EXISTE** |
| **1.5** | **Migrations** | 13 migrações estruturadas no diretório `backend/prisma/migrations`. Status: `Database schema is up to date!` (13 aplicadas, 0 pendentes). | **EXISTE** |
| **1.6** | **Divergência Schema vs DB** | 0 divergências detectadas via `prisma migrate status` e `prisma validate`. | **EXISTE (CONFORME)** |
| **1.7** | **Backend Monolith** | API NestJS com TypeScript compilando sem erros (`nest build`). | **EXISTE** |
| **1.8** | **Frontend SPA** | React 19 + TypeScript + Vite + Tailwind CSS compilando sem erros (`vite build`). | **EXISTE** |
| **1.9** | **Scripts npm de Backup** | Scripts `db:backup`, `db:restore`, `db:integrity` e `db:verify-restore` configurados no `backend/package.json`. | **EXISTE** |
| **1.10** | **Scripts de Backup** | Engine em `scripts/backup/backup.js` que exporta DDL completa (54 tabelas, sequences, enums, constraints, foreign keys, índices) e DML (1.575 registros) com hash SHA-256. | **EXISTE** |
| **1.11** | **Scripts de Restore** | Engine em `scripts/backup/restore.js` com suporte a restauração controlada em schema isolado (`restore_isolated_f17a`), com proteção contra sobrescrita acidental de produção. | **EXISTE** |
| **1.12** | **Auditoria de Integridade** | Script em `scripts/backup/compare-integrity.js` que audita 28 entidades críticas, contagem de registros e 6 checagens de integridade referencial. | **EXISTE** |
| **1.13** | **Limpeza Temporária** | Script em `scripts/backup/clean-isolated.js` para destruir schemas temporários após validações. | **EXISTE** |
| **1.14** | **Controle de Versão (Git)** | Repositório local Git com branch de trabalho. Backups (`backups/`, `*.sql`, `*.dump`) rigorosamente ignorados no `.gitignore`. | **EXISTE** |
| **1.15** | **GitHub Actions (CI/CD)** | Nenhum workflow configurado no repositório (`.github/workflows` ausente). | **NÃO EXISTE** |
| **1.16** | **Cron / Scheduler Periódico** | Nenhuma rotina de agendamento automático configurada no sistema operacional ou nuvem. Disparos atualmente manuais/sob demanda. | **NÃO EXISTE** |
| **1.17** | **Armazenamento Remoto Off-Site** | Backups gerados residem no sistema de arquivos local (`backups/`). Nenhum bucket S3/R2 configurado com upload automatizado fora da nuvem Supabase. | **NÃO EXISTE** |
| **1.18** | **Monitoramento de Falhas / Alertas** | Nenhum webhook ou serviço de notificação (ex: Discord, Telegram, PagerDuty) configurado para alertar sobre falhas em dumps. | **NÃO EXISTE** |

---

## 2. Inventário de Segredos e Variáveis de Ambiente

> **Regra de Segurança**: Nenhum valor de segredo é exposto ou exibido neste relatório.

### Backend (`backend/.env`)
- `PORT`: **CONFIGURADA**
- `NODE_ENV`: **CONFIGURADA**
- `DATABASE_URL`: **CONFIGURADA**
- `DIRECT_URL`: **CONFIGURADA**
- `JWT_SECRET`: **CONFIGURADA**
- `JWT_REFRESH_SECRET`: **CONFIGURADA**
- `MERCADOPAGO_ACCESS_TOKEN`: **CONFIGURADA**
- `MERCADOPAGO_ENVIRONMENT`: **CONFIGURADA**

### Frontend (`frontend/.env`)
- `VITE_MERCADOPAGO_PUBLIC_KEY`: **CONFIGURADA**

---

## 3. Matriz de Responsabilidade (Supabase vs. EuSou)

| Camada | Responsabilidade do Supabase | Responsabilidade da Aplicação EuSou |
| :--- | :--- | :--- |
| **Infraestrutura de Banco** | Alta disponibilidade do servidor PostgreSQL, patches de segurança do SO, failover de hardware, provisionamento de discos e isolamento de rede. | Definição de índices adequados, pool de conexões (Session Mode), modelagem relacional no Prisma. |
| **Backup Automático** | Backup diário de snapshots físicos de disco e retenção de acordo com o plano do projeto. | **Backup lógico determinístico** (SQL dump) portável, exportação de dados de negócio, verificação periódica de integridade e restauração independente de plataforma. |
| **Disaster Recovery** | Restauração da instância de nuvem em caso de desastre no datacenter AWS sa-east-1. | **Procedimento de migração e reconstrução**: capacidade de recriar o banco EuSou em outro provedor (ex: RDS, Neon, PostgreSQL próprio) caso o Supabase fique indisponível. |
| **Controle de Acesso** | Proteção de credenciais de banco e firewall de pooler. | Mascaramento de senhas, não versionamento de `.env`, segregação de chaves de API externas. |

---

## 4. Conclusão da Auditoria

O projeto EuSou possui uma **camada técnica completa e funcional de geração de backup lógico e restauração em ambiente isolado**, superando os riscos de dependência cega da nuvem.

Contudo, para atingir o nível enterprise sem ressalvas, permanecem identificadas duas pendências de infraestrutura:
1. **Automação de Agendamento (Cron / CI)**: execução periódica sem intervenção humana.
2. **Armazenamento Off-Site Externo**: réplica de backups em bucket de nuvem secundário (S3/R2).
