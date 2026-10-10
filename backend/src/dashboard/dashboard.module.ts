import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CommercialAlertService } from './commercial-alert.service';
import { DashboardController, LegacyDashboardController } from './dashboard.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DashboardController, LegacyDashboardController],
  providers: [DashboardService, CommercialAlertService, PrismaService],
  exports: [DashboardService, CommercialAlertService],
})
export class DashboardModule {}
