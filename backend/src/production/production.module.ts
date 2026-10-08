import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [ProductionController],
  providers: [ProductionService, PrismaService, AuditLogService],
  exports: [ProductionService],
})
export class ProductionModule {}
