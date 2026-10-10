import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController, AdminPaymentController } from './payment.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ConfigModule, AffiliateModule, InventoryModule],
  controllers: [PaymentController, AdminPaymentController],
  providers: [PaymentService, PrismaService, AuditLogService],
  exports: [PaymentService],
})
export class PaymentModule {}
