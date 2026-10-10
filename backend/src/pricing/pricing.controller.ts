import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import {
  SimulatePricingDto,
  CalculatePricingDto,
  SetManualPriceDto,
  CreatePricingProfileDto,
  UpdatePricingProfileDto,
  CreatePricingChannelRuleDto,
  CreatePricingRuleTierDto,
} from './dto/pricing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ==========================================
  // SIMULAÇÃO & CÁLCULO
  // ==========================================

  @Post('simulate')
  async simulate(@Body() dto: SimulatePricingDto) {
    return this.pricingService.simulate(dto);
  }

  @Post('calculate')
  async calculate(@Body() dto: CalculatePricingDto, @Request() req: any) {
    return this.pricingService.calculateAndPersist(dto, req.user?.id);
  }

  @Post('manual')
  async setManualPrice(@Body() dto: SetManualPriceDto, @Request() req: any) {
    return this.pricingService.setManualPrice(dto, req.user?.id);
  }

  @Delete('manual/:id')
  async removeManualPrice(@Param('id') id: string, @Request() req: any) {
    return this.pricingService.removeManualPrice(id, req.user?.id);
  }

  @Get('effective/:productId/:channelId')
  async getEffectivePrice(
    @Param('productId') productId: string,
    @Param('channelId') channelId: string,
  ) {
    const price = await this.pricingService.getEffectivePrice(
      productId,
      channelId,
    );
    return { productId, channelId, effectivePrice: price };
  }

  // ==========================================
  // PERFIS DE PRECIFICAÇÃO
  // ==========================================

  @Get('profiles')
  async listProfiles() {
    return this.pricingService.listProfiles();
  }

  @Get('profiles/:id')
  async getProfileById(@Param('id') id: string) {
    return this.pricingService.getProfileById(id);
  }

  @Post('profiles')
  async createProfile(
    @Body() dto: CreatePricingProfileDto,
    @Request() req: any,
  ) {
    return this.pricingService.createProfile(dto, req.user?.id);
  }

  @Put('profiles/:id')
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdatePricingProfileDto,
    @Request() req: any,
  ) {
    return this.pricingService.updateProfile(id, dto, req.user?.id);
  }

  // ==========================================
  // REGRAS POR CANAL & FAIXAS
  // ==========================================

  @Post('rules')
  async createChannelRule(
    @Body() dto: CreatePricingChannelRuleDto,
    @Request() req: any,
  ) {
    return this.pricingService.createChannelRule(dto, req.user?.id);
  }

  @Post('tiers')
  async createRuleTier(
    @Body() dto: CreatePricingRuleTierDto,
    @Request() req: any,
  ) {
    return this.pricingService.createRuleTier(dto, req.user?.id);
  }
}
