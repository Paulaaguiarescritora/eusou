import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, PrismaService, AuditLogService],
  exports: [InventoryService],
})
export class InventoryModule {}
