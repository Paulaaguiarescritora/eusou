/**
 * EuSou - Pipeline Automatizado de Backup (Local + Off-Site + Retenção + Lock)
 * F17-A.1: Disaster Recovery & Backup Strategy
 *
 * Ponto de entrada para automação periódica (Cron / CI/CD) e disparo manual unificado.
 */

const path = require('path');
const { ConcurrencyLock } = require('./concurrency-lock');
const { runBackup } = require('./backup');
const { runOffsiteUpload } = require('./offsite-upload');

async function runBackupPipeline(options = {}) {
  const startTime = Date.now();
  console.log('[MONITOR] EVENT=PIPELINE_STARTED Timestamp=' + new Date().toISOString());

  // 1. Tentar obter Lock de concorrência
  const lockResult = ConcurrencyLock.acquire('FULL_BACKUP_PIPELINE');
  if (!lockResult.acquired) {
    console.warn('[MONITOR] EVENT=LOCK_BLOCKED Motivo=ExecucaoEmAndamento');
    return {
      success: false,
      status: 'BLOCKED_BY_CONCURRENCY',
      message: 'Execução bloqueada: já existe um processo de backup em andamento.'
    };
  }

  console.log('[MONITOR] EVENT=LOCK_ACQUIRED Pid=' + process.pid);

  try {
    // 2. Executar Backup Lógico Local
    console.log('[MONITOR] EVENT=BACKUP_STARTED');
    const backupManifest = await runBackup();
    console.log('[MONITOR] EVENT=BACKUP_SUCCESS File=' + backupManifest.filename + ' Rows=' + backupManifest.totalRowsExported);

    // 3. Executar Upload Off-Site com Retenção
    console.log('[MONITOR] EVENT=UPLOAD_STARTED');
    let uploadResult = null;
    try {
      uploadResult = await runOffsiteUpload({
        localBackupPath: path.resolve(__dirname, '../../backups', backupManifest.filename),
        keepCount: options.keepCount || 7,
        storageConfig: options.storageConfig || {}
      });
    } catch (uploadErr) {
      const allowSkip = process.env.ALLOW_SKIP_OFFSITE_IF_UNCONFIGURED === 'true' || options.allowSkipOffsite;
      if (uploadErr.message.includes('S3StorageProvider não configurado') && allowSkip) {
        console.warn('\n[AVISO MONITOR] EVENT=UPLOAD_SKIPPED Motivo=CredenciaisS3NaoConfiguradas');
        console.warn('[INFO] O backup lógico foi gerado com sucesso. O upload para o cofre remoto (S3/R2) foi ignorado por ausência de credenciais (S3_ACCESS_KEY_ID ou S3_BUCKET).');
        console.warn('[INFO] Para ativar o armazenamento off-site em nuvem, adicione os secrets S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY no GitHub.\n');
        uploadResult = {
          skipped: true,
          reason: uploadErr.message
        };
      } else {
        throw uploadErr;
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log('[MONITOR] EVENT=PIPELINE_SUCCESS TotalDurationMs=' + totalDuration);

    return {
      success: true,
      backup: backupManifest,
      upload: uploadResult,
      totalDurationMs: totalDuration
    };
  } catch (err) {
    console.error('[MONITOR] EVENT=PIPELINE_FAILED Error=' + err.message);
    throw err;
  } finally {
    ConcurrencyLock.release();
    console.log('[MONITOR] EVENT=LOCK_RELEASED');
  }
}

if (require.main === module) {
  runBackupPipeline()
    .then((res) => {
      if (!res.success && res.status === 'BLOCKED_BY_CONCURRENCY') {
        process.exit(2);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[ERRO FATAL NO PIPELINE DE BACKUP]:', err.message);
      process.exit(1);
    });
}

module.exports = { runBackupPipeline };
