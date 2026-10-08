import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController, AdminOrderController } from './order.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [AffiliateModule, InventoryModule],
  controllers: [OrderController, AdminOrderController],
  providers: [OrderService, PrismaService, AuditLogService],
  exports: [OrderService],
})
export class OrderModule {}
