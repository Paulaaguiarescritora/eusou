import { Module } from '@nestjs/common';
import { ProductAttributeController } from './product-attribute.controller';
import { ProductAttributeService } from './product-attribute.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [ProductAttributeController],
  providers: [ProductAttributeService, PrismaService, AuditLogService],
  exports: [ProductAttributeService],
})
export class ProductAttributeModule {}
