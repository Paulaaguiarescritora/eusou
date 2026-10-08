import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [CategoryController],
  providers: [CategoryService, PrismaService, AuditLogService],
  exports: [CategoryService],
})
export class CategoryModule {}
