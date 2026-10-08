import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CredentialEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawKey =
      this.config.get<string>('MERCADOLIVRE_ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'fallback-secret-key-32-chars-long!!';
    // Deriva uma chave exata de 32 bytes usando SHA-256
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Criptografa dados sensíveis (tokens OAuth, refresh tokens, etc.)
   */
  encrypt(text: string): { iv: string; encryptedData: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      tag: tag.toString('hex'),
    };
  }

  /**
   * Descriptografa dados com validação de integridade por tag de autenticação
   */
  decrypt(encrypted: {
    iv: string;
    encryptedData: string;
    tag: string;
  }): string {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const tag = Buffer.from(encrypted.tag, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
