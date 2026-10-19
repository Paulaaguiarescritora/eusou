import { Module } from '@nestjs/common';
import { VariantController } from './variant.controller';
import { VariantService } from './variant.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProductionModule } from '../production/production.module';

@Module({
  imports: [InventoryModule, PricingModule, ProductionModule],
  controllers: [VariantController],
  providers: [VariantService, PrismaService, AuditLogService],
  exports: [VariantService],
})
export class VariantModule {}
