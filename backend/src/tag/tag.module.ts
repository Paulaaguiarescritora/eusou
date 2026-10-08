import { Module } from '@nestjs/common';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [TagController],
  providers: [TagService, PrismaService, AuditLogService],
  exports: [TagService],
})
export class TagModule {}
