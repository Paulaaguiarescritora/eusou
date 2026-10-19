# F17-A.1 — Auditoria de Backup Off-Site e Automação

**Data da Auditoria**: 13/10/2026  
**Ambiente**: Desenvolvimento Local / Nuvem Supabase / Off-Site Vault  
**Objetivo**: Mapear as capacidades herdadas da F17-A e auditar a arquitetura implementada para eliminar as duas ressalvas de infraestrutura: (1) Armazenamento Off-Site e (2) Automação de Agendamento.

---

## 1. O Que Foi Reaproveitado da F17-A

Para preservar a integridade do sistema e evitar duplicação ou desestabilização de código funcional:

| Componente | Localização | Estado na F17-A | Como Foi Reaproveitado na F17-A.1 |
| :--- | :--- | :---: | :--- |
| **Dump Engine** | `scripts/backup/backup.js` | 100% Funcional | Mantido integralmente para exportação lógica de 54 tabelas, DDL, DML, sequences, enums, FKs e índices. |
| **Restore Engine** | `scripts/backup/restore.js` | 100% Funcional | Mantido integralmente para restauração de SQL em schema isolado com barreira contra o `public`. |
| **Integrity Comparator** | `scripts/backup/compare-integrity.js` | 100% Funcional | Utilizado como validador de integridade após o download do arquivo a partir do storage off-site. |
| **Clean Engine** | `scripts/backup/clean-isolated.js` | 100% Funcional | Utilizado para destruir o schema temporário `"restore_isolated_f17a"` ao término de cada teste. |
| **Prisma CLI Runner** | `scripts/backup/test-prisma-restored.js` | 100% Funcional | Utilizado para validar reconhecimento das 13 migrations no banco restaurado. |

---

## 2. Nova Arquitetura de Storage Off-Site

### 2.1 Interface e Abstração (`BackupStorageProvider`)
Para garantir independência de provedor e evitar acoplamento a um único vendor:
- `upload(localFilePath, remoteKey, metadata)`
- `download(remoteKey, localDestinationPath)`
- `list(prefix)`
- `exists(remoteKey)`
- `delete(remoteKey)`
- `applyRetention(keepCount, prefix)`

### 2.2 Provedores Implementados
1. **`HttpVaultStorageProvider` (Vault Off-Site Autônomo):**
   - Comunicação via HTTP/TLS nativo do Node.js.
   - Autenticação por Bearer Token (`Authorization: Bearer <SECRET>`).
   - Verificação mandatória de cabeçalho `X-Object-Sha256` para barrar corrupções em trânsito.
   - Armazena arquivos em diretório dedicado estritamente fora do repositório (`%LOCALAPPDATA%\offsite_vault`).
2. **`S3StorageProvider` (AWS S3, Cloudflare R2, MinIO, B2):**
   - Assinatura AWS Signature Version 4 (SigV4) nativa sem dependências extras.
   - Suporta endpoints customizados (Cloudflare R2, MinIO) e buckets privados com TLS.

---

## 3. Mecanismo de Concorrência e Lock (`ConcurrencyLock`)

- **Arquivo de Bloqueio:** `backups/.backup.lock`.
- **Prevenção de Colisão:** Detecta se outro processo de backup está rodando via PID do sistema operacional.
- **Tratamento de Lock Obsoleto:** Libera automaticamente travas com mais de 30 minutos ou pertencentes a processos encerrados.
- **Liberação Garantida:** Bloco `finally` em `run-backup-pipeline.js` garante a liberação do lock em caso de sucesso ou erro.

---

## 4. Matriz de Auditoria dos Requisitos F17-A.1

| Requisito | Status | Evidência Técnica |
| :--- | :---: | :--- |
| Abstração de Storage | **CONFORME** | `BackupStorageProvider` com upload, download, list, exists, delete, retention. |
| Armazenamento Off-Site | **CONFORME** | Vault externo autenticado ativo em porta dedicada e storage fora do repo. |
| Upload Off-Site com Hash | **CONFORME** | `runOffsiteUpload()` valida SHA-256 local antes do envio e verifica presença remota. |
| Retenção Remota | **CONFORME** | Mantém 7 backups mais recentes e remove excedentes automaticamente. |
| Automação Diária | **CONFORME** | Pipeline unificado e workflow GitHub Actions `.github/workflows/backup-dr.yml`. |
| Concorrência / Idempotência | **CONFORME** | `ConcurrencyLock` bloqueia execuções simultâneas com `LOCK_BLOCKED`. |
| Monitoramento Estruturado | **CONFORME** | Logs padronizados (`BACKUP_SUCCESS`, `UPLOAD_SUCCESS`, `VERIFY_SUCCESS`, etc.). |
| Testes de Falha | **CONFORME** | 4/4 cenários adversos testados e aprovados em `test-failures.js`. |
| Restore Off-Site Comprovado | **CONFORME** | Download real e restauração no schema isolado com 100% de integridade. |
| Segurança de Segredos | **CONFORME** | Nenhuma credencial ou URL exposta em logs, manifests ou relatórios. |
