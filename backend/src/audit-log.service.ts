import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface AuditLogEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  userId?: string | null;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeMetadata(
    data?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!data) return undefined;
    const sensitivePattern =
      /(password|token|secret|cookie|hash|auth|credential)/i;
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!sensitivePattern.test(key)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          sanitized[key] = this.sanitizeMetadata(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }

  async log(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        userId: entry.userId ?? null,
        metadata: this.sanitizeMetadata(entry.metadata),
      },
    });
  }
}
