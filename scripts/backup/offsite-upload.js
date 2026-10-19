/**
 * EuSou - Upload de Backup para Storage Off-Site
 * F17-A.1: Disaster Recovery & Backup Strategy
 *
 * Envia o backup gerado localmente para o cofre remoto, valida a integridade
 * e aplica a política de retenção remota.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getStorageProvider } = require('./storage/storage-factory');

function findLatestLocalBackup() {
  const backupDir = path.resolve(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error('Diretório backups/ não encontrado');
  }
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql')).sort().reverse();
  if (files.length === 0) {
    throw new Error('Nenhum arquivo de backup .sql encontrado em backups/');
  }
  return path.join(backupDir, files[0]);
}

async function runOffsiteUpload(options = {}) {
  const startTime = Date.now();
  console.log('[MONITOR] EVENT=UPLOAD_STARTED Timestamp=' + new Date().toISOString());

  const localBackupPath = options.localBackupPath || findLatestLocalBackup();
  const manifestPath = localBackupPath.replace(/\.sql$/, '.manifest.json');

  if (!fs.existsSync(localBackupPath)) {
    console.error('[MONITOR] EVENT=UPLOAD_FAILED Motivo=ArquivoLocalNaoEncontrado');
    throw new Error(`Arquivo local de backup não encontrado: ${localBackupPath}`);
  }

  const stat = fs.statSync(localBackupPath);
  if (stat.size === 0) {
    console.error('[MONITOR] EVENT=UPLOAD_FAILED Motivo=ArquivoVazio');
    throw new Error('Arquivo de backup vazio (0 bytes). Upload abortado.');
  }

  // 1. Validar hash local antes do envio
  const fileBuffer = fs.readFileSync(localBackupPath);
  const localSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  let manifestData = {};
  if (fs.existsSync(manifestPath)) {
    try {
      manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifestData.sha256 && manifestData.sha256 !== localSha256) {
        console.error('[MONITOR] EVENT=UPLOAD_FAILED Motivo=ManifestHashMismatch');
        throw new Error(`Hash divergente do manifesto local: esperado ${manifestData.sha256}, calculado ${localSha256}`);
      }
    } catch (e) {
      if (e.message.includes('Hash divergente')) throw e;
    }
  }

  const provider = options.provider || getStorageProvider(options.storageConfig || {});
  console.log(`[OFFSITE-UPLOAD] Provedor selecionado: ${provider.name}`);
  console.log(`[OFFSITE-UPLOAD] Arquivo local: ${path.basename(localBackupPath)} (${(stat.size / 1024).toFixed(2)} KB)`);

  const remoteSqlKey = path.basename(localBackupPath);
  const remoteManifestKey = path.basename(manifestPath);

  // 2. Upload do dump SQL
  console.log(`[OFFSITE-UPLOAD] Enviando dump SQL (${remoteSqlKey})...`);
  const uploadResult = await provider.upload(localBackupPath, remoteSqlKey, {
    sha256: localSha256,
    sizeBytes: stat.size,
    tablesCount: manifestData.tablesCount || null,
    totalRows: manifestData.totalRowsExported || null
  });

  // 3. Upload do manifesto JSON (se existir)
  if (fs.existsSync(manifestPath)) {
    console.log(`[OFFSITE-UPLOAD] Enviando manifesto (${remoteManifestKey})...`);
    await provider.upload(manifestPath, remoteManifestKey);
  }

  // 4. Verificação pós-upload
  const exists = await provider.exists(remoteSqlKey);
  if (!exists) {
    console.error('[MONITOR] EVENT=VERIFY_FAILED RemoteKey=' + remoteSqlKey);
    throw new Error(`Falha crítica de verificação: Objeto ${remoteSqlKey} não foi encontrado no storage após o upload.`);
  }

  console.log('[MONITOR] EVENT=VERIFY_SUCCESS RemoteKey=' + remoteSqlKey);

  // 5. Aplicar retenção no storage off-site (manter 7 mais recentes)
  const keepCount = options.keepCount || 7;
  console.log(`[OFFSITE-UPLOAD] Aplicando política de retenção remota (manter ${keepCount})...`);
  const retentionResult = await provider.applyRetention(keepCount);
  console.log(`[MONITOR] EVENT=RETENTION_SUCCESS Retidos=${retentionResult.retainedCount} Podados=${retentionResult.prunedCount}`);

  const duration = Date.now() - startTime;
  console.log('[MONITOR] EVENT=UPLOAD_SUCCESS DurationMs=' + duration + ' RemoteKey=' + remoteSqlKey);

  console.log(`\n================ UPLOAD OFF-SITE CONCLUÍDO ================`);
  console.log(`Provedor:       ${provider.name}`);
  console.log(`Chave Remota:   ${remoteSqlKey}`);
  console.log(`Tamanho:        ${(stat.size / 1024).toFixed(2)} KB`);
  console.log(`SHA-256:        ${localSha256}`);
  console.log(`Duração Upload: ${duration}ms`);
  console.log(`Retenção:       ${retentionResult.retainedCount} mantidos (${retentionResult.prunedCount} podados)`);
  console.log(`===========================================================\n`);

  return {
    success: true,
    provider: provider.name,
    remoteKey: remoteSqlKey,
    sizeBytes: stat.size,
    sha256: localSha256,
    durationMs: duration,
    retention: retentionResult
  };
}

if (require.main === module) {
  runOffsiteUpload().catch(err => {
    console.error('[ERRO CRÍTICO NO UPLOAD OFF-SITE]:', err.message);
    process.exit(1);
  });
}

module.exports = { runOffsiteUpload };
