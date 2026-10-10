import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CommercialAlertService } from './commercial-alert.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly alertService: CommercialAlertService,
  ) {}

  /**
   * Resumo Operacional Consolidado da Central Comercial (F14)
   * Suporta filtros de período: ?period=today | 7d | 30d | 90d ou ?startDate=...&endDate=...
   */
  @Get('summary')
  getCommercialSummary(
    @Query('period') period?: 'today' | '7d' | '30d' | '90d',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getCommercialSummary({
      period,
      startDate,
      endDate,
    });
  }

  /**
   * Alertas Operacionais Derivados e Ordenados por Severidade
   */
  @Get('alerts')
  getAlerts() {
    return this.alertService.getAlerts();
  }

  /**
   * Estado de Saúde Geral da Operação
   */
  @Get('health')
  getOperationHealth() {
    return this.alertService.getOperationHealth();
  }
}

/**
 * Controller mantido para rota legada /dashboard/summary
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('dashboard')
export class LegacyDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(
    @Query('period') period?: 'today' | '7d' | '30d' | '90d',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getCommercialSummary({
      period,
      startDate,
      endDate,
    });
  }
}
