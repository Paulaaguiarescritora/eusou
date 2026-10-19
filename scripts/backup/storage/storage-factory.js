/**
 * EuSou - Factory de Provedores de Armazenamento Off-Site
 * F17-A.1-R: Disaster Recovery & Backup Strategy
 *
 * Exclusivamente orientado a storage externo real (Cloudflare R2 ou AWS S3).
 * Rejeita explicitamente qualquer armazenamento no mesmo computador.
 */

const { S3StorageProvider } = require('./s3-storage.provider');

function getStorageProvider(customConfig = {}) {
  const type = (customConfig.type || process.env.BACKUP_STORAGE_TYPE || 's3').toLowerCase();

  if (type === 's3' || type === 'r2') {
    return new S3StorageProvider({
      bucket: customConfig.bucket || process.env.S3_BUCKET,
      region: customConfig.region || process.env.S3_REGION || 'auto',
      endpoint: customConfig.endpoint || process.env.S3_ENDPOINT,
      accessKeyId: customConfig.accessKeyId || process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: customConfig.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY
    });
  }

  throw new Error(
    'Configuração inválida de storage off-site: BACKUP_STORAGE_TYPE deve ser "s3" ou "r2". ' +
    'Armazenamento em filesystem local (%LOCALAPPDATA%, C:\\, D:\\, rede local) é estritamente proibido para fins de Disaster Recovery.'
  );
}

module.exports = { getStorageProvider };
