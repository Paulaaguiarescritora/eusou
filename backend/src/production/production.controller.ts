import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ProductionService,
  CreatePrinterDto,
  UpdatePrinterDto,
  CreateMaterialDto,
  UpdateMaterialDto,
  AdjustMaterialDto,
  CreateProductionProfileDto,
  CreateProductionJobDto,
  CompleteProductionJobDto,
} from './production.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProductionJobStatus } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // ==========================================
  // OPERATIONAL DASHBOARD
  // ==========================================
  @Get('production/dashboard')
  async getOperationalDashboard() {
    return this.productionService.getOperationalDashboard();
  }

  // ==========================================
  // PRINTERS
  // ==========================================
  @Get('printers')
  async getPrinters() {
    return this.productionService.getPrinters();
  }

  @Get('printers/:id')
  async getPrinterById(@Param('id') id: string) {
    return this.productionService.getPrinterById(id);
  }

  @Post('printers')
  async createPrinter(@Body() dto: CreatePrinterDto, @Request() req: any) {
    return this.productionService.createPrinter(dto, req.user?.id);
  }

  @Patch('printers/:id')
  async updatePrinter(
    @Param('id') id: string,
    @Body() dto: UpdatePrinterDto,
    @Request() req: any,
  ) {
    return this.productionService.updatePrinter(id, dto, req.user?.id);
  }

  // ==========================================
  // MATERIALS
  // ==========================================
  @Get('materials')
  async getMaterials() {
    return this.productionService.getMaterials();
  }

  @Get('materials/:id')
  async getMaterialById(@Param('id') id: string) {
    return this.productionService.getMaterialById(id);
  }

  @Post('materials')
  async createMaterial(@Body() dto: CreateMaterialDto, @Request() req: any) {
    return this.productionService.createMaterial(dto, req.user?.id);
  }

  @Patch('materials/:id')
  async updateMaterial(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
    @Request() req: any,
  ) {
    return this.productionService.updateMaterial(id, dto, req.user?.id);
  }

  @Post('materials/:id/adjust')
  async adjustMaterialStock(
    @Param('id') id: string,
    @Body() dto: AdjustMaterialDto,
    @Request() req: any,
  ) {
    return this.productionService.adjustMaterialStock(id, dto, req.user?.id);
  }

  // ==========================================
  // PRODUCTION PROFILES & ESTIMATION
  // ==========================================
  @Get('production/profiles')
  async getProductionProfiles() {
    return this.productionService.getProductionProfiles();
  }

  @Get('production/profiles/:id')
  async getProductionProfileById(@Param('id') id: string) {
    return this.productionService.getProductionProfileById(id);
  }

  @Post('production/profiles')
  async createProductionProfile(
    @Body() dto: CreateProductionProfileDto,
    @Request() req: any,
  ) {
    return this.productionService.createProductionProfile(dto, req.user?.id);
  }

  @Get('production/profiles/:id/estimate')
  async estimateCost(
    @Param('id') id: string,
    @Query('quantity') quantity?: number,
    @Query('printerId') printerId?: string,
  ) {
    return this.productionService.calculateEstimatedCost(
      id,
      quantity ? Number(quantity) : 1,
      printerId,
    );
  }

  // ==========================================
  // PRODUCTION JOBS & QUEUE
  // ==========================================
  @Get('production/jobs')
  async getProductionJobs(
    @Query('status') status?: ProductionJobStatus,
    @Query('printerId') printerId?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productionService.getProductionJobs({
      status,
      printerId,
      productId,
      page,
      limit,
    });
  }

  @Get('production/jobs/:id')
  async getProductionJobById(@Param('id') id: string) {
    return this.productionService.getProductionJobById(id);
  }

  @Post('production/jobs')
  async createProductionJob(
    @Body() dto: CreateProductionJobDto,
    @Request() req: any,
  ) {
    return this.productionService.createProductionJob(dto, req.user?.id);
  }

  @Post('production/jobs/:id/start')
  async startJob(@Param('id') id: string, @Request() req: any) {
    return this.productionService.startJob(id, req.user?.id);
  }

  @Post('production/jobs/:id/pause')
  async pauseJob(@Param('id') id: string, @Request() req: any) {
    return this.productionService.pauseJob(id, req.user?.id);
  }

  @Post('production/jobs/:id/cancel')
  async cancelJob(
    @Param('id') id: string,
    @Request() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.productionService.cancelJob(id, reason, req.user?.id);
  }

  @Post('production/jobs/:id/complete')
  async completeJob(
    @Param('id') id: string,
    @Body() dto: CompleteProductionJobDto,
    @Request() req: any,
  ) {
    return this.productionService.completeJob(id, dto, req.user?.id);
  }
}
