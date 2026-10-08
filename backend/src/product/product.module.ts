import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService, PrismaService, AuditLogService],
  exports: [ProductService],
})
export class ProductModule {}
