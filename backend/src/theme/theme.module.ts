import { Module } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { ThemeController } from './theme.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [ThemeController],
  providers: [ThemeService, PrismaService, AuditLogService],
  exports: [ThemeService],
})
export class ThemeModule {}
