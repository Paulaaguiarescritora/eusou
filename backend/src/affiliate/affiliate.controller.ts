import * as argon2 from 'argon2';
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
  Res,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import {
  CreateAffiliateDto,
  UpdateAffiliateDto,
  JoinAffiliateDto,
  PublicRegisterAffiliateDto,
} from './dto/affiliate.dto';
import {
  CreateAffiliateLinkDto,
  UpdateAffiliateLinkDto,
} from './dto/affiliate-link.dto';
import { CreateCommissionRuleDto } from './dto/commission-rule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma.service';
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
@Controller('affiliate')
export class AffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('join')
  async joinAffiliate(@Body() dto: JoinAffiliateDto, @Req() req: any) {
    const userId = req.user.sub;
    const affiliate = await this.affiliateService.create(
      {
        userId,
        displayName: dto.displayName,
        code: dto.code,
        cpf: dto.cpf,
        whatsapp: dto.whatsapp,
        pixKey: dto.pixKey,
        defaultCommissionPercent: 10.0,
      },
      userId,
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const { accessToken } = await this.authService.login(user);

    return { affiliate, accessToken };
  }

  @Get('me')
  async getMe(@Req() req: any) {
    return this.prisma.affiliate.findUnique({
      where: { userId: req.user.sub },
      include: {
        links: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  @Patch('me')
  @Roles('affiliate', 'admin')
  async updateMe(@Body() dto: UpdateAffiliateDto, @Req() req: any) {
    const userId = req.user.sub;
    const affiliate = await this.affiliateService.findByUserId(userId);

    let userChanged = false;
    if (dto.email && dto.email.trim()) {
      const cleanEmail = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Este e-mail já está em uso por outra conta.');
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { email: cleanEmail },
      });
      userChanged = true;
    }

    if (dto.password && dto.password.trim()) {
      if (dto.password.length < 6) {
        throw new BadRequestException('A senha deve ter no mínimo 6 caracteres.');
      }
      const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      userChanged = true;
    }

    const safeDto: UpdateAffiliateDto = {
      displayName: dto.displayName,
      cpf: dto.cpf,
      whatsapp: dto.whatsapp,
      pixKey: dto.pixKey,
      themeConfig: dto.themeConfig,
    };
    const updated = await this.affiliateService.update(affiliate.id, safeDto, userId);

    const fullAffiliate = await this.prisma.affiliate.findUnique({
      where: { id: updated.id },
      include: {
        links: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    let accessToken = undefined;
    if (userChanged) {
      const freshUser = await this.prisma.user.findUnique({ where: { id: userId } });
      const loginRes = await this.authService.login(freshUser);
      accessToken = loginRes.accessToken;
    }

    return {
      affiliate: fullAffiliate,
      accessToken,
    };
  }

  @Get('dashboard')
  @Roles('affiliate', 'admin')
  async getDashboard(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.getAffiliateDashboard(affiliate.id);
  }

  @Get('links')
  @Roles('affiliate', 'admin')
  async getLinks(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.findLinksByAffiliate(affiliate.id);
  }

  @Post('links')
  @Roles('affiliate', 'admin')
  async createLink(@Body() dto: CreateAffiliateLinkDto, @Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.createLink(affiliate.id, dto);
  }

  @Patch('links/:id')
  @Roles('affiliate', 'admin')
  async updateLink(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateLinkDto,
    @Req() req: any,
  ) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.updateLink(id, affiliate.id, dto);
  }

  @Delete('links/:id')
  @Roles('affiliate', 'admin')
  async disableLink(@Param('id') id: string, @Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.disableLink(id, affiliate.id);
  }

  @Get('conversions')
  @Roles('affiliate', 'admin')
  async getConversions(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.getAffiliateConversions(affiliate.id);
  }

  @Get('catalog-products')
  @Roles('affiliate', 'admin')
  async getCatalogProducts(@Query('search') search?: string) {
    return this.affiliateService.getCatalogProducts(search);
  }

  @Get('categories')
  @Roles('affiliate', 'admin')
  async getCategories() {
    return this.affiliateService.getCategoriesTree();
  }

  @Get('collections')
  @Roles('affiliate', 'admin')
  async getCollections(@Req() req: any) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.getAffiliateCollections(affiliate.id);
  }

  @Post('collections')
  @Roles('affiliate', 'admin')
  async createCollection(
    @Body() dto: { name: string; description?: string; productIds?: string[] },
    @Req() req: any,
  ) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.createAffiliateCollection(affiliate.id, dto);
  }

  @Patch('collections/:id')
  @Roles('affiliate', 'admin')
  async updateCollection(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; productIds?: string[] },
    @Req() req: any,
  ) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.updateAffiliateCollection(affiliate.id, id, dto);
  }

  @Delete('collections/:id')
  @Roles('affiliate', 'admin')
  async deleteCollection(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const affiliate = await this.affiliateService.findByUserId(req.user.sub);
    return this.affiliateService.deleteAffiliateCollection(affiliate.id, id);
  }
}

// ==========================================
// PUBLIC TRACKING & REGISTRATION CONTROLLER
// ==========================================

@Controller('public/affiliate')
export class PublicAffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly authService: AuthService,
  ) {}

  @Get('catalog/:code')
  async getAffiliateCatalog(@Param('code') code: string) {
    return this.affiliateService.getPublicAffiliateCatalog(code);
  }

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

  @Post('register')
  async registerAffiliate(
    @Body() dto: PublicRegisterAffiliateDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const user = await this.authService.register(dto.email, dto.password);
    const affiliate = await this.affiliateService.create(
      {
        userId: user.id,
        displayName: dto.displayName,
        code: dto.code,
        cpf: dto.cpf,
        whatsapp: dto.whatsapp,
        pixKey: dto.pixKey,
        defaultCommissionPercent: 10.0,
      },
      user.id,
    );

    const { accessToken, refreshToken } = await this.authService.login(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });

    return { affiliate, accessToken };
  }
}
