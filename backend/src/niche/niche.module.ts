import { Module } from '@nestjs/common';
import { NicheService } from './niche.service';
import { NicheController } from './niche.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [NicheController],
  providers: [NicheService, PrismaService, AuditLogService],
  exports: [NicheService],
})
export class NicheModule {}
