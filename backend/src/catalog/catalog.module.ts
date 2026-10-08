import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, PrismaService, AuditLogService],
  exports: [CatalogService],
})
export class CatalogModule {}
