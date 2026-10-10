import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { CreateAffiliateDto, UpdateAffiliateDto } from './dto/affiliate.dto';
import {
  CreateAffiliateLinkDto,
  UpdateAffiliateLinkDto,
} from './dto/affiliate-link.dto';
import { CreateCommissionRuleDto } from './dto/commission-rule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AffiliateStatus } from '@prisma/client';

// ==========================================
// ADMIN CONTROLLER
// ==========================================

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/affiliates')
export class AdminAffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post()
  create(@Body() dto: CreateAffiliateDto, @Req() req: any) {
    return this.affiliateService.create(dto, req.user?.sub);
  }

  @Get('eligible-users')
  findEligibleUsers(@Query('search') search?: string) {
    return this.affiliateService.findEligibleUsers(search);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: AffiliateStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.affiliateService.findAll({ search, status, page, limit });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.affiliateService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateDto,
    @Req() req: any,
  ) {
    return this.affiliateService.update(id, dto, req.user?.sub);
  }

  // Commission Rules Management
  @Post('commission-rules')
  createCommissionRule(@Body() dto: CreateCommissionRuleDto, @Req() req: any) {
    return this.affiliateService.createCommissionRule(dto, req.user?.sub);
  }

  @Get('commission-rules/all')
  findAllCommissionRules() {
    return this.affiliateService.findAllCommissionRules();
  }
}

// ==========================================
// AFFILIATE SELF-SERVICE CONTROLLER
// ==========================================

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('affiliate', 'admin')
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    return this.affiliateService.findByUserId(req.user.sub);
  }

  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.getAffiliateDashboard(affiliate.id);
  }

  @Get('links')
  async getLinks(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.findLinksByAffiliate(affiliate.id);
  }

  @Post('links')
  async createLink(@Body() dto: CreateAffiliateLinkDto, @Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.createLink(affiliate.id, dto);
  }

  @Patch('links/:id')
  async updateLink(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateLinkDto,
    @Req() req: any,
  ) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.updateLink(id, affiliate.id, dto);
  }

  @Delete('links/:id')
  async disableLink(@Param('id') id: string, @Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.disableLink(id, affiliate.id);
  }

  @Get('conversions')
  async getConversions(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.getAffiliateConversions(affiliate.id);
  }

  @Get('collections')
  async getCollections(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.getAffiliateCollections(affiliate.id);
  }

  @Post('collections')
  async createCollection(
    @Body() dto: { name: string; description?: string },
    @Req() req: any,
  ) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.createAffiliateCollection(affiliate.id, dto);
  }
}

// ==========================================
// PUBLIC TRACKING CONTROLLER
// ==========================================

@Controller('public/affiliate')
export class PublicAffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post('click')
  async recordClick(
    @Body() body: { refCode: string; productId?: string; sessionId?: string },
  ) {
    return this.affiliateService.recordClick(
      body.refCode,
      body.productId,
      body.sessionId,
    );
  }
}
