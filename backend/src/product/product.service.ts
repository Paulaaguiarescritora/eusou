import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { PricingService } from '../pricing/pricing.service';
import { CostResolverService, CostResolution } from '../pricing/services/cost-resolver.service';
import { ProductionService } from '../production/production.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { generateSlug } from './utils/slug.util';
import { Product, ProductStatus, Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Optional() private readonly pricingService?: PricingService,
    @Optional() private readonly costResolver?: CostResolverService,
    @Optional() private readonly productionService?: ProductionService,
  ) {}

  async create(dto: CreateProductDto, actorId?: string): Promise<Product> {
    const slug =
      dto.slug && dto.slug.trim().length > 0
        ? generateSlug(dto.slug.trim())
        : generateSlug(dto.name);

    if (!slug) {
      throw new ConflictException(
        'Slug could not be generated from product name',
      );
    }

    const existingSlug = await this.prisma.product.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Product with slug "${slug}" already exists`);
    }

    let normalizedSku: string | null = null;
    if (dto.sku && dto.sku.trim().length > 0) {
      normalizedSku = dto.sku.trim();
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: normalizedSku },
      });
      if (existingSku) {
        throw new ConflictException(
          `Product with SKU "${normalizedSku}" already exists`,
        );
      }
    }

    if (dto.manualCost !== undefined && dto.manualCost !== null) {
      if (Number(dto.manualCost) <= 0) {
        throw new BadRequestException('Custo de produção manual deve ser maior que zero.');
      }
    }

    if (dto.wholesalePrice !== undefined && dto.wholesalePrice !== null) {
      if (Number(dto.wholesalePrice) <= 0) {
        throw new BadRequestException('Preço de atacado deve ser maior que zero.');
      }
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        slug,
        sku: normalizedSku,
        shortDescription: dto.shortDescription?.trim() || null,
        description: dto.description?.trim() || null,
        status: dto.status || ProductStatus.DRAFT,
        brand: dto.brand?.trim() || null,
        basePrice: dto.basePrice !== undefined ? dto.basePrice : null,
        costSource: dto.costSource || 'COST_FROM_F7',
        manualCost: dto.manualCost !== undefined && dto.manualCost !== null ? new Prisma.Decimal(dto.manualCost) : null,
        wholesalePrice: dto.wholesalePrice !== undefined && dto.wholesalePrice !== null ? new Prisma.Decimal(dto.wholesalePrice) : null,
      },
    });

    // P2: Garantir inicialização do Inventory físico central para o produto
    if (this.prisma.inventory) {
      const existingInv = await this.prisma.inventory.findFirst({
        where: {
          productId: product.id,
          variantId: null,
        },
      });
      if (!existingInv) {
        await this.prisma.inventory.create({
          data: {
            productId: product.id,
            variantId: null,
            quantity: 0,
            reservedQuantity: 0,
            minimumQuantity: 5,
          },
        });
      }
    }

    await this.auditLog.log({
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
      userId: actorId ?? null,
      metadata: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        status: product.status,
      },
    });

    // Se o produto foi criado com atacado e custo válidos, recalcula preços F12 dos canais (incluindo Loja Própria)
    try {
      await this.recalculateEnabledChannelPrices(product.id, actorId);
    } catch (err: any) {
      this.logger.warn(`Erro ao recalcular preços F12 na criação: ${err?.message}`);
    }

    return product;
  }

  async findAll(query: QueryProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (query.search && query.search.trim().length > 0) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.nicheId) {
      where.niches = { some: { nicheId: query.nicheId } };
    }

    const catFilter = query.categoryId || query.category;
    if (catFilter) {
      where.categories = {
        some: {
          OR: [
            { categoryId: catFilter },
            { category: { id: catFilter } },
            { category: { slug: catFilter } },
          ],
        },
      };
    }

    if (query.tagId) {
      where.tags = { some: { tagId: query.tagId } };
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          niches: { include: { niche: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
          productChannels: { include: { channel: true } },
          productChannelPrices: { include: { channel: true } },
          productionProfiles: { where: { isActive: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Sincronização em segundo plano não-bloqueante para produtos cuja precificação precise ser atualizada
    const needsRecalc = data.filter((product) => {
      const isManual = product.costSource === 'MANUAL';
      const hasValidCost = isManual
        ? product.manualCost !== null &&
          product.manualCost !== undefined &&
          Number(product.manualCost) > 0
        : Boolean(
            product.productionProfiles && product.productionProfiles.length > 0,
          );
      const hasValidWholesalePrice =
        product.wholesalePrice !== null &&
        product.wholesalePrice !== undefined &&
        Number(product.wholesalePrice) > 0;
      const ownStorePrice = product.productChannelPrices?.find(
        (pcp: any) => pcp.channel?.type === 'OWN_STORE',
      )?.effectivePrice;
      return (
        hasValidCost &&
        hasValidWholesalePrice &&
        (!ownStorePrice || Number(ownStorePrice) <= 0) &&
        product.status !== ProductStatus.ARCHIVED
      );
    });

    if (needsRecalc.length > 0) {
      Promise.allSettled(
        needsRecalc.map((p) =>
          this.recalculateEnabledChannelPrices(p.id).catch(() => {}),
        ),
      );
    }

    const enrichedData = data.map((product: any) => {
      const isManual = product.costSource === 'MANUAL';
      const hasValidCost = isManual
        ? product.manualCost !== null &&
          product.manualCost !== undefined &&
          Number(product.manualCost) > 0
        : Boolean(
            product.productionProfiles && product.productionProfiles.length > 0,
          );
      const hasValidWholesalePrice =
        product.wholesalePrice !== null &&
        product.wholesalePrice !== undefined &&
        Number(product.wholesalePrice) > 0;
      const ownStorePrice = product.productChannelPrices?.find(
        (pcp: any) => pcp.channel?.type === 'OWN_STORE',
      )?.effectivePrice;

      return {
        ...product,
        hasValidCost,
        hasValidWholesalePrice,
        statusCostLabel: !hasValidCost
          ? 'Aguardando custo'
          : !hasValidWholesalePrice
            ? 'Aguardando atacado'
            : ownStorePrice && Number(ownStorePrice) > 0
              ? 'Calculado'
              : 'Não calculado',
      };
    });

    return {
      data: enrichedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getDistinctBrands(): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      select: { brand: true },
      distinct: ['brand'],
    });
    const brandsSet = new Set<string>(['Felinodelia', 'EuSou']);
    for (const p of products) {
      if (p.brand && p.brand.trim()) {
        brandsSet.add(p.brand.trim());
      }
    }
    return Array.from(brandsSet).sort();
  }

  async findById(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        attributeValues: {
          include: { attributeDefinition: true },
        },
        variants: {
          include: {
            inventories: true,
            productionProfiles: {
              where: { isActive: true },
              include: {
                materials: { include: { material: true } },
                printer: true,
              },
            },
            variantAttributeValues: {
              include: {
                productAttributeValue: {
                  include: { attributeDefinition: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        niches: {
          include: { niche: true },
        },
        categories: {
          include: { category: true },
        },
        tags: {
          include: { tag: true },
        },
        productChannels: {
          include: { channel: true },
        },
        productChannelPrices: {
          include: { channel: true },
        },
        productionProfiles: {
          where: { isActive: true, variantId: null },
          include: {
            materials: { include: { material: true } },
          },
        },
        inventories: {
          where: { variantId: null },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    if (product.variants && product.variants.length > 0) {
      const baseProfile = (product as any).productionProfiles?.[0] || null;
      const baseMat =
        baseProfile?.materials?.find(
          (pm: any) =>
            pm.material?.category === 'PRODUCTION' ||
            (!pm.material?.category &&
              ['PLA', 'PETG', 'ABS', 'RESIN'].includes(pm.material?.type)),
        ) || baseProfile?.materials?.[0];

      const enrichedVariants = await Promise.all(
        product.variants.map(async (v: any) => {
          const totalQuantity = (v.inventories || []).reduce(
            (sum: number, inv: any) => sum + (inv.quantity || 0),
            0,
          );
          const totalReserved = (v.inventories || []).reduce(
            (sum: number, inv: any) => sum + (inv.reservedQuantity || 0),
            0,
          );
          const availableStock = Math.max(0, totalQuantity - totalReserved);

          const activeVariantProfile = v.productionProfiles?.find(
            (p: any) => p.isActive,
          );

          let productionCost: number | null = null;
          const targetProfileId = activeVariantProfile?.id || baseProfile?.id;
          if (targetProfileId && this.productionService) {
            try {
              const est = await this.productionService.calculateEstimatedCost(targetProfileId);
              if (est && est.totalCost > 0) {
                productionCost = Number(est.totalCost.toFixed(2));
              }
            } catch {
              // fallback gracefully
            }
          }

          if (productionCost === null && this.costResolver) {
            try {
              const costRes = await this.costResolver.resolveCost(product.id, v.id);
              if (costRes && costRes.source !== 'NONE' && costRes.cost) {
                productionCost = Number(costRes.cost);
              }
            } catch {
              // fallback gracefully
            }
          }

          let materialId: string | null = null;
          let materialName: string | null = null;
          let materialCostPerUnit: number | null = null;
          let isMaterialCustom = false;

          if (activeVariantProfile && activeVariantProfile.materials?.length > 0) {
            const customMat =
              activeVariantProfile.materials.find(
                (pm: any) =>
                  pm.material?.category === 'PRODUCTION' ||
                  (!pm.material?.category &&
                    ['PLA', 'PETG', 'ABS', 'RESIN'].includes(pm.material?.type)),
              ) || activeVariantProfile.materials[0];

            if (customMat?.material) {
              materialId = customMat.material.id;
              materialName = customMat.material.name;
              materialCostPerUnit = Number(customMat.material.costPerUnit);
              isMaterialCustom = true;
            }
          }

          if (!isMaterialCustom && baseMat?.material) {
            materialId = baseMat.material.id;
            materialName = baseMat.material.name;
            materialCostPerUnit = Number(baseMat.material.costPerUnit);
            isMaterialCustom = false;
          }

          return {
            ...v,
            stock: totalQuantity,
            reservedStock: totalReserved,
            availableStock,
            productionCost,
            materialId,
            materialName,
            materialCostPerUnit,
            isMaterialCustom,
          };
        }),
      );

      return {
        ...product,
        variants: enrichedVariants,
      } as any;
    }

    const totalQuantity = ((product as any).inventories || []).reduce(
      (sum: number, inv: any) => sum + (inv.quantity || 0),
      0,
    );
    const totalReserved = ((product as any).inventories || []).reduce(
      (sum: number, inv: any) => sum + (inv.reservedQuantity || 0),
      0,
    );
    const availableStock = Math.max(0, totalQuantity - totalReserved);

    return {
      ...product,
      stock: totalQuantity,
      reservedStock: totalReserved,
      availableStock,
    } as any;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actorId?: string,
  ): Promise<Product> {
    const product = await this.findById(id);

    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      const targetSlug = generateSlug(dto.slug.trim());
      if (targetSlug !== product.slug) {
        const existingSlug = await this.prisma.product.findFirst({
          where: { slug: targetSlug, id: { not: id } },
        });
        if (existingSlug) {
          throw new ConflictException(
            `Product with slug "${targetSlug}" already exists`,
          );
        }
        updateData.slug = targetSlug;
      }
    }

    if (dto.sku !== undefined) {
      const targetSku = dto.sku ? dto.sku.trim() : null;
      if (targetSku !== product.sku) {
        if (targetSku) {
          const existingSku = await this.prisma.product.findFirst({
            where: { sku: targetSku, id: { not: id } },
          });
          if (existingSku) {
            throw new ConflictException(
              `Product with SKU "${targetSku}" already exists`,
            );
          }
        }
        updateData.sku = targetSku;
      }
    }

    if (dto.shortDescription !== undefined) {
      updateData.shortDescription = dto.shortDescription
        ? dto.shortDescription.trim()
        : null;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description ? dto.description.trim() : null;
    }

    const isStatusChanged =
      dto.status !== undefined && dto.status !== product.status;
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    if (dto.brand !== undefined) {
      updateData.brand = dto.brand ? dto.brand.trim() : null;
    }

    if (dto.basePrice !== undefined) {
      updateData.basePrice = dto.basePrice !== null ? dto.basePrice : null;
    }

    if (dto.costSource && dto.costSource !== product.costSource) {
      await this.auditLog.log({
        action: 'PRODUCTION_COST_SOURCE_CHANGED',
        entity: 'Product',
        entityId: id,
        userId: actorId ?? null,
        metadata: {
          productId: id,
          previousSource: product.costSource,
          newSource: dto.costSource,
        },
      });
      updateData.costSource = dto.costSource;
    }

    if (dto.manualCost !== undefined) {
      if (dto.manualCost !== null && Number(dto.manualCost) <= 0) {
        throw new BadRequestException('Custo de produção manual deve ser maior que zero.');
      }
      const prevVal = product.manualCost ? Number(product.manualCost) : null;
      const newVal = dto.manualCost !== null ? Number(dto.manualCost) : null;
      if (prevVal !== newVal) {
        await this.auditLog.log({
          action: 'PRODUCTION_COST_UPDATED',
          entity: 'Product',
          entityId: id,
          userId: actorId ?? null,
          metadata: {
            productId: id,
            previousValue: prevVal,
            newValue: newVal,
          },
        });
      }
      updateData.manualCost = dto.manualCost !== null && dto.manualCost !== undefined ? new Prisma.Decimal(dto.manualCost) : null;
    }

    if (dto.wholesalePrice !== undefined) {
      if (dto.wholesalePrice !== null && Number(dto.wholesalePrice) <= 0) {
        throw new BadRequestException('Preço de atacado deve ser maior que zero.');
      }
      const prevWholesale = product.wholesalePrice ? Number(product.wholesalePrice) : null;
      const newWholesale = dto.wholesalePrice !== null ? Number(dto.wholesalePrice) : null;
      if (prevWholesale !== newWholesale) {
        await this.auditLog.log({
          action: 'WHOLESALE_PRICE_UPDATED',
          entity: 'Product',
          entityId: id,
          userId: actorId ?? null,
          metadata: {
            productId: id,
            previousValue: prevWholesale,
            newValue: newWholesale,
          },
        });
      }
      updateData.wholesalePrice = dto.wholesalePrice !== null && dto.wholesalePrice !== undefined ? new Prisma.Decimal(dto.wholesalePrice) : null;
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Recalcula preços F12 para os canais habilitados caso haja custo F7 válido
    try {
      await this.recalculateEnabledChannelPrices(id, actorId);
    } catch (err: any) {
      this.logger.warn(
        `Erro ao recalcular preços F12 dos canais no update: ${err?.message}`,
      );
    }

    await this.auditLog.log({
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: {
        updatedFields: Object.keys(updateData),
      },
    });

    if (isStatusChanged) {
      await this.auditLog.log({
        action: 'PRODUCT_STATUS_CHANGED',
        entity: 'Product',
        entityId: updated.id,
        userId: actorId ?? null,
        metadata: {
          oldStatus: product.status,
          newStatus: updated.status,
        },
      });

      if (updated.status === ProductStatus.ARCHIVED) {
        await this.auditLog.log({
          action: 'PRODUCT_ARCHIVED',
          entity: 'Product',
          entityId: updated.id,
          userId: actorId ?? null,
        });
      }
    }

    return updated;
  }

  async delete(
    id: string,
    actorId?: string,
  ): Promise<{ message: string; id: string }> {
    const product = await this.findById(id);

    // 1. Soft delete: sets status to ARCHIVED, preserving data integrity and audit history
    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });

    // 2. Revogação comercial total de todos os canais associados
    // Remove associações ativas em ProductChannel para que o produto deixe de estar disponível em qualquer canal
    await this.prisma.productChannel.deleteMany({
      where: { productId: id },
    });

    // 3. Se existirem anúncios técnicos de marketplace em ChannelProduct, pausar/despublicar
    await this.prisma.channelProduct.updateMany({
      where: {
        productId: id,
        status: { in: ['PUBLISHED', 'PENDING'] },
      },
      data: {
        status: 'PAUSED',
      },
    });

    if (product.status !== ProductStatus.ARCHIVED) {
      await this.auditLog.log({
        action: 'PRODUCT_STATUS_CHANGED',
        entity: 'Product',
        entityId: id,
        userId: actorId ?? null,
        metadata: {
          oldStatus: product.status,
          newStatus: ProductStatus.ARCHIVED,
        },
      });
    }

    await this.auditLog.log({
      action: 'PRODUCT_ARCHIVED',
      entity: 'Product',
      entityId: id,
      userId: actorId ?? null,
      metadata: {
        commercialAvailabilityRevoked: true,
      },
    });

    return {
      message: 'Product archived successfully',
      id,
    };
  }

  async assignNiches(id: string, nicheIds: string[], actorId?: string) {
    await this.findById(id);

    // Verify all niches exist
    const count = await this.prisma.niche.count({
      where: { id: { in: nicheIds } },
    });
    if (count !== nicheIds.length) {
      throw new NotFoundException('One or more niches not found');
    }

    // Atomic replace associations
    await this.prisma.$transaction([
      this.prisma.productNiche.deleteMany({ where: { productId: id } }),
      this.prisma.productNiche.createMany({
        data: nicheIds.map((nicheId) => ({ productId: id, nicheId })),
      }),
    ]);

    await this.auditLog.log({
      action: 'PRODUCT_NICHES_UPDATED',
      entity: 'Product',
      entityId: id,
      userId: actorId ?? null,
      metadata: { nicheIds },
    });

    return this.findById(id);
  }

  async assignCategories(id: string, categoryIds: string[], actorId?: string) {
    await this.findById(id);

    // Verify all categories exist
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, nicheId: true, parentId: true },
    });
    if (categories.length !== categoryIds.length) {
      throw new NotFoundException('One or more categories not found');
    }

    // Validar coerência taxonômica: categoria não pode pertencer a outro nicho
    if (this.prisma.productNiche) {
      const productNiches = await this.prisma.productNiche.findMany({
        where: { productId: id },
        select: { nicheId: true },
      });
      if (productNiches.length > 0) {
        const allowedNiches = new Set(productNiches.map((pn) => pn.nicheId));
        for (const cat of categories) {
          if (cat.nicheId && !allowedNiches.has(cat.nicheId)) {
            throw new BadRequestException(
              `A categoria "${cat.name}" pertence a outro nicho incompatível com o produto.`,
            );
          }
        }
      }
    }

    // Atomic replace associations
    await this.prisma.$transaction([
      this.prisma.productCategory.deleteMany({ where: { productId: id } }),
      this.prisma.productCategory.createMany({
        data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
      }),
    ]);

    await this.auditLog.log({
      action: 'PRODUCT_CATEGORIES_UPDATED',
      entity: 'Product',
      entityId: id,
      userId: actorId ?? null,
      metadata: { categoryIds },
    });

    return this.findById(id);
  }

  async assignTags(id: string, tagIds: string[], actorId?: string) {
    await this.findById(id);

    // Verify all tags exist
    const count = await this.prisma.tag.count({
      where: { id: { in: tagIds } },
    });
    if (count !== tagIds.length) {
      throw new NotFoundException('One or more tags not found');
    }

    // Atomic replace associations
    await this.prisma.$transaction([
      this.prisma.productTag.deleteMany({ where: { productId: id } }),
      this.prisma.productTag.createMany({
        data: tagIds.map((tagId) => ({ productId: id, tagId })),
      }),
    ]);

    await this.auditLog.log({
      action: 'PRODUCT_TAGS_UPDATED',
      entity: 'Product',
      entityId: id,
      userId: actorId ?? null,
      metadata: { tagIds },
    });

    return this.findById(id);
  }

  // ==========================================
  // CANAIS COMERCIAIS & DOSSIÊ CENTRAL (FASE 2)
  // ==========================================

  /**
   * 1. Consulta todos os canais comerciais do sistema com status de disponibilidade para o produto
   */
  async getChannels(productId: string) {
    // Executa as consultas em paralelo direto sem carregar o objeto pesado findById
    const [product, allChannels, productChannels] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, status: true },
      }),
      this.prisma.channel.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.productChannel.findMany({
        where: { productId },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product with id "${productId}" not found`);
    }

    const channelMap = new Map(
      productChannels.map((pc) => [pc.channelId, pc]),
    );

    const channels = allChannels.map((ch) => {
      const pc = channelMap.get(ch.id);
      return {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        channelIsActive: ch.isActive,
        isAssigned: Boolean(pc),
        isEnabled: pc ? pc.isEnabled : false,
        assignedAt: pc ? pc.createdAt : null,
      };
    });

    return {
      productId: product.id,
      productName: product.name,
      productStatus: product.status,
      channels,
    };
  }

  /**
   * 2. Define/atualiza os canais comerciais disponíveis para o produto
   * - Suporta seleção múltipla (array de channelIds ou itens { channelId, isEnabled })
   * - Impede que produtos arquivados sejam disponibilizados comercialmente sem desarquivar
   */
  async assignChannels(
    productId: string,
    dto: {
      channelIds?: string[];
      channels?: { channelId: string; isEnabled?: boolean }[];
    },
    actorId?: string,
  ) {
    const product = await this.findById(productId);

    // Regra de segurança: produto arquivado não pode ter canais ativados sem antes alterar o status
    if (product.status === ProductStatus.ARCHIVED) {
      const wantsToEnable =
        (dto.channelIds && dto.channelIds.length > 0) ||
        (dto.channels && dto.channels.length > 0);
      if (wantsToEnable) {
        throw new BadRequestException(
          'Produto arquivado não pode receber canais comerciais ativos. Reative o produto para DRAFT ou ACTIVE antes de associar canais.',
        );
      }
    }

    // Normalizar lista de canais desejados
    const itemsToSet: { channelId: string; isEnabled: boolean }[] = [];

    if (dto.channels && dto.channels.length > 0) {
      for (const item of dto.channels) {
        itemsToSet.push({
          channelId: item.channelId,
          isEnabled: item.isEnabled !== undefined ? item.isEnabled : true,
        });
      }
    } else if (dto.channelIds) {
      for (const cId of dto.channelIds) {
        itemsToSet.push({
          channelId: cId,
          isEnabled: true,
        });
      }
    }

    // Validar existência dos canais solicitados
    if (itemsToSet.length > 0) {
      const requestedIds = itemsToSet.map((i) => i.channelId);
      const existingCount = await this.prisma.channel.count({
        where: { id: { in: requestedIds } },
      });
      if (existingCount !== requestedIds.length) {
        throw new NotFoundException(
          'Um ou mais canais comerciais informados não foram encontrados.',
        );
      }
    }

    // Garantir que a Loja Própria (OWN_STORE) continue associada e habilitada para produtos não-arquivados
    if (product.status !== ProductStatus.ARCHIVED && this.prisma.channel?.findFirst) {
      const ownStore = await this.prisma.channel.findFirst({
        where: { type: 'OWN_STORE', isActive: true },
      });
      if (ownStore && !itemsToSet.some((i) => i.channelId === ownStore.id)) {
        itemsToSet.unshift({
          channelId: ownStore.id,
          isEnabled: true,
        });
      }
    }

    // Atualização atômica em transação: substitui canais vinculados
    await this.prisma.$transaction(async (tx) => {
      await tx.productChannel.deleteMany({
        where: { productId },
      });

      if (itemsToSet.length > 0) {
        await tx.productChannel.createMany({
          data: itemsToSet.map((item) => ({
            productId,
            channelId: item.channelId,
            isEnabled: item.isEnabled,
          })),
        });
      }
    });

    await this.auditLog.log({
      action: 'PRODUCT_CHANNELS_UPDATED',
      entity: 'Product',
      entityId: productId,
      userId: actorId ?? null,
      metadata: {
        assignedChannelsCount: itemsToSet.length,
        channels: itemsToSet,
      },
    });

    // Recalcula preços F12 para os canais habilitados caso haja custo F7 válido
    try {
      await this.recalculateEnabledChannelPrices(productId, actorId);
    } catch (err: any) {
      this.logger.warn(
        `Erro ao recalcular preços F12 dos canais no syncChannels: ${err?.message}`,
      );
    }

    return this.getChannels(productId);
  }

  /**
   * 3. Cálculo da completude do dossiê comercial com base nos dados reais existentes no modelo
   */
  calculateDossierCompleteness(product: any): {
    percentage: number;
    isReadyForCommercialUse: boolean;
    missingFields: string[];
  } {
    const missing: string[] = [];
    let score = 0;
    const totalPoints = 7;

    // 1. Identificação básica
    if (product.name && product.name.trim().length >= 3) {
      score += 1;
    } else {
      missing.push('Nome do produto');
    }

    // 2. SKU
    if (product.sku && product.sku.trim().length >= 3) {
      score += 1;
    } else {
      missing.push('SKU (Código único)');
    }

    // 3. Descrição
    if (
      (product.description && product.description.trim().length > 10) ||
      (product.shortDescription && product.shortDescription.trim().length > 5)
    ) {
      score += 1;
    } else {
      missing.push('Descrição comercial');
    }

    // 4. Preço comercial ou de canal
    const hasAnyPrice =
      (product.basePrice !== null && Number(product.basePrice) > 0) ||
      (product.wholesalePrice !== null && Number(product.wholesalePrice) > 0) ||
      (product.productChannelPrices && product.productChannelPrices.length > 0);
    if (hasAnyPrice) {
      score += 1;
    } else {
      missing.push('Preço base');
    }

    // 5. Imagem principal
    if (product.media && product.media.length > 0) {
      score += 1;
    } else {
      missing.push('Fotos/Mídias');
    }

    // 6. Classificação comercial (Categoria)
    if (product.categories && product.categories.length > 0) {
      score += 1;
    } else {
      missing.push('Categoria');
    }

    // 7. Nicho
    if (product.niches && product.niches.length > 0) {
      score += 1;
    } else {
      missing.push('Nicho');
    }

    const percentage = Math.round((score / totalPoints) * 100);

    return {
      percentage,
      isReadyForCommercialUse: percentage >= 80,
      missingFields: missing,
    };
  }

  /**
   * Recalcula preços no motor F12 para os canais comerciais habilitados do produto.
   * Regra oficial: Base de cálculo comercial é o Preço de Atacado (wholesalePrice).
   * Se não possuir atacado definido, os preços de canal permanecem não calculados.
   */
  async recalculateEnabledChannelPrices(
    productId: string,
    actorId?: string,
  ): Promise<any[]> {
    if (!this.pricingService) {
      return [];
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { wholesalePrice: true, status: true },
    });

    if (!product?.wholesalePrice || Number(product.wholesalePrice) <= 0) {
      this.logger.log(
        `Produto ${productId} não possui preço de atacado. Precificação comercial retida (aguardando atacado).`,
      );
      return [];
    }

    // Se o produto não for arquivado, garante que a Loja Própria (OWN_STORE) esteja associada e habilitada
    let ownStoreId: string | null = null;
    if (product.status !== ProductStatus.ARCHIVED && this.prisma.channel?.findFirst) {
      const ownStore = await this.prisma.channel.findFirst({
        where: { type: 'OWN_STORE', isActive: true },
      });
      if (ownStore) {
        ownStoreId = ownStore.id;
        if (this.prisma.productChannel?.findFirst && this.prisma.productChannel?.create) {
          const pc = await this.prisma.productChannel.findFirst({
            where: { productId, channelId: ownStore.id },
          });
          if (!pc) {
            await this.prisma.productChannel.create({
              data: {
                productId,
                channelId: ownStore.id,
                isEnabled: true,
              },
            });
          }
        }
      }
    }

    const enabledChannels = await this.prisma.productChannel.findMany({
      where: { productId, isEnabled: true },
      select: { channelId: true },
    });

    const channelIds = Array.from(
      new Set([
        ...enabledChannels.map((c) => c.channelId),
        ...(ownStoreId ? [ownStoreId] : []),
      ]),
    );

    if (channelIds.length === 0) {
      return [];
    }

    return this.pricingService.calculateAndPersist(
      {
        productId,
        channelIds,
      },
      actorId,
    );
  }

  /**
   * Retorna o resumo consolidado de precificação para exibição no formulário administrativo:
   * - Custo de produção apurado via F7 / Manual
   * - Preço de atacado (base comercial)
   * - Preço de varejo da Loja Própria
   * - Preços calculados por canal habilitado (ML, Shopee, TikTok, Facebook)
   */
  async getPricingSummary(productId: string) {
    let costRes: CostResolution = {
      source: 'NONE',
      cost: new Prisma.Decimal(0),
      isPartial: true,
      warnings: [],
    };
    if (this.costResolver) {
      costRes = await this.costResolver.resolveCost(productId);
    }
    const hasValidCost =
      costRes.source !== 'NONE' && costRes.cost.greaterThan(0);

    const [product, productionCostOnly, productChannels, channelPrices] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, costSource: true, manualCost: true, wholesalePrice: true },
      }),
      this.costResolver?.getProductionCostOnly
        ? this.costResolver.getProductionCostOnly(productId).catch(() => null)
        : Promise.resolve(null),
      this.prisma.productChannel.findMany({
        where: { productId },
        include: { channel: true },
      }),
      this.prisma.productChannelPrice.findMany({
        where: { productId, variantId: null },
        include: { channel: true },
      }),
    ]);

    let productionCost: number | null = productionCostOnly;
    if (costRes.source === 'MANUAL' && product?.manualCost) {
      productionCost = Number(product.manualCost);
    } else if (hasValidCost && !productionCost) {
      productionCost = Number(costRes.cost);
    }

    const wholesalePrice = product?.wholesalePrice
      ? Number(product.wholesalePrice)
      : null;
    const hasValidWholesalePrice =
      wholesalePrice !== null && wholesalePrice > 0;

    const channelsInfo = productChannels.map((pc) => {
      const cp = channelPrices.find((p) => p.channelId === pc.channelId);
      const isPcpValid =
        hasValidWholesalePrice ||
        (cp?.mode === 'MANUAL' && cp?.manualPrice !== null);
      return {
        channelId: pc.channelId,
        channelName: pc.channel?.name || 'Canal',
        channelType: pc.channel?.type || 'UNKNOWN',
        isEnabled: pc.isEnabled,
        effectivePrice:
          isPcpValid && cp?.effectivePrice ? Number(cp.effectivePrice) : null,
        mode: cp?.mode || 'AUTOMATIC',
        status: !hasValidCost
          ? 'Aguardando custo'
          : !hasValidWholesalePrice
            ? 'Aguardando atacado'
            : isPcpValid && cp?.effectivePrice
              ? 'Calculado'
              : 'Não calculado',
      };
    });

    const ownStorePrice =
      channelsInfo.find((c) => c.channelType === 'OWN_STORE')?.effectivePrice ??
      null;

    const manualCost = product?.manualCost ? Number(product.manualCost) : null;
    const selectedCostSource = product?.costSource || 'COST_FROM_F7';

    return {
      productId,
      cost: productionCost,
      commercialCost: wholesalePrice ?? productionCost,
      productionCost,
      manualCost,
      wholesalePrice,
      retailPrice: ownStorePrice,
      selectedCostSource,
      costSource: costRes.source,
      hasValidCost,
      hasValidWholesalePrice,
      statusLabel: hasValidWholesalePrice
        ? 'Disponível'
        : hasValidCost
          ? 'Aguardando atacado'
          : 'Aguardando custo',
      ownStorePrice,
      channelPrices: channelsInfo,
      warnings: costRes.warnings,
    };
  }
}
