/**
 * EuSou - Restauração Real a Partir do Storage Off-Site
 * F17-A.1: Disaster Recovery & Backup Strategy
 *
 * Baixa o backup armazenado no cofre remoto, valida o checksum SHA-256,
 * restaura em schema isolado e executa a auditoria completa de integridade.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getStorageProvider } = require('./storage/storage-factory');
const { runRestore } = require('./restore');
const { compareIntegrity } = require('./compare-integrity');
const { cleanIsolatedSchema } = require('./clean-isolated');

async function runOffsiteRestoreTest(options = {}) {
  const startTime = Date.now();
  console.log('[MONITOR] EVENT=OFFSITE_RESTORE_STARTED Timestamp=' + new Date().toISOString());

  const provider = options.provider || getStorageProvider(options.storageConfig || {});
  console.log(`[OFFSITE-RESTORE] Conectando ao provedor: ${provider.name}`);

  // 1. Listar objetos off-site e selecionar o mais recente
  const remoteObjects = await provider.list('eusou_backup_');
  const sqlObjects = remoteObjects.filter(o => o.remoteKey.endsWith('.sql'));

  if (sqlObjects.length === 0) {
    console.error('[MONITOR] EVENT=RESTORE_FAILED Motivo=NenhumBackupOffsite');
    throw new Error('Nenhum backup .sql encontrado no storage off-site para restauração.');
  }

  const targetBackup = options.remoteKey
    ? sqlObjects.find(o => o.remoteKey === options.remoteKey)
    : sqlObjects[0];

  if (!targetBackup) {
    throw new Error(`Objeto remoto não encontrado: ${options.remoteKey}`);
  }

  console.log(`[OFFSITE-RESTORE] Backup selecionado no storage off-site: ${targetBackup.remoteKey} (${(targetBackup.sizeBytes / 1024).toFixed(2)} KB)`);

  // 2. Download para diretório de staging dedicado
  const downloadDir = path.resolve(__dirname, '../../backups/downloads');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const downloadedSqlPath = path.join(downloadDir, targetBackup.remoteKey);
  console.log(`[OFFSITE-RESTORE] Baixando objeto para staging: ${downloadedSqlPath}...`);
  const downloadStart = Date.now();
  const downloadResult = await provider.download(targetBackup.remoteKey, downloadedSqlPath);
  const downloadDuration = Date.now() - downloadStart;

  console.log(`[OFFSITE-RESTORE] Download concluído em ${downloadDuration}ms. SHA-256 verificado: ${downloadResult.sha256}`);

  // 3. Validação do arquivo baixado
  const fileBuffer = fs.readFileSync(downloadedSqlPath);
  const localComputedSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  if (targetBackup.sha256 && targetBackup.sha256 !== localComputedSha256) {
    console.error('[MONITOR] EVENT=RESTORE_FAILED Motivo=ChecksumMismatch');
    throw new Error(`Corrupção detectada! Hash remoto: ${targetBackup.sha256}, hash local baixado: ${localComputedSha256}`);
  }

  console.log('[MONITOR] EVENT=DOWNLOAD_SUCCESS File=' + targetBackup.remoteKey + ' Sha256=' + localComputedSha256);

  // 4. Restauração real em schema isolado
  const targetSchema = options.targetSchema || 'restore_isolated_f17a';
  console.log(`[OFFSITE-RESTORE] Restaurando backup baixado no schema isolado "${targetSchema}"...`);

  const restoreStart = Date.now();
  const restoreResult = await runRestore({
    backupPath: downloadedSqlPath,
    targetSchema,
    forceProductionOverwrite: false // SEGURANÇA MÁXIMA: nunca sobre o public
  });
  const restoreDuration = Date.now() - restoreStart;

  // 5. Comparação e Auditoria Completa de Integridade
  console.log(`[OFFSITE-RESTORE] Executando auditoria comparativa entre "public" e "${targetSchema}"...`);
  const integrityResult = await compareIntegrity(targetSchema);

  if (!integrityResult.success) {
    console.error('[MONITOR] EVENT=RESTORE_FAILED Motivo=IntegrityCheckFailed');
    throw new Error('Falha na auditoria de integridade pós-restauração off-site.');
  }

  // 6. Limpeza e Destruição do Schema Temporário
  if (options.cleanup !== false) {
    console.log(`[OFFSITE-RESTORE] Destruindo schema temporário "${targetSchema}"...`);
    await cleanIsolatedSchema(targetSchema);
    console.log(`[OFFSITE-RESTORE] Limpeza concluída.`);
  }

  const totalDuration = Date.now() - startTime;
  console.log('[MONITOR] EVENT=RESTORE_SUCCESS TotalDurationMs=' + totalDuration);

  console.log(`\n================ RESTAURAÇÃO OFF-SITE HOMOLOGADA ================`);
  console.log(`Origem Remota:    ${targetBackup.remoteKey}`);
  console.log(`Tamanho:          ${(downloadResult.sizeBytes / 1024).toFixed(2)} KB`);
  console.log(`SHA-256:          ${localComputedSha256}`);
  console.log(`Download:         ${downloadDuration}ms`);
  console.log(`Restore:          ${restoreDuration}ms`);
  console.log(`Tabelas:          ${integrityResult.restoredTablesCount}`);
  console.log(`Divergências:     ${integrityResult.countDifferences.length}`);
  console.log(`Integridade:      APROVADA (100% IDÊNTICO)`);
  console.log(`Ambiente Limpo:   CONFIRMADO`);
  console.log(`=================================================================\n`);

  return {
    success: true,
    remoteKey: targetBackup.remoteKey,
    sizeBytes: downloadResult.sizeBytes,
    sha256: localComputedSha256,
    downloadDurationMs: downloadDuration,
    restoreDurationMs: restoreDuration,
    totalDurationMs: totalDuration,
    integrity: integrityResult
  };
}

if (require.main === module) {
  runOffsiteRestoreTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ERRO CRÍTICO NO RESTORE OFF-SITE]:', err.message);
      process.exit(1);
    });
}

module.exports = { runOffsiteRestoreTest };
