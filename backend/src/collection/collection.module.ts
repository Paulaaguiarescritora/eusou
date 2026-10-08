import { Module } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [CollectionController],
  providers: [CollectionService, PrismaService, AuditLogService],
  exports: [CollectionService],
})
export class CollectionModule {}
