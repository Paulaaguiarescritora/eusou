import { Module } from '@nestjs/common';
import { AttributeController } from './attribute.controller';
import { AttributeService } from './attribute.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [AttributeController],
  providers: [AttributeService, PrismaService, AuditLogService],
  exports: [AttributeService],
})
export class AttributeModule {}
