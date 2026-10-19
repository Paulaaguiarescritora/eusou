# EuSou — Guia Operacional de Backup, Recuperação e Disaster Recovery (F17-A)

Este documento descreve a arquitetura, a estratégia e os procedimentos operacionais padrão (SOP) para backup, restauração, auditoria de integridade e recuperação de desastres (Disaster Recovery - DR) da plataforma **EuSou**.

---

## 1. Visão Geral da Estratégia

O EuSou utiliza o PostgreSQL hospedado no Supabase como seu banco de dados relacional principal. A arquitetura de recuperação de desastres foi desenhada em duas camadas:

1. **Camada de Plataforma (Supabase Managed):**
   - Snapshots diários internos gerenciados pela infraestrutura do Supabase.
   - Retenção nativa do plano (7 dias no Free/Pro tier sem PITR dedicado).
2. **Camada Lógica Autônoma (EuSou Logical Backup Engine):**
   - Scripts agnósticos em Node.js (`scripts/backup/`) com conexão segura via `DIRECT_URL` (PostgreSQL Session Mode).
   - Exportação determinística de sequences, enums, DDL de tabelas, DML (dados completos), primary keys, unique constraints, foreign keys e índices secundários.
   - Restauração parametrizável para ambientes isolados (schemas dedicados) sem risco ao ambiente de produção (`public`).
   - Validador comparativo de integridade ponta a ponta.

---

## 2. Scripts Disponíveis

Todos os scripts estão centralizados em `scripts/backup/` e operam utilizando as variáveis seguras já presentes em `backend/.env`:

| Script | Finalidade | Comando |
| :--- | :--- | :--- |
| `scripts/backup/backup.js` | Gera dump lógico completo em formato SQL com manifesto JSON e hash SHA-256 | `node scripts/backup/backup.js` |
| `scripts/backup/restore.js` | Restaura o backup em um schema isolado para testes ou em schema de produção | `node scripts/backup/restore.js` |
| `scripts/backup/compare-integrity.js` | Compara objeto a objeto, tabela a tabela e registro a registro entre produção e o schema restaurado | `node scripts/backup/compare-integrity.js` |
| `scripts/backup/test-prisma-restored.js` | Configura temporariamente o Prisma para validar schema, gerar client e checar migrações no banco restaurado | `node scripts/backup/test-prisma-restored.js` |

---

## 3. Procedimento Operacional: Como Fazer Backup Manual

Para gerar um backup lógico imediato do banco de dados oficial:

```powershell
node scripts/backup/backup.js
```

**Resultado:**
- O arquivo é salvo no diretório seguro local `backups/eusou_backup_<TIMESTAMP>.sql`.
- Um arquivo de manifesto é gerado em `backups/eusou_backup_<TIMESTAMP>.manifest.json` contendo timestamp, contagem de tabelas, registros, tamanho e hash SHA-256.
- As credenciais, senhas e URLs completas **nunca** são exibidas no terminal.
- O diretório `backups/` e arquivos `.sql`/`.dump` são estritamente ignorados pelo Git (`.gitignore`).

---

## 4. Procedimento Operacional: Validação e Restauração em Ambiente Isolado

Para validar a integridade de um arquivo de backup sem tocar no banco oficial (`public`):

```powershell
# 1. Executar restauração no schema isolado restore_isolated_f17a
node scripts/backup/restore.js

# 2. Executar auditoria comparativa de integridade
node scripts/backup/compare-integrity.js

# 3. Validar se o Prisma CLI reconhece o banco restaurado
node scripts/backup/test-prisma-restored.js
```

---

## 5. Procedimento de Emergência: Como Recuperar o EuSou Após Perda do Banco

Em caso de corrupção catastrófica, perda acidental de dados ou deleção da base oficial:

### Passo 1: Isolar a Aplicação
Interrompa o tráfego de produção do backend para evitar gravações concorrentes durante a restauração:
```powershell
# Interromper processos NestJS / Node
```

### Passo 2: Localizar o Backup Mais Recente
Identifique em `backups/` ou no repositório de segurança off-site o backup com hash SHA-256 validado:
```powershell
Get-ChildItem -Path backups -Filter *.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

### Passo 3: Executar a Restauração no Schema Oficial (`public`)
O script `scripts/backup/restore.js` possui uma proteção ativa contra sobrescrita do schema `public`. Para restaurar sobre o banco de produção, informe os parâmetros explícitos:
```javascript
const { runRestore } = require('./scripts/backup/restore.js');

runRestore({
  targetSchema: 'public',
  forceProductionOverwrite: true
});
```

### Passo 4: Verificar Migrações e Integridade
Confirme que o Prisma reconhece todas as 13 migrações como aplicadas e sem divergências:
```powershell
cd backend
npx prisma validate
npx prisma generate
npx prisma migrate status
```

### Passo 5: Executar Teste de Regressão da Aplicação
```powershell
npm test
npm run build
```

### Passo 6: Restabelecer o Tráfego
Inicie os serviços do backend e do frontend.

---

## 6. Objetivos de RPO e RTO

### RPO (Recovery Point Objective)
- **Capacidade Técnica Comprovada (Backup Manual):** ~2,7 segundos para gerar o dump completo.
- **Objetivo Operacional Proposto:** RPO de **24 horas** com backup diário lógico agendado, ou **1 hora** caso seja habilitado PITR nativo no Supabase Pro.
- **Estado Atual:** Manual sob demanda (RPO depende da periodicidade de execução do operador).

### RTO (Recovery Time Objective)
- **Capacidade Técnica Comprovada:**
  - Dump: ~2,7s
  - Restore completo (54 tabelas, 1.058 registros, 78 FKs, 200 índices): **28,7s**
  - Validação de integridade e Prisma: ~5s
  - **RTO Técnico Total Comprovado:** **< 40 segundos** para restauração completa da base de dados.
- **RTO Operacional Alvo:** < 15 minutos (incluindo diagnóstico da falha, acionamento do operador e reinício dos serviços).

---

## 7. Política Recomendada de Retenção

1. **Backups Diários:** Manter por **7 dias**.
2. **Backups Semanais (todo domingo):** Manter por **4 semanas**.
3. **Backups Mensais (primeiro dia do mês):** Manter por **12 meses**.
4. **Descarte Seguro:** Exclusão automatizada de dumps que ultrapassarem a janela de retenção.

---

## 8. Estratégia de Armazenamento Off-Site (Recomendação de Evolução)

Para garantir proteção contra falhas regionais do provedor de nuvem (Supabase / AWS sa-east-1):
- **Destino Recomendado:** Bucket S3 com Object Lock (WORM - Write Once Read Many) na AWS (região distinta, ex: `us-east-1`) ou Cloudflare R2 / Google Cloud Storage.
- **Criptografia:** GPG / AES-256 no cliente antes do upload para o bucket.
- **Automação:** GitHub Actions agendado (`workflow_dispatch` e `schedule: '0 3 * * *'`) utilizando secrets protegidos (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BACKUP_PASSPHRASE`).

---

## 9. Limitações e Pendências

- **Off-Site Storage Ativo:** Não há bucket S3/R2 configurado no momento; backups atuais residem em armazenamento seguro local/operacional.
- **Automação Contínua via Cron/CI:** A execução dos scripts depende de acionamento manual ou agendamento no sistema operacional do host.
- **PITR (Point-in-Time Recovery):** O PITR contínuo por WAL (Write-Ahead Logging) requer plano comercial Pro/Enterprise no Supabase.
