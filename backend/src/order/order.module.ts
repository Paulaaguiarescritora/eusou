import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController, AdminOrderController, OrderJobController } from './order.controller';
import { OrderExpirationScheduler } from './order-expiration.scheduler';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [AffiliateModule, InventoryModule],
  controllers: [OrderController, AdminOrderController, OrderJobController],
  providers: [OrderService, OrderExpirationScheduler, PrismaService, AuditLogService],
  exports: [OrderService, OrderExpirationScheduler],
})
export class OrderModule {}
