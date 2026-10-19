/**
 * EuSou - Provedor de Armazenamento S3 Compatível (AWS S3, Cloudflare R2, MinIO, B2)
 * F17-A.1: Disaster Recovery & Backup Strategy
 *
 * Implementa BackupStorageProvider utilizando a especificação S3 REST API (AWS SigV4)
 * nativa em Node.js com crypto sem dependências externas adicionais.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Carrega backend/.env automaticamente caso variáveis não estejam presentes
const envPath = path.resolve(__dirname, '../../../backend/.env');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (e) {
    // Se dotenv não estiver instalado no contexto global, faz fallback simples de parsing de linhas
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const { BackupStorageProvider } = require('./backup-storage.interface');

class S3StorageProvider extends BackupStorageProvider {
  constructor(config = {}) {
    super();
    this.name = 'S3_COMPATIBLE_STORAGE';
    this.bucket = config.bucket || process.env.S3_BUCKET || 'eusou-backups-offsite';
    this.region = config.region || process.env.S3_REGION || 'sa-east-1';
    this.endpoint = (config.endpoint || process.env.S3_ENDPOINT || `https://s3.${this.region}.amazonaws.com`).replace(/\/$/, '');
    this.accessKeyId = config.accessKeyId || process.env.S3_ACCESS_KEY_ID || '';
    this.secretAccessKey = config.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || '';
  }

  isConfigured() {
    return Boolean(this.accessKeyId && this.secretAccessKey && this.bucket);
  }

  // Assinatura AWS Signature Version 4 (SigV4) nativa
  signRequest(method, pathname, queryParams = {}, headers = {}, payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const service = 's3';

    const url = new URL(`${this.endpoint}${pathname}`);
    const host = url.host;

    const baseHeaders = {
      host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...headers
    };

    const sortedHeaderKeys = Object.keys(baseHeaders).map(k => k.toLowerCase()).sort();
    const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${baseHeaders[k]}\n`).join('');
    const signedHeaders = sortedHeaderKeys.join(';');

    const queryString = Object.keys(queryParams).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join('&');

    const canonicalRequest = [
      method,
      pathname,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...baseHeaders,
      Authorization: authHeader
    };
  }

  async upload(localFilePath, remoteKey) {
    if (!this.isConfigured()) {
      throw new Error('S3StorageProvider não configurado (S3_ACCESS_KEY_ID ou S3_BUCKET ausentes no ambiente).');
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const stat = fs.statSync(localFilePath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const pathname = `/${this.bucket}/${remoteKey}`;
    const headers = this.signRequest('PUT', pathname, {}, {
      'content-length': String(stat.size),
      'content-type': 'application/octet-stream',
      'x-amz-meta-sha256': sha256
    }, sha256);

    const res = await fetch(`${this.endpoint}${pathname}`, {
      method: 'PUT',
      headers,
      body: fileBuffer
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Falha no upload S3 (HTTP ${res.status}): ${errText}`);
    }

    return {
      success: true,
      remoteKey,
      bucket: this.bucket,
      sizeBytes: stat.size,
      sha256,
      uploadedAt: new Date().toISOString()
    };
  }

  async download(remoteKey, localDestinationPath) {
    if (!this.isConfigured()) {
      throw new Error('S3StorageProvider não configurado.');
    }

    const pathname = `/${this.bucket}/${remoteKey}`;
    const headers = this.signRequest('GET', pathname, {});

    const res = await fetch(`${this.endpoint}${pathname}`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Falha no download S3 (HTTP ${res.status}): ${errText}`);
    }

    const destDir = path.dirname(localDestinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(localDestinationPath, buffer);

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const stat = fs.statSync(localDestinationPath);

    return {
      success: true,
      localPath: localDestinationPath,
      sizeBytes: stat.size,
      sha256
    };
  }

  async exists(remoteKey) {
    if (!this.isConfigured()) return false;
    const pathname = `/${this.bucket}/${remoteKey}`;
    const headers = this.signRequest('HEAD', pathname, {});

    const res = await fetch(`${this.endpoint}${pathname}`, {
      method: 'HEAD',
      headers
    });

    return res.status === 200;
  }

  async delete(remoteKey) {
    if (!this.isConfigured()) throw new Error('S3StorageProvider não configurado.');
    const pathname = `/${this.bucket}/${remoteKey}`;
    const headers = this.signRequest('DELETE', pathname, {});

    const res = await fetch(`${this.endpoint}${pathname}`, {
      method: 'DELETE',
      headers
    });

    return res.status === 200 || res.status === 204;
  }

  async list(prefix = '') {
    if (!this.isConfigured()) return [];
    const pathname = `/${this.bucket}`;
    const query = prefix ? { prefix } : {};
    const headers = this.signRequest('GET', pathname, query);

    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const res = await fetch(`${this.endpoint}${pathname}${qs}`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      throw new Error(`Falha ao listar objetos no bucket S3 (HTTP ${res.status})`);
    }

    const xml = await res.text();
    // Extrai chaves e tamanhos básicos da resposta XML do S3
    const objects = [];
    const keyMatches = [...xml.matchAll(/<Key>(.*?)<\/Key>/g)];
    const sizeMatches = [...xml.matchAll(/<Size>(.*?)<\/Size>/g)];

    for (let i = 0; i < keyMatches.length; i++) {
      objects.push({
        remoteKey: keyMatches[i][1],
        sizeBytes: sizeMatches[i] ? parseInt(sizeMatches[i][1], 10) : 0,
        lastModified: new Date().toISOString()
      });
    }

    return objects.sort((a, b) => b.remoteKey.localeCompare(a.remoteKey));
  }

  async applyRetention(keepCount = 7, prefix = 'eusou_backup_') {
    const objects = await this.list(prefix);
    const sqlObjects = objects.filter(o => o.remoteKey.endsWith('.sql'));

    if (sqlObjects.length <= keepCount) {
      return { retainedCount: sqlObjects.length, prunedCount: 0, prunedKeys: [] };
    }

    const toPrune = sqlObjects.slice(keepCount);
    const prunedKeys = [];

    for (const obj of toPrune) {
      await this.delete(obj.remoteKey);
      prunedKeys.push(obj.remoteKey);
      const manifestKey = obj.remoteKey.replace(/\.sql$/, '.manifest.json');
      if (await this.exists(manifestKey)) {
        await this.delete(manifestKey);
        prunedKeys.push(manifestKey);
      }
    }

    return { retainedCount: keepCount, prunedCount: toPrune.length, prunedKeys };
  }
}

module.exports = { S3StorageProvider };
