import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, PrismaService, AuditLogService],
  exports: [MediaService],
})
export class MediaModule {}
