# F17-A — Disaster Recovery Runbook (Procedimento Operacional de Recuperação)

Este runbook estabelece os procedimentos passo a passo e reproduzíveis para restabelecer a operação do EuSou em 5 cenários críticos de desastre, sem expor credenciais reais.

---

## 1. Princípios Gerais de Segurança e Recuperação

1. **Nunca executar restore em produção sem backup prévio de segurança.**
2. **Nunca incluir segredos reais (senhas, JWTs, tokens de pagamento) em documentações ou repositórios.**
3. **Sempre validar a integridade do arquivo de backup (SHA-256) antes de iniciar a restauração.**
4. **Após qualquer restauração, executar obrigatoriamente a validação do Prisma e a suíte de testes.**

---

## 2. Cenário 1: Banco de Dados Temporariamente Indisponível

**Gatilho:** O backend NestJS perde conexão com o PostgreSQL do Supabase (erros de timeout, conexões recusadas no pooler).

### Pré-requisitos
- Acesso ao painel do Supabase (`https://supabase.com/dashboard`).
- Acesso ao servidor de aplicação ou terminal operacional.

### Passo a Passo
1. **Verificar Status da Conexão:**
   ```bash
   node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.$connect().then(() => console.log('Conectado')).catch(e => console.error(e.message));"
   ```
2. **Verificar Session Pooler do Supabase:**
   - Acesse *Database* > *Connection Pooling*.
   - Confirme se o Session Pooler na porta `5432` está ativo e sem esgotamento de conexões.
3. **Reiniciar Pool de Conexões:**
   - Se o pooler estiver travado, reinicie o pooler no painel do Supabase ou alterne temporariamente para a conexão direta (`DIRECT_URL`).
4. **Verificação de Healthcheck:**
   - Acesse `http://localhost:3000/health` (ou porta configurada) para confirmar que a aplicação reestabeleceu o pool de conexões.

---

## 3. Cenário 2: Banco Corrompido ou Perda Parcial de Dados

**Gatilho:** Exclusão acidental de registros comerciais, corrupção de tabelas ou migração destrutiva inadvertida.

### Pré-requisitos
- Arquivo de backup válido em `backups/eusou_backup_<TIMESTAMP>.sql`.
- Manifesto correspondente `backups/eusou_backup_<TIMESTAMP>.manifest.json`.

### Passo a Passo
1. **Isolar Imediatamente a Aplicação:**
   - Interrompa o backend para impedir novas escritas durante a restauração:
     ```powershell
     # Encerrar processo backend
     Stop-Process -Id <PID_DO_BACKEND>
     ```
2. **Validar Integridade do Backup Escolhido:**
   ```bash
   node -e "const fs = require('fs'), crypto = require('crypto'); const hash = crypto.createHash('sha256').update(fs.readFileSync('backups/<ARQUIVO>.sql')).digest('hex'); console.log('SHA-256:', hash);"
   ```
   Compare o hash com o valor salvo no `.manifest.json`.
3. **Restauração em Schema Temporário para Conferência Prévia:**
   ```bash
   node scripts/backup/restore.js
   node scripts/backup/compare-integrity.js
   ```
4. **Restauração na Base Oficial (`public`):**
   - Execute a restauração informando a flag explícita de desastre autorizada:
     ```bash
     node -e "const { runRestore } = require('./scripts/backup/restore.js'); runRestore({ targetSchema: 'public', forceProductionOverwrite: true });"
     ```
5. **Validação do Prisma:**
   ```bash
   npm run prisma:generate --prefix backend
   npx prisma migrate status --schema backend/prisma/schema.prisma
   ```
6. **Reiniciar Serviços:**
   ```bash
   npm run start --prefix backend
   ```

---

## 4. Cenário 3: Criação de Novo Projeto Supabase (Perda Total da Instância Cloud)

**Gatilho:** Falha catastrófica na conta Supabase, exclusão acidental do projeto de nuvem ou indisponibilidade regional prolongada da AWS.

### Pré-requisitos
- Nova conta ou novo projeto provisionado no Supabase (ou em qualquer PostgreSQL compatível).
- Senha do novo banco de dados.
- Backup mais recente salvo em mídia segura.

### Passo a Passo
1. **Provisionar Novo Projeto Supabase:**
   - Crie o projeto na região desejada (preferência `sa-east-1` - São Paulo).
   - Obtenha a nova connection string do Session Pooler (porta 5432).
2. **Atualizar Configuração de Ambiente (`backend/.env`):**
   ```env
   DATABASE_URL="postgresql://postgres.[NOVO_PROJETO]:[NOVA_SENHA]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?schema=public"
   DIRECT_URL="postgresql://postgres.[NOVO_PROJETO]:[NOVA_SENHA]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?schema=public"
   ```
3. **Aplicar Estrutura e Dados a Partir do Backup:**
   ```bash
   node -e "const { runRestore } = require('./scripts/backup/restore.js'); runRestore({ targetSchema: 'public', forceProductionOverwrite: true });"
   ```
4. **Sincronizar Migrações no Novo Banco:**
   ```bash
   npx prisma migrate status --schema backend/prisma/schema.prisma
   ```
   *Resultado esperado:* `13 migrations found, Database schema is up to date!`
5. **Executar Testes de Regressão:**
   ```bash
   npm test --prefix backend
   ```

---

## 5. Cenário 4: Novo Servidor / Migração de Backend

**Gatilho:** Servidor que hospeda o backend quebrou, foi destruído ou sofreu migração de host.

### Pré-requisitos
- Repositório Git com a branch `main` atualizada.
- Node.js v20+ e npm instalados.
- Arquivo seguro de variáveis de ambiente com segredos.

### Passo a Passo
1. **Clonar Repositório:**
   ```bash
   git clone <URL_DO_REPOSITORIO> eusou
   cd eusou
   ```
2. **Restabelecer Variáveis de Ambiente:**
   - Recrie o arquivo `backend/.env` com as chaves necessárias (`PORT`, `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_ENVIRONMENT`).
3. **Instalar Dependências:**
   ```bash
   cd backend && npm install
   ```
4. **Gerar Prisma Client:**
   ```bash
   npm run prisma:generate
   ```
5. **Compilar API:**
   ```bash
   npm run build
   ```
6. **Iniciar Backend:**
   ```bash
   npm run start
   ```
7. **Validar Resposta:**
   - Faça uma chamada GET para `http://localhost:3000/public/products` para confirmar a conexão com o banco e a serialização correta de dados.

---

## 6. Cenário 5: Perda do Ambiente de Desenvolvimento Local

**Gatilho:** Falha de hardware na máquina de desenvolvimento local ou formatação de disco.

### Pré-requisitos
- Acesso ao repositório GitHub.
- Node.js LTS instalado.

### Passo a Passo
1. **Clonar Projeto:**
   ```bash
   git clone <URL_DO_REPOSITORIO> eusou
   cd eusou
   ```
2. **Instalar Dependências:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```
3. **Configurar Ambientes:**
   - Copiar `backend/.env.example` para `backend/.env` e preencher as variáveis do banco Supabase.
   - Copiar `frontend/.env.example` para `frontend/.env` e preencher a chave pública.
4. **Validar Banco e Gerar Client:**
   ```bash
   cd backend && npx prisma validate && npm run prisma:generate
   ```
5. **Executar Testes de Garantia:**
   ```bash
   npm test --prefix backend
   npm run build --prefix frontend
   ```
6. **Iniciar Ambientes de Desenvolvimento:**
   - Backend: `npm run start --prefix backend`
   - Frontend: `npm run dev --prefix frontend`

---

## 7. Procedimentos Operacionais Off-Site e Automação (F17-A.1)

### 7.1 Execução de Backup com Upload Off-Site Imediato
Para executar o ciclo completo (dump local + cálculo de hash + upload off-site + retenção dupla):
```bash
npm run db:backup:offsite --prefix backend
```

### 7.2 Consulta e Listagem de Backups no Storage Remoto
```bash
node -e "const { getStorageProvider } = require('./scripts/backup/storage/storage-factory'); getStorageProvider().list('eusou_backup_').then(objs => console.log(JSON.stringify(objs, null, 2)));"
```

### 7.3 Restauração a Partir do Storage Off-Site
Baixa o backup mais recente do cofre remoto, valida o checksum SHA-256 e restaura em schema isolado para validação:
```bash
npm run db:restore:offsite --prefix backend
```

### 7.4 Como Agir em Caso de Falha
1. **Lock Ativo Bloqueando Execução (`LOCK_BLOCKED`):**
   - Se uma execução anterior travou ou foi cancelada abruptamente, verifique o arquivo `backups/.backup.lock`.
   - Se o processo indicado no lock não estiver mais rodando, o `ConcurrencyLock` liberará a trava automaticamente após a checagem de PID ou TTL (30 min).
   - Para liberação manual de emergência:
     ```bash
     node -e "require('./scripts/backup/concurrency-lock').ConcurrencyLock.release(); console.log('Lock liberado');"
     ```
2. **Falha de Upload Off-Site (`UPLOAD_FAILED`):**
   - O backup local **nunca é descartado** se o upload falhar.
   - Verifique a conectividade de rede com o endpoint e confira as credenciais no `.env`.
   - Para reprocessar o upload do backup local mais recente sem reexecutar o dump do banco:
     ```bash
     node scripts/backup/offsite-upload.js
     ```
3. **Erro de Checksum no Download (`ChecksumMismatch`):**
   - O sistema aborta o restore imediatamente se o SHA-256 baixado divergir do manifesto remoto.
   - Selecione a versão anterior válida listada no storage remoto via parâmetro `remoteKey`.

