import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateAffiliateDto, UpdateAffiliateDto } from './dto/affiliate.dto';
import {
  CreateAffiliateLinkDto,
  UpdateAffiliateLinkDto,
} from './dto/affiliate-link.dto';
import { CreateCommissionRuleDto } from './dto/commission-rule.dto';
import { Affiliate, AffiliateStatus, ConversionStatus } from '@prisma/client';

@Injectable()
export class AffiliateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // --- ADMIN AFFILIATE CRUD ---

  async create(dto: CreateAffiliateDto, actorId?: string): Promise<Affiliate> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { affiliate: true, roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException(`User "${dto.userId}" not found`);
    if (user.affiliate)
      throw new ConflictException('User already has an affiliate profile');

    const cleanCode = dto.code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) throw new BadRequestException('Invalid affiliate code');

    const existingCode = await this.prisma.affiliate.findUnique({
      where: { code: cleanCode },
    });
    if (existingCode)
      throw new ConflictException(`Code "${cleanCode}" is already taken`);

    // Ensure role AFFILIATE exists and assign to user if not present
    let affiliateRole = await this.prisma.role.findUnique({
      where: { name: 'AFFILIATE' },
    });
    if (!affiliateRole) {
      affiliateRole = await this.prisma.role.create({
        data: { name: 'AFFILIATE', description: 'Affiliate partner' },
      });
    }

    const hasRole = user.roles.some((r) => r.role.name === 'AFFILIATE');
    if (!hasRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: affiliateRole.id },
      });
    }

    const affiliate = await this.prisma.affiliate.create({
      data: {
        userId: dto.userId,
        code: cleanCode,
        displayName: dto.displayName.trim(),
        cpf: dto.cpf?.trim() || null,
        whatsapp: dto.whatsapp?.trim() || null,
        pixKey: dto.pixKey?.trim() || null,
        status: dto.status || AffiliateStatus.ACTIVE,
        defaultCommissionPercent:
          dto.defaultCommissionPercent !== undefined
            ? dto.defaultCommissionPercent
            : 10.00,
      },
    });

    // Automatically create default general referral link (/r/CODE)
    await this.prisma.affiliateLink.create({
      data: {
        affiliateId: affiliate.id,
        code: cleanCode,
        destination: `/?ref=${cleanCode}`,
      },
    });

    await this.auditLog.log({
      action: 'AFFILIATE_CREATED',
      entity: 'Affiliate',
      entityId: affiliate.id,
      userId: actorId ?? null,
      metadata: { code: affiliate.code, displayName: affiliate.displayName },
    });

    return affiliate;
  }

  async findAll(query: {
    search?: string;
    status?: AffiliateStatus;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search?.trim()) {
      where.OR = [
        { displayName: { contains: query.search.trim(), mode: 'insensitive' } },
        {
          code: {
            contains: query.search.trim().toUpperCase(),
            mode: 'insensitive',
          },
        },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.affiliate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
          _count: { select: { links: true, clicks: true, conversions: true } },
        },
      }),
      this.prisma.affiliate.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findById(id: string): Promise<Affiliate> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        links: true,
        _count: {
          select: { clicks: true, conversions: true, ownedCollections: true },
        },
      },
    });
    if (!affiliate) throw new NotFoundException(`Affiliate "${id}" not found`);
    return affiliate;
  }

  async findByUserId(userId: string): Promise<Affiliate> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
      include: {
        links: true,
      },
    });
    if (!affiliate)
      throw new NotFoundException(
        'Affiliate profile not found for current user',
      );
    return affiliate;
  }

  async findEligibleUsers(search?: string) {
    const where: any = {
      isActive: true,
      affiliate: null,
    };
    if (search?.trim()) {
      where.email = { contains: search.trim().toLowerCase(), mode: 'insensitive' };
    }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        isActive: true,
      },
      take: 20,
      orderBy: { email: 'asc' },
    });
  }

  async update(
    id: string,
    dto: UpdateAffiliateDto,
    actorId?: string,
  ): Promise<Affiliate> {
    const affiliate = await this.findById(id);

    const updateData: any = {};
    if (dto.displayName !== undefined)
      updateData.displayName = dto.displayName.trim();
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.defaultCommissionPercent !== undefined)
      updateData.defaultCommissionPercent = dto.defaultCommissionPercent;
    if (dto.cpf !== undefined) updateData.cpf = dto.cpf;
    if (dto.whatsapp !== undefined) updateData.whatsapp = dto.whatsapp;
    if (dto.pixKey !== undefined) updateData.pixKey = dto.pixKey;
    if (dto.themeConfig !== undefined) updateData.themeConfig = dto.themeConfig;

    if (dto.code !== undefined) {
      const cleanCode = dto.code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
      if (cleanCode !== affiliate.code) {
        const existing = await this.prisma.affiliate.findUnique({
          where: { code: cleanCode },
        });
        if (existing)
          throw new ConflictException(`Code "${cleanCode}" is already taken`);
        updateData.code = cleanCode;
      }
    }

    const updated = await this.prisma.affiliate.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'AFFILIATE_UPDATED',
      entity: 'Affiliate',
      entityId: id,
      userId: actorId ?? null,
      metadata: { fields: Object.keys(updateData) },
    });

    return updated;
  }

  // --- AFFILIATE LINKS ---

  async createLink(
    affiliateId: string,
    dto: CreateAffiliateLinkDto,
  ): Promise<any> {
    const affiliate = await this.findById(affiliateId);
    if (affiliate.status !== AffiliateStatus.ACTIVE) {
      throw new BadRequestException(
        'Inactive or suspended affiliates cannot create links',
      );
    }

    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    const linkCode = dto.code
      ? `${affiliate.code}-${dto.code.trim().toUpperCase()}`
      : `${affiliate.code}-${randomSuffix}`;

    const link = await this.prisma.affiliateLink.create({
      data: {
        affiliateId,
        code: linkCode,
        destination: dto.destination,
        productId: dto.productId || null,
        catalogId: dto.catalogId || null,
        collectionId: dto.collectionId || null,
      },
    });

    await this.auditLog.log({
      action: 'AFFILIATE_LINK_CREATED',
      entity: 'AffiliateLink',
      entityId: link.id,
      metadata: { code: link.code, affiliateId },
    });

    return link;
  }

  async findLinksByAffiliate(affiliateId: string) {
    const links = await this.prisma.affiliateLink.findMany({
      where: { affiliateId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        catalog: { select: { id: true, name: true, slug: true } },
        collection: { select: { id: true, name: true, slug: true } },
        _count: { select: { clicks: true, conversions: true } },
      },
    });

    return links.map((l) => ({
      ...l,
      targetUrl: l.destination,
      clicksCount: l._count?.clicks || 0,
      conversionsCount: l._count?.conversions || 0,
    }));
  }

  async updateLink(
    id: string,
    affiliateId: string,
    dto: UpdateAffiliateLinkDto,
  ) {
    const link = await this.prisma.affiliateLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    if (link.affiliateId !== affiliateId)
      throw new ForbiddenException('Access denied');

    return this.prisma.affiliateLink.update({
      where: { id },
      data: dto,
    });
  }

  async disableLink(id: string, affiliateId: string) {
    const link = await this.prisma.affiliateLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    if (link.affiliateId !== affiliateId)
      throw new ForbiddenException('Access denied');

    return this.prisma.affiliateLink.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // --- CLICK TRACKING ---

  async recordClick(
    codeOrAffiliateCode: string,
    productId?: string,
    sessionId?: string,
  ) {
    const cleanCode = codeOrAffiliateCode.trim().toUpperCase();

    // 1. Try match by affiliate link code
    const link = await this.prisma.affiliateLink.findUnique({
      where: { code: cleanCode },
      include: { affiliate: true },
    });

    if (link) {
      if (link.isActive && link.affiliate.status === AffiliateStatus.ACTIVE) {
        return this.prisma.affiliateClick.create({
          data: {
            affiliateId: link.affiliateId,
            affiliateLinkId: link.id,
            productId: productId || link.productId || null,
            sessionId: sessionId || null,
          },
        });
      }
      return null;
    }

    // 2. Try match by affiliate's base code
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { code: cleanCode },
    });

    if (affiliate && affiliate.status === AffiliateStatus.ACTIVE) {
      return this.prisma.affiliateClick.create({
        data: {
          affiliateId: affiliate.id,
          productId: productId || null,
          sessionId: sessionId || null,
        },
      });
    }

    return null;
  }

  // --- COMMISSION RULES & PRIORITY CALCULATION ---

  async createCommissionRule(dto: CreateCommissionRuleDto, actorId?: string) {
    // Calculate default priority based on specificity hierarchy:
    // Product + Affiliate = 50
    // Category/Niche + Affiliate = 40
    // Product global = 30
    // Affiliate global = 20
    // Global fallback = 10
    let priority = dto.priority;
    if (priority === undefined) {
      if (dto.affiliateId && dto.productId) priority = 50;
      else if (dto.affiliateId && (dto.categoryId || dto.nicheId))
        priority = 40;
      else if (dto.productId) priority = 30;
      else if (dto.affiliateId) priority = 20;
      else priority = 10;
    }

    const rule = await this.prisma.commissionRule.create({
      data: {
        affiliateId: dto.affiliateId || null,
        productId: dto.productId || null,
        categoryId: dto.categoryId || null,
        nicheId: dto.nicheId || null,
        percentage: dto.percentage,
        fixedAmount: dto.fixedAmount || null,
        priority,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.auditLog.log({
      action: 'COMMISSION_RULE_CREATED',
      entity: 'CommissionRule',
      entityId: rule.id,
      userId: actorId ?? null,
    });

    return rule;
  }

  async findAllCommissionRules() {
    return this.prisma.commissionRule.findMany({
      orderBy: { priority: 'desc' },
      include: {
        affiliate: { select: { id: true, code: true, displayName: true } },
        product: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        niche: { select: { id: true, name: true } },
      },
    });
  }

  async calculateCommission(
    affiliateId: string,
    orderTotalEligible: number,
    orderProductIds: string[] = [],
  ): Promise<{ commissionAmount: number; appliedCommissionPercent: number | null }> {
    // 1. REGRA SOBERANA: O percentual configurado diretamente no perfil do afiliado é soberano.
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { defaultCommissionPercent: true },
    });

    if (
      affiliate &&
      affiliate.defaultCommissionPercent !== null &&
      affiliate.defaultCommissionPercent !== undefined
    ) {
      const percent = Number(affiliate.defaultCommissionPercent);
      const commissionAmount = (orderTotalEligible * percent) / 100;
      return {
        commissionAmount,
        appliedCommissionPercent: percent,
      };
    }

    // 2. FALLBACK COMPATIBILIDADE: Se o afiliado não possuir defaultCommissionPercent configurado, consulta regras legadas
    const rules = await this.prisma.commissionRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    // 2.1. Affiliate + Product
    for (const rule of rules) {
      if (
        rule.affiliateId === affiliateId &&
        rule.productId &&
        orderProductIds.includes(rule.productId)
      ) {
        const percent = Number(rule.percentage);
        const fixed = Number(rule.fixedAmount) || 0;
        return {
          commissionAmount: (orderTotalEligible * percent) / 100 + fixed,
          appliedCommissionPercent: percent,
        };
      }
    }

    // 2.2. Affiliate specific rule
    for (const rule of rules) {
      if (
        rule.affiliateId === affiliateId &&
        !rule.productId &&
        !rule.categoryId &&
        !rule.nicheId
      ) {
        const percent = Number(rule.percentage);
        const fixed = Number(rule.fixedAmount) || 0;
        return {
          commissionAmount: (orderTotalEligible * percent) / 100 + fixed,
          appliedCommissionPercent: percent,
        };
      }
    }

    // 2.3. Product global rule
    for (const rule of rules) {
      if (
        !rule.affiliateId &&
        rule.productId &&
        orderProductIds.includes(rule.productId)
      ) {
        const percent = Number(rule.percentage);
        const fixed = Number(rule.fixedAmount) || 0;
        return {
          commissionAmount: (orderTotalEligible * percent) / 100 + fixed,
          appliedCommissionPercent: percent,
        };
      }
    }

    // 2.4. Global default rule
    const globalRule = rules.find(
      (r) => !r.affiliateId && !r.productId && !r.categoryId && !r.nicheId,
    );
    if (globalRule) {
      const percent = Number(globalRule.percentage);
      const fixed = Number(globalRule.fixedAmount) || 0;
      return {
        commissionAmount: (orderTotalEligible * percent) / 100 + fixed,
        appliedCommissionPercent: percent,
      };
    }

    // 2.5. System fallback default (10%)
    return {
      commissionAmount: (orderTotalEligible * 10) / 100,
      appliedCommissionPercent: 10,
    };
  }

  // --- ORDER ATTRIBUTION & CONVERSION ---

  async handleOrderCreated(orderId: string, affiliateCode: string) {
    const cleanCode = affiliateCode.trim().toUpperCase();

    // Find affiliate or link
    let affiliate = await this.prisma.affiliate.findUnique({
      where: { code: cleanCode },
    });
    let linkId: string | null = null;

    if (!affiliate) {
      const link = await this.prisma.affiliateLink.findUnique({
        where: { code: cleanCode },
        include: { affiliate: true },
      });
      if (link) {
        affiliate = link.affiliate;
        linkId = link.id;
      }
    }

    if (!affiliate || affiliate.status !== AffiliateStatus.ACTIVE) {
      return null; // Do not attribute to inactive or non-existent affiliate
    }

    // Check if order already converted (anti-duplicate)
    const existingConversion = await this.prisma.affiliateConversion.findUnique(
      {
        where: { orderId },
      },
    );
    if (existingConversion) {
      return existingConversion;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return null;

    const eligibleAmount = Number(order.subtotal); // products subtotal
    const productIds = order.items.map((i) => i.productId);

    const { commissionAmount, appliedCommissionPercent } =
      await this.calculateCommission(
        affiliate.id,
        eligibleAmount,
        productIds,
      );

    const conversion = await this.prisma.affiliateConversion.create({
      data: {
        affiliateId: affiliate.id,
        affiliateLinkId: linkId,
        orderId: order.id,
        amount: eligibleAmount.toFixed(2),
        commissionAmount: commissionAmount.toFixed(2),
        appliedCommissionPercent:
          appliedCommissionPercent !== null && appliedCommissionPercent !== undefined
            ? appliedCommissionPercent.toFixed(2)
            : null,
        status:
          order.status === 'CONFIRMED'
            ? ConversionStatus.APPROVED
            : ConversionStatus.PENDING,
      },
    });

    await this.auditLog.log({
      action: 'AFFILIATE_CONVERSION_CREATED',
      entity: 'AffiliateConversion',
      entityId: conversion.id,
      metadata: {
        orderId,
        affiliateId: affiliate.id,
        commissionAmount: conversion.commissionAmount.toString(),
        appliedCommissionPercent:
          conversion.appliedCommissionPercent?.toString() || null,
      },
    });

    return conversion;
  }

  async handleOrderStatusChanged(orderId: string, newStatus: string) {
    const conversion = await this.prisma.affiliateConversion.findUnique({
      where: { orderId },
    });
    if (!conversion) return;

    if (newStatus === 'CANCELLED') {
      await this.prisma.affiliateConversion.update({
        where: { id: conversion.id },
        data: { status: ConversionStatus.CANCELLED },
      });
      await this.auditLog.log({
        action: 'AFFILIATE_CONVERSION_CANCELLED',
        entity: 'AffiliateConversion',
        entityId: conversion.id,
      });
    } else if (newStatus === 'CONFIRMED' || newStatus === 'DELIVERED') {
      await this.prisma.affiliateConversion.update({
        where: { id: conversion.id },
        data: { status: ConversionStatus.APPROVED },
      });
      await this.auditLog.log({
        action: 'AFFILIATE_CONVERSION_APPROVED',
        entity: 'AffiliateConversion',
        entityId: conversion.id,
      });
    }
  }

  // --- AFFILIATE COLLECTIONS ---

  async getCategoriesTree() {
    const categories = await this.prisma.category.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: {
        children: {
          where: { status: 'ACTIVE' },
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { products: true },
            },
          },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    const rootCategories = categories.filter((c) => !c.parentId);
    return rootCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productsCount: c._count.products,
      subcategories: c.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        parentId: c.id,
        productsCount: sub._count?.products || 0,
      })),
    }));
  }

  async getCatalogProducts(search?: string) {
    const where: any = {
      status: 'ACTIVE',
    };
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { slug: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const ownStore = await this.prisma.channel.findFirst({
      where: { type: 'OWN_STORE', isActive: true },
    });

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 150,
      include: {
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
        productChannelPrices: ownStore
          ? { where: { channelId: ownStore.id } }
          : true,
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                parentId: true,
                parent: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return products.map((p) => {
      let price = Number(p.basePrice) || 0;
      if (!price && p.productChannelPrices && p.productChannelPrices.length > 0) {
        const cp = p.productChannelPrices[0];
        price = Number(cp.effectivePrice || cp.calculatedPrice || cp.manualPrice) || 0;
      }
      if (!price && p.wholesalePrice) {
        price = Number(p.wholesalePrice) || 0;
      }

      const categoryIds = new Set<string>();
      let categoryLabel = '';
      p.categories.forEach((c) => {
        categoryIds.add(c.categoryId);
        if (c.category?.parentId) {
          categoryIds.add(c.category.parentId);
          if (!categoryLabel && c.category.parent) {
            categoryLabel = `${c.category.parent.name} › ${c.category.name}`;
          }
        } else if (!categoryLabel) {
          categoryLabel = c.category?.name || '';
        }
      });

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price,
        imageUrl: p.media[0]?.url || null,
        categoryIds: Array.from(categoryIds),
        categoryLabel: categoryLabel || 'Geral',
      };
    });
  }

  async createAffiliateCollection(
    affiliateId: string,
    dto: { name: string; description?: string; productIds?: string[] },
  ) {
    const affiliate = await this.findById(affiliateId);
    if (affiliate.status !== AffiliateStatus.ACTIVE) {
      throw new BadRequestException(
        'Inactive affiliate cannot create collections',
      );
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${affiliate.code.toLowerCase()}-${dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randomSuffix}`;

    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        ownerAffiliateId: affiliateId,
        status: 'ACTIVE',
      },
    });

    if (Array.isArray(dto.productIds) && dto.productIds.length > 0) {
      for (let i = 0; i < dto.productIds.length; i++) {
        try {
          await this.prisma.collectionItem.create({
            data: {
              collectionId: collection.id,
              productId: dto.productIds[i],
              position: i,
            },
          });
        } catch {}
      }
    }

    await this.auditLog.log({
      action: 'AFFILIATE_COLLECTION_CREATED',
      entity: 'Collection',
      entityId: collection.id,
      metadata: { affiliateId, productCount: dto.productIds?.length || 0 },
    });

    return this.prisma.collection.findUnique({
      where: { id: collection.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
              },
            },
          },
        },
      },
    });
  }

  async updateAffiliateCollection(
    affiliateId: string,
    collectionId: string,
    dto: { name?: string; description?: string; productIds?: string[] },
  ) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, ownerAffiliateId: affiliateId },
    });
    if (!collection) {
      throw new NotFoundException('Coleção não encontrada.');
    }

    const data: any = {};
    if (dto.name && dto.name.trim()) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;

    if (Object.keys(data).length > 0) {
      await this.prisma.collection.update({
        where: { id: collectionId },
        data,
      });
    }

    if (Array.isArray(dto.productIds)) {
      await this.prisma.collectionItem.deleteMany({
        where: { collectionId },
      });
      for (let i = 0; i < dto.productIds.length; i++) {
        try {
          await this.prisma.collectionItem.create({
            data: {
              collectionId,
              productId: dto.productIds[i],
              position: i,
            },
          });
        } catch {}
      }
    }

    return this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
              },
            },
          },
        },
      },
    });
  }

  async deleteAffiliateCollection(affiliateId: string, collectionId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, ownerAffiliateId: affiliateId },
    });
    if (!collection) {
      throw new NotFoundException('Coleção não encontrada.');
    }
    await this.prisma.collection.delete({
      where: { id: collectionId },
    });
    return { success: true };
  }

  async getAffiliateCollections(affiliateId: string) {
    return this.prisma.collection.findMany({
      where: { ownerAffiliateId: affiliateId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
              },
            },
          },
        },
      },
    });
  }

  // --- DASHBOARD & REPORTS (AFFILIATE SELF-SERVICE) ---

  async getAffiliateDashboard(affiliateId: string) {
    const [clicksCount, conversions] = await Promise.all([
      this.prisma.affiliateClick.count({ where: { affiliateId } }),
      this.prisma.affiliateConversion.findMany({ where: { affiliateId } }),
    ]);

    const totalOrders = conversions.length;
    const totalSales = conversions
      .filter((c) => c.status !== ConversionStatus.CANCELLED)
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const pendingCommission = conversions
      .filter((c) => c.status === ConversionStatus.PENDING)
      .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

    const approvedCommission = conversions
      .filter((c) => c.status === ConversionStatus.APPROVED)
      .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

    const cancelledCommission = conversions
      .filter((c) => c.status === ConversionStatus.CANCELLED)
      .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

    return {
      clicks: clicksCount,
      orders: totalOrders,
      totalSales: totalSales.toFixed(2),
      commissions: {
        pending: pendingCommission.toFixed(2),
        approved: approvedCommission.toFixed(2),
        cancelled: cancelledCommission.toFixed(2),
      },
      conversionRate:
        clicksCount > 0
          ? ((totalOrders / clicksCount) * 100).toFixed(1) + '%'
          : '0%',
    };
  }

  async getAffiliateConversions(affiliateId: string) {
    // Safe projection (respecting privacy: no buyer address, no payment secrets)
    const conversions = await this.prisma.affiliateConversion.findMany({
      where: { affiliateId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            createdAt: true,
            status: true,
          },
        },
      },
    });

    return conversions.map((c) => ({
      id: c.id,
      orderId: c.orderId || c.order?.id || '',
      orderNumber: (c.orderId || c.order?.id || '').slice(0, 8),
      date: c.createdAt,
      createdAt: c.createdAt,
      orderStatus: c.order?.status || 'PENDING',
      conversionStatus: c.status,
      status: c.status,
      amount: c.amount,
      orderAmount: c.amount,
      commissionAmount: c.commissionAmount,
      appliedCommissionPercent: c.appliedCommissionPercent,
    }));
  }

  async getPublicAffiliateCatalog(code: string) {
    const affiliate = await this.prisma.affiliate.findFirst({
      where: {
        code: { equals: code.trim(), mode: 'insensitive' },
        status: AffiliateStatus.ACTIVE,
      },
      include: {
        ownedCollections: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              orderBy: { position: 'asc' },
              include: {
                product: {
                  include: {
                    media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 2 },
                    productChannelPrices: true,
                    categories: { include: { category: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado ou inativo');
    }

    const ownStore = await this.prisma.channel.findFirst({
      where: { type: 'OWN_STORE', isActive: true },
    });

    const allProducts = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      take: 120,
      include: {
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 2 },
        productChannelPrices: ownStore ? { where: { channelId: ownStore.id } } : true,
        categories: { include: { category: true } },
      },
    });

    const formatProd = (p: any) => {
      let price = Number(p.basePrice) || 0;
      if (!price && p.productChannelPrices && p.productChannelPrices.length > 0) {
        const cp = p.productChannelPrices[0];
        price = Number(cp.effectivePrice || cp.calculatedPrice || cp.manualPrice) || 0;
      }
      if (!price && p.wholesalePrice) {
        price = Number(p.wholesalePrice) || 0;
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription || null,
        price,
        imageUrl: p.media[0]?.url || null,
        categoryName: p.categories[0]?.category?.name || 'Geral',
        categorySlug: p.categories[0]?.category?.slug || 'geral',
      };
    };

    return {
      affiliate: {
        id: affiliate.id,
        displayName: affiliate.displayName,
        code: affiliate.code,
        whatsapp: affiliate.whatsapp,
        themeConfig: affiliate.themeConfig || null,
      },
      collections: affiliate.ownedCollections.map((col) => ({
        id: col.id,
        name: col.name,
        slug: col.slug,
        description: col.description,
        products: col.items
          .filter((item) => item.product && item.product.status === 'ACTIVE')
          .map((item) => formatProd(item.product)),
      })),
      products: allProducts.map(formatProd),
    };
  }
}
