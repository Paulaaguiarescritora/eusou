import { Module } from '@nestjs/common';
import { VariantController } from './variant.controller';
import { VariantService } from './variant.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [VariantController],
  providers: [VariantService, PrismaService, AuditLogService],
  exports: [VariantService],
})
export class VariantModule {}
