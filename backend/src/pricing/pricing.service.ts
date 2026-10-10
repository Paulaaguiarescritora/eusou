import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CostResolverService } from './services/cost-resolver.service';
import {
  PricingCalculatorService,
  PricingCalculatorOutput,
} from './calculators/pricing-calculator.service';
import {
  SimulatePricingDto,
  CalculatePricingDto,
  SetManualPriceDto,
  CreatePricingProfileDto,
  UpdatePricingProfileDto,
  CreatePricingChannelRuleDto,
  CreatePricingRuleTierDto,
} from './dto/pricing.dto';

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly costResolver: CostResolverService,
    private readonly calculator: PricingCalculatorService,
  ) {}

  // ============================================================
  // 1. SIMULAÇÃO DE PRECIFICAÇÃO (SEM PERSISTÊNCIA)
  // ============================================================

  async simulate(dto: SimulatePricingDto): Promise<PricingCalculatorOutput> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Produto com ID "${dto.productId}" não encontrado.`,
      );
    }

    const channel = await this.prisma.channel.findUnique({
      where: { id: dto.channelId },
    });
    if (!channel) {
      throw new NotFoundException(
        `Canal com ID "${dto.channelId}" não encontrado.`,
      );
    }

    // Resolve custo via F7 ou manual
    const costRes = await this.costResolver.resolveCost(
      dto.productId,
      dto.variantId,
      dto.costOverride,
    );

    // Resolve perfil de precificação (especificado ou padrão)
    let profile = null;
    if (dto.pricingProfileId) {
      profile = await this.prisma.pricingProfile.findUnique({
        where: { id: dto.pricingProfileId },
        include: { channelRules: { include: { tiers: true } } },
      });
    } else {
      profile = await this.prisma.pricingProfile.findFirst({
        where: { isDefault: true, isActive: true },
        include: { channelRules: { include: { tiers: true } } },
      });
      if (!profile) {
        profile = await this.prisma.pricingProfile.findFirst({
          where: { isActive: true },
          include: { channelRules: { include: { tiers: true } } },
        });
      }
    }

    // Regra específica do canal
    const channelRule = profile?.channelRules?.find(
      (r) => r.channelId === channel.id && r.isActive,
    );

    // Target margin
    const targetMargin =
      dto.marginOverride !== undefined
        ? new Prisma.Decimal(dto.marginOverride.toString())
        : (channelRule?.targetMargin ??
          profile?.defaultTargetMargin ??
          new Prisma.Decimal('0.20'));

    const calculation = this.calculator.calculate({
      cost: costRes.cost,
      packagingCost: profile?.packagingCost ?? new Prisma.Decimal('1.00'),
      taxRate: profile?.taxRate ?? new Prisma.Decimal('0.04'),
      targetMargin,
      commissionPercent:
        channelRule?.commissionPercent ?? new Prisma.Decimal(0),
      fixedCost: channelRule?.fixedCost ?? new Prisma.Decimal(0),
      fixedCostPercent: channelRule?.fixedCostPercent ?? new Prisma.Decimal(0),
      otherPercent: channelRule?.otherPercent ?? new Prisma.Decimal(0),
      otherFixedCost: channelRule?.otherFixedCost ?? new Prisma.Decimal(0),
      orderFixedCost: channelRule?.orderFixedCost ?? new Prisma.Decimal(0),
      paymentFeePercent:
        channelRule?.paymentFeePercent ?? new Prisma.Decimal(0),
      roundingRule: profile?.roundingRule ?? 'ENDS_90',
      tiers: channelRule?.tiers || [],
      mode: 'AUTOMATIC',
    });

    calculation.warnings.push(...costRes.warnings);
    return calculation;
  }

  // ============================================================
  // 2. CÁLCULO E PERSISTÊNCIA EM LOTE / INDIVIDUAL
  // ============================================================

  async calculateAndPersist(
    dto: CalculatePricingDto,
    actorId?: string,
  ): Promise<any[]> {
    const productIds: string[] =
      dto.productIds && dto.productIds.length > 0
        ? dto.productIds
        : dto.productId
          ? [dto.productId]
          : [];

    if (productIds.length === 0) {
      throw new BadRequestException(
        'Informe pelo menos um productId ou productIds.',
      );
    }

    // Canais alvos
    let channels: any[] = [];
    if (dto.channelIds && dto.channelIds.length > 0) {
      channels = await this.prisma.channel.findMany({
        where: { id: { in: dto.channelIds }, isActive: true },
      });
    } else if (dto.channelId) {
      const single = await this.prisma.channel.findUnique({
        where: { id: dto.channelId },
      });
      if (single) channels = [single];
    } else {
      channels = await this.prisma.channel.findMany({
        where: { isActive: true },
      });
    }

    if (channels.length === 0) {
      throw new BadRequestException(
        'Nenhum canal ativo disponível para cálculo.',
      );
    }

    // Perfil selecionado
    let profile = null;
    if (dto.pricingProfileId) {
      profile = await this.prisma.pricingProfile.findUnique({
        where: { id: dto.pricingProfileId },
        include: { channelRules: { include: { tiers: true } } },
      });
    } else {
      profile = await this.prisma.pricingProfile.findFirst({
        where: { isDefault: true, isActive: true },
        include: { channelRules: { include: { tiers: true } } },
      });
      if (!profile) {
        profile = await this.prisma.pricingProfile.findFirst({
          where: { isActive: true },
          include: { channelRules: { include: { tiers: true } } },
        });
      }
    }

    const results = [];

    for (const pid of productIds) {
      for (const ch of channels) {
        const simRes = await this.simulate({
          productId: pid,
          variantId: dto.variantId,
          channelId: ch.id,
          pricingProfileId: profile?.id,
        });

        // Verifica registro existente para preservar modo MANUAL se configurado
        const existing = await this.prisma.productChannelPrice.findFirst({
          where: {
            productId: pid,
            channelId: ch.id,
            variantId: dto.variantId || null,
          },
        });

        const mode = existing?.mode || 'AUTOMATIC';
        const manualPrice = existing?.manualPrice ?? null;
        const effectivePrice =
          mode === 'MANUAL' && manualPrice !== null
            ? manualPrice
            : simRes.calculatedPrice;

        let persisted = null;
        if (existing) {
          persisted = await this.prisma.productChannelPrice.update({
            where: { id: existing.id },
            data: {
              pricingProfileId: profile?.id || null,
              costBasis: simRes.cost,
              calculatedPrice: simRes.calculatedPrice,
              effectivePrice,
              netProfit: simRes.netProfit,
              netMargin: simRes.netMargin,
              appliedRuleTierId: simRes.appliedTierId,
              calculationDetails: simRes.calculationDetails as any,
              lastCalculatedAt: new Date(),
            },
          });
        } else {
          persisted = await this.prisma.productChannelPrice.create({
            data: {
              productId: pid,
              variantId: dto.variantId || null,
              channelId: ch.id,
              pricingProfileId: profile?.id || null,
              mode,
              costBasis: simRes.cost,
              calculatedPrice: simRes.calculatedPrice,
              manualPrice,
              effectivePrice,
              netProfit: simRes.netProfit,
              netMargin: simRes.netMargin,
              appliedRuleTierId: simRes.appliedTierId,
              calculationDetails: simRes.calculationDetails as any,
              lastCalculatedAt: new Date(),
            },
          });
        }

        await this.auditLog.log({
          action: 'PRICE_CALCULATED',
          entity: 'ProductChannelPrice',
          entityId: persisted.id,
          userId: actorId ?? null,
          metadata: {
            productId: pid,
            channelId: ch.id,
            calculatedPrice: simRes.calculatedPrice.toString(),
            effectivePrice: effectivePrice.toString(),
            mode,
          },
        });

        results.push(persisted);
      }
    }

    return results;
  }

  // ============================================================
  // 3. MODO MANUAL / RETORNO AUTOMÁTICO
  // ============================================================

  async setManualPrice(dto: SetManualPriceDto, actorId?: string) {
    const existing = await this.prisma.productChannelPrice.findFirst({
      where: {
        productId: dto.productId,
        channelId: dto.channelId,
        variantId: dto.variantId || null,
      },
    });

    const manualPrice = new Prisma.Decimal(dto.manualPrice.toFixed(2));

    let updated = null;
    if (existing) {
      updated = await this.prisma.productChannelPrice.update({
        where: { id: existing.id },
        data: {
          mode: 'MANUAL',
          manualPrice,
          effectivePrice: manualPrice,
        },
      });
    } else {
      // Se ainda não foi calculado, executa simulação para preencher base
      const sim = await this.simulate({
        productId: dto.productId,
        channelId: dto.channelId,
        variantId: dto.variantId,
      });

      updated = await this.prisma.productChannelPrice.create({
        data: {
          productId: dto.productId,
          variantId: dto.variantId || null,
          channelId: dto.channelId,
          mode: 'MANUAL',
          costBasis: sim.cost,
          calculatedPrice: sim.calculatedPrice,
          manualPrice,
          effectivePrice: manualPrice,
          netProfit: sim.netProfit,
          netMargin: sim.netMargin,
          appliedRuleTierId: sim.appliedTierId,
          calculationDetails: sim.calculationDetails as any,
        },
      });
    }

    await this.auditLog.log({
      action: 'PRICE_MANUAL_SET',
      entity: 'ProductChannelPrice',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: {
        productId: dto.productId,
        channelId: dto.channelId,
        manualPrice: manualPrice.toString(),
      },
    });

    return updated;
  }

  async removeManualPrice(productChannelPriceId: string, actorId?: string) {
    const existing = await this.prisma.productChannelPrice.findUnique({
      where: { id: productChannelPriceId },
    });
    if (!existing) {
      throw new NotFoundException(
        `ProductChannelPrice com ID "${productChannelPriceId}" não encontrado.`,
      );
    }

    const updated = await this.prisma.productChannelPrice.update({
      where: { id: productChannelPriceId },
      data: {
        mode: 'AUTOMATIC',
        manualPrice: null,
        effectivePrice: existing.calculatedPrice,
      },
    });

    await this.auditLog.log({
      action: 'PRICE_MANUAL_REMOVED',
      entity: 'ProductChannelPrice',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: {
        productId: existing.productId,
        channelId: existing.channelId,
        restoredCalculatedPrice: existing.calculatedPrice.toString(),
      },
    });

    return updated;
  }

  // ============================================================
  // 4. FUNÇÃO CONSUMIDORA PARA MARKETPLACES (Reutilizável)
  // ============================================================

  async getEffectivePrice(
    productId: string,
    channelId: string,
    variantId?: string | null,
  ): Promise<Prisma.Decimal | null> {
    const pcp = await this.prisma.productChannelPrice.findFirst({
      where: {
        productId,
        channelId,
        variantId: variantId || null,
      },
    });

    if (pcp) {
      return pcp.effectivePrice;
    }

    // Se não houver persistido, tenta simular
    try {
      const sim = await this.simulate({
        productId,
        channelId,
        variantId: variantId || undefined,
      });
      return sim.effectivePrice;
    } catch {
      return null;
    }
  }

  // ============================================================
  // 5. CRUD PRICING PROFILES
  // ============================================================

  async listProfiles() {
    return this.prisma.pricingProfile.findMany({
      include: {
        channelRules: {
          include: { tiers: true, channel: true },
        },
        _count: { select: { productChannelPrices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listProductPrices(search?: string, channelId?: string) {
    const where: any = {};
    if (channelId) where.channelId = channelId;
    if (search?.trim()) {
      where.product = {
        name: { contains: search.trim(), mode: 'insensitive' },
      };
    }
    return this.prisma.productChannelPrice.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, basePrice: true } },
        variant: { select: { id: true, sku: true, name: true, price: true } },
        channel: { select: { id: true, name: true, type: true } },
        pricingProfile: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async getProfileById(id: string) {
    const profile = await this.prisma.pricingProfile.findUnique({
      where: { id },
      include: {
        channelRules: {
          include: { tiers: true, channel: true },
        },
      },
    });
    if (!profile)
      throw new NotFoundException('Perfil de precificação não encontrado.');
    return profile;
  }

  async createProfile(dto: CreatePricingProfileDto, actorId?: string) {
    if (dto.isDefault) {
      await this.prisma.pricingProfile.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await this.prisma.pricingProfile.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim(),
        description: dto.description?.trim() || null,
        isDefault: dto.isDefault ?? false,
        defaultTargetMargin: dto.defaultTargetMargin ?? 0.2,
        taxRate: dto.taxRate ?? 0.04,
        packagingCost: dto.packagingCost ?? 1.0,
        roundingRule: (dto.roundingRule as any) || 'ENDS_90',
        isActive: true,
      },
    });

    await this.auditLog.log({
      action: 'PRICING_PROFILE_CREATED',
      entity: 'PricingProfile',
      entityId: profile.id,
      userId: actorId ?? null,
      metadata: { name: profile.name, slug: profile.slug },
    });

    return profile;
  }

  async updateProfile(
    id: string,
    dto: UpdatePricingProfileDto,
    actorId?: string,
  ) {
    await this.getProfileById(id);

    if (dto.isDefault) {
      await this.prisma.pricingProfile.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.pricingProfile.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isDefault: dto.isDefault,
        isActive: dto.isActive,
        defaultTargetMargin: dto.defaultTargetMargin,
        taxRate: dto.taxRate,
        packagingCost: dto.packagingCost,
        roundingRule: dto.roundingRule as any,
      },
    });

    await this.auditLog.log({
      action: 'PRICING_PROFILE_UPDATED',
      entity: 'PricingProfile',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { name: updated.name },
    });

    return updated;
  }

  // ============================================================
  // 6. CRUD CHANNEL RULES & TIERS
  // ============================================================

  async createChannelRule(dto: CreatePricingChannelRuleDto, actorId?: string) {
    const rule = await this.prisma.pricingChannelRule.create({
      data: {
        pricingProfileId: dto.pricingProfileId,
        channelId: dto.channelId,
        channelType: dto.channelType as any,
        name: dto.name?.trim() || null,
        targetMargin: dto.targetMargin,
        commissionPercent: dto.commissionPercent ?? 0,
        fixedCost: dto.fixedCost ?? 0,
        fixedCostPercent: dto.fixedCostPercent ?? 0,
        otherPercent: dto.otherPercent ?? 0,
        otherFixedCost: dto.otherFixedCost ?? 0,
        orderFixedCost: dto.orderFixedCost ?? 0,
        paymentFeePercent: dto.paymentFeePercent ?? 0,
        notes: dto.notes?.trim() || null,
        version: 1,
      },
    });

    await this.auditLog.log({
      action: 'PRICING_RULE_CREATED',
      entity: 'PricingChannelRule',
      entityId: rule.id,
      userId: actorId ?? null,
      metadata: {
        pricingProfileId: rule.pricingProfileId,
        channelId: rule.channelId,
      },
    });

    return rule;
  }

  async createRuleTier(dto: CreatePricingRuleTierDto, actorId?: string) {
    const tier = await this.prisma.pricingRuleTier.create({
      data: {
        pricingChannelRuleId: dto.pricingChannelRuleId,
        name: dto.name?.trim() || null,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        commissionPercent: dto.commissionPercent ?? 0,
        fixedCost: dto.fixedCost ?? 0,
        fixedCostPercent: dto.fixedCostPercent ?? 0,
        otherPercent: dto.otherPercent ?? 0,
        otherFixedCost: dto.otherFixedCost ?? 0,
        priority: dto.priority ?? 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    // Incrementa versionamento da regra pai
    await this.prisma.pricingChannelRule.update({
      where: { id: dto.pricingChannelRuleId },
      data: { version: { increment: 1 } },
    });

    await this.auditLog.log({
      action: 'PRICING_RULE_TIER_CREATED',
      entity: 'PricingRuleTier',
      entityId: tier.id,
      userId: actorId ?? null,
      metadata: {
        name: tier.name,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
      },
    });

    return tier;
  }
}
