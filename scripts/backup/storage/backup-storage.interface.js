/**
 * EuSou - Interface de Provedor de Armazenamento de Backup (Off-Site)
 * F17-A.1: Disaster Recovery & Backup Strategy
 *
 * Define o contrato agnóstico para provedores de storage (S3, R2, GCS, Vault HTTP).
 */

class BackupStorageProvider {
  /**
   * Nome identificador do provedor de storage.
   * @type {string}
   */
  name = 'BASE_STORAGE_PROVIDER';

  /**
   * Faz upload de um arquivo local para o storage off-site.
   * @param {string} localFilePath - Caminho absoluto do arquivo local.
   * @param {string} remoteKey - Chave/nome do objeto no storage remoto.
   * @param {Object} [metadata={}] - Metadados adicionais (ex: sha256, timestamp, tables).
   * @returns {Promise<{ success: boolean, remoteKey: string, sizeBytes: number, sha256: string, uploadedAt: string }>}
   */
  async upload(localFilePath, remoteKey, metadata = {}) {
    throw new Error('Método upload() deve ser implementado pelo provedor de storage.');
  }

  /**
   * Faz download de um objeto do storage remoto para o sistema de arquivos local.
   * @param {string} remoteKey - Chave/nome do objeto no storage remoto.
   * @param {string} localDestinationPath - Caminho onde o arquivo baixado será salvo.
   * @returns {Promise<{ success: boolean, localPath: string, sizeBytes: number, sha256: string }>}
   */
  async download(remoteKey, localDestinationPath) {
    throw new Error('Método download() deve ser implementado pelo provedor de storage.');
  }

  /**
   * Lista objetos armazenados no storage off-site.
   * @param {string} [prefix=''] - Prefixo opcional para filtro.
   * @returns {Promise<Array<{ remoteKey: string, sizeBytes: number, sha256?: string, lastModified: string, metadata?: Object }>>}
   */
  async list(prefix = '') {
    throw new Error('Método list() deve ser implementado pelo provedor de storage.');
  }

  /**
   * Verifica se um objeto existe no storage off-site.
   * @param {string} remoteKey - Chave do objeto.
   * @returns {Promise<boolean>}
   */
  async exists(remoteKey) {
    throw new Error('Método exists() deve ser implementado pelo provedor de storage.');
  }

  /**
   * Deleta um objeto do storage off-site.
   * @param {string} remoteKey - Chave do objeto.
   * @returns {Promise<boolean>}
   */
  async delete(remoteKey) {
    throw new Error('Método delete() deve ser implementado pelo provedor de storage.');
  }

  /**
   * Aplica política de retenção no storage off-site, mantendo os N backups mais recentes.
   * @param {number} [keepCount=7] - Quantidade de backups a manter.
   * @param {string} [prefix=''] - Prefixo opcional.
   * @returns {Promise<{ retainedCount: number, prunedCount: number, prunedKeys: string[] }>}
   */
  async applyRetention(keepCount = 7, prefix = '') {
    throw new Error('Método applyRetention() deve ser implementado pelo provedor de storage.');
  }
}

module.exports = { BackupStorageProvider };
