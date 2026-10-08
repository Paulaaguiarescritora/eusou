import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { QueryCatalogsDto } from './dto/query-catalogs.dto';
import {
  AddCatalogProductDto,
  AddCatalogCollectionDto,
  CatalogProductsOrderDto,
  CatalogCollectionsOrderDto,
} from './dto/manage-catalog-items.dto';
import { Catalog, CatalogStatus, CatalogType } from '@prisma/client';
import { generateSlug } from '../product/utils/slug.util';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async assertNicheExists(nicheId: string) {
    const niche = await this.prisma.niche.findUnique({
      where: { id: nicheId },
    });
    if (!niche) throw new NotFoundException(`Niche "${nicheId}" not found`);
    return niche;
  }

  private async assertThemeExists(themeId: string) {
    const theme = await this.prisma.theme.findUnique({
      where: { id: themeId },
    });
    if (!theme) throw new NotFoundException(`Theme "${themeId}" not found`);
    return theme;
  }

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product)
      throw new NotFoundException(`Product "${productId}" not found`);
    return product;
  }

  private async assertCollectionExists(collectionId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection)
      throw new NotFoundException(`Collection "${collectionId}" not found`);
    return collection;
  }

  async create(dto: CreateCatalogDto, actorId?: string): Promise<Catalog> {
    const slug = dto.slug?.trim() || generateSlug(dto.name);

    const existing = await this.prisma.catalog.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Catalog with slug "${slug}" already exists`);
    }

    if (dto.nicheId) await this.assertNicheExists(dto.nicheId);
    if (dto.themeId) await this.assertThemeExists(dto.themeId);

    const catalog = await this.prisma.catalog.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        status: dto.status || CatalogStatus.DRAFT,
        type: dto.type || CatalogType.MANUAL,
        nicheId: dto.nicheId || null,
        themeId: dto.themeId || null,
        rules:
          dto.rules && dto.rules.length > 0
            ? {
                create: dto.rules.map((r) => ({
                  type: r.type,
                  value: r.value,
                })),
              }
            : undefined,
      },
      include: {
        rules: true,
      },
    });

    await this.auditLog.log({
      action: 'CATALOG_CREATED',
      entity: 'Catalog',
      entityId: catalog.id,
      userId: actorId ?? null,
      metadata: { name: catalog.name, slug: catalog.slug, type: catalog.type },
    });

    return catalog;
  }

  async findAll(query: QueryCatalogsDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { slug: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.nicheId) where.nicheId = query.nicheId;

    const [data, total] = await Promise.all([
      this.prisma.catalog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          niche: true,
          theme: true,
          _count: {
            select: { items: true, collections: true, rules: true },
          },
        },
      }),
      this.prisma.catalog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id: string): Promise<Catalog> {
    const catalog = await this.prisma.catalog.findUnique({
      where: { id },
      include: {
        niche: true,
        theme: true,
        rules: true,
        items: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              include: {
                media: { orderBy: { sortOrder: 'asc' }, take: 1 },
                variants: { take: 1 },
              },
            },
          },
        },
        collections: {
          orderBy: { position: 'asc' },
          include: {
            collection: {
              include: {
                _count: { select: { items: true } },
              },
            },
          },
        },
      },
    });

    if (!catalog) {
      throw new NotFoundException(`Catalog "${id}" not found`);
    }

    return catalog;
  }

  /**
   * Resolves products dynamically if AUTOMATIC, or returns manual items
   */
  async resolveProducts(id: string) {
    const catalog = await this.findById(id);

    if (catalog.type === CatalogType.MANUAL) {
      return (catalog as any).items.map((i: any) => ({
        ...i.product,
        position: i.position,
      }));
    }

    // AUTOMATIC CATALOG: resolve products from rules
    const rules = (catalog as any).rules || [];
    if (rules.length === 0) {
      // If no rules, but catalog has a nicheId, use nicheId by default
      if (catalog.nicheId) {
        return this.prisma.product.findMany({
          where: {
            status: 'ACTIVE',
            niches: { some: { nicheId: catalog.nicheId } },
          },
          include: {
            media: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        });
      }
      return [];
    }

    // Construct Prisma query from rules
    const orConditions: any[] = [];
    for (const rule of rules) {
      if (rule.type === 'NICHE') {
        orConditions.push({ niches: { some: { nicheId: rule.value } } });
      } else if (rule.type === 'CATEGORY') {
        orConditions.push({ categories: { some: { categoryId: rule.value } } });
      } else if (rule.type === 'TAG') {
        orConditions.push({ tags: { some: { tagId: rule.value } } });
      }
    }

    return this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: orConditions,
      },
      include: {
        media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    });
  }

  async update(
    id: string,
    dto: UpdateCatalogDto,
    actorId?: string,
  ): Promise<Catalog> {
    const catalog = await this.findById(id);

    const updateData: any = {};
    const updatedFields: string[] = [];

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
      updatedFields.push('name');
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description?.trim() || null;
      updatedFields.push('description');
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      updatedFields.push('status');
    }
    if (dto.type !== undefined) {
      updateData.type = dto.type;
      updatedFields.push('type');
    }

    if (dto.nicheId !== undefined) {
      if (dto.nicheId) await this.assertNicheExists(dto.nicheId);
      updateData.nicheId = dto.nicheId;
      updatedFields.push('nicheId');
    }

    if (dto.themeId !== undefined) {
      if (dto.themeId) await this.assertThemeExists(dto.themeId);
      updateData.themeId = dto.themeId;
      updatedFields.push('themeId');
    }

    if (dto.slug !== undefined) {
      const targetSlug = dto.slug.trim();
      if (targetSlug !== catalog.slug) {
        const existing = await this.prisma.catalog.findUnique({
          where: { slug: targetSlug },
        });
        if (existing) {
          throw new ConflictException(
            `Catalog with slug "${targetSlug}" already exists`,
          );
        }
        updateData.slug = targetSlug;
        updatedFields.push('slug');
      }
    }

    // Handle rules replacement if provided
    if (dto.rules !== undefined) {
      await this.prisma.catalogRule.deleteMany({ where: { catalogId: id } });
      if (dto.rules.length > 0) {
        await this.prisma.catalogRule.createMany({
          data: dto.rules.map((r) => ({
            catalogId: id,
            type: r.type,
            value: r.value,
          })),
        });
      }
      updatedFields.push('rules');
    }

    const updated = await this.prisma.catalog.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'CATALOG_UPDATED',
      entity: 'Catalog',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { updatedFields },
    });

    if (dto.status !== undefined && dto.status !== catalog.status) {
      await this.auditLog.log({
        action: 'CATALOG_STATUS_CHANGED',
        entity: 'Catalog',
        entityId: updated.id,
        userId: actorId ?? null,
        metadata: { oldStatus: catalog.status, newStatus: dto.status },
      });
    }

    return this.findById(id);
  }

  async delete(id: string, actorId?: string): Promise<{ message: string }> {
    await this.findById(id);

    await this.prisma.catalog.update({
      where: { id },
      data: { status: CatalogStatus.ARCHIVED },
    });

    await this.auditLog.log({
      action: 'CATALOG_ARCHIVED',
      entity: 'Catalog',
      entityId: id,
      userId: actorId ?? null,
    });

    return { message: 'Catalog archived successfully' };
  }

  async duplicate(id: string, actorId?: string): Promise<Catalog> {
    const original = await this.findById(id);

    const baseName = `${original.name} (Cópia)`;
    let targetSlug = `${original.slug}-copia`;
    let counter = 1;

    while (
      await this.prisma.catalog.findUnique({ where: { slug: targetSlug } })
    ) {
      counter++;
      targetSlug = `${original.slug}-copia-${counter}`;
    }

    const originalItems = (original as any).items || [];
    const originalCollections = (original as any).collections || [];
    const originalRules = (original as any).rules || [];

    const duplicated = await this.prisma.catalog.create({
      data: {
        name: baseName,
        slug: targetSlug,
        description: original.description,
        status: CatalogStatus.DRAFT,
        type: original.type,
        nicheId: original.nicheId,
        themeId: original.themeId,
        items: {
          create: originalItems.map((i: any) => ({
            productId: i.productId,
            position: i.position,
          })),
        },
        collections: {
          create: originalCollections.map((c: any) => ({
            collectionId: c.collectionId,
            position: c.position,
          })),
        },
        rules: {
          create: originalRules.map((r: any) => ({
            type: r.type,
            value: r.value,
          })),
        },
      },
    });

    await this.auditLog.log({
      action: 'CATALOG_DUPLICATED',
      entity: 'Catalog',
      entityId: duplicated.id,
      userId: actorId ?? null,
      metadata: { originalId: original.id, slug: duplicated.slug },
    });

    return this.findById(duplicated.id);
  }

  // --- ITEM (PRODUCT) OPERATIONS ---

  async addProduct(
    catalogId: string,
    dto: AddCatalogProductDto,
    actorId?: string,
  ) {
    const catalog = await this.findById(catalogId);
    if (catalog.type === CatalogType.AUTOMATIC) {
      throw new BadRequestException(
        'Cannot manually add products to an AUTOMATIC catalog',
      );
    }

    await this.assertProductExists(dto.productId);

    const existing = await this.prisma.catalogItem.findUnique({
      where: {
        catalogId_productId: {
          catalogId,
          productId: dto.productId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Product is already in this catalog');
    }

    let position = dto.position;
    if (position === undefined) {
      const maxItem = await this.prisma.catalogItem.findFirst({
        where: { catalogId },
        orderBy: { position: 'desc' },
      });
      position = maxItem ? maxItem.position + 1 : 0;
    }

    const item = await this.prisma.catalogItem.create({
      data: {
        catalogId,
        productId: dto.productId,
        position,
      },
    });

    await this.auditLog.log({
      action: 'CATALOG_PRODUCT_ADDED',
      entity: 'Catalog',
      entityId: catalogId,
      userId: actorId ?? null,
      metadata: { productId: dto.productId, position },
    });

    return item;
  }

  async removeProduct(catalogId: string, productId: string, actorId?: string) {
    await this.findById(catalogId);

    const item = await this.prisma.catalogItem.findUnique({
      where: {
        catalogId_productId: {
          catalogId,
          productId,
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Product not found in this catalog');
    }

    await this.prisma.catalogItem.delete({
      where: { id: item.id },
    });

    await this.auditLog.log({
      action: 'CATALOG_PRODUCT_REMOVED',
      entity: 'Catalog',
      entityId: catalogId,
      userId: actorId ?? null,
      metadata: { productId },
    });

    return { message: 'Product removed from catalog successfully' };
  }

  async reorderProducts(
    catalogId: string,
    dto: CatalogProductsOrderDto,
    actorId?: string,
  ) {
    await this.findById(catalogId);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.catalogItem.updateMany({
          where: { catalogId, productId: item.productId },
          data: { position: item.position },
        }),
      ),
    );

    await this.auditLog.log({
      action: 'CATALOG_PRODUCTS_REORDERED',
      entity: 'Catalog',
      entityId: catalogId,
      userId: actorId ?? null,
      metadata: { count: dto.items.length },
    });

    return { message: 'Catalog products reordered successfully' };
  }

  // --- COLLECTION OPERATIONS ---

  async addCollection(
    catalogId: string,
    dto: AddCatalogCollectionDto,
    actorId?: string,
  ) {
    await this.findById(catalogId);
    await this.assertCollectionExists(dto.collectionId);

    const existing = await this.prisma.catalogCollection.findUnique({
      where: {
        catalogId_collectionId: {
          catalogId,
          collectionId: dto.collectionId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Collection is already in this catalog');
    }

    let position = dto.position;
    if (position === undefined) {
      const maxItem = await this.prisma.catalogCollection.findFirst({
        where: { catalogId },
        orderBy: { position: 'desc' },
      });
      position = maxItem ? maxItem.position + 1 : 0;
    }

    const item = await this.prisma.catalogCollection.create({
      data: {
        catalogId,
        collectionId: dto.collectionId,
        position,
      },
    });

    await this.auditLog.log({
      action: 'CATALOG_COLLECTION_ADDED',
      entity: 'Catalog',
      entityId: catalogId,
      userId: actorId ?? null,
      metadata: { collectionId: dto.collectionId, position },
    });

    return item;
  }

  async removeCollection(
    catalogId: string,
    collectionId: string,
    actorId?: string,
  ) {
    await this.findById(catalogId);

    const item = await this.prisma.catalogCollection.findUnique({
      where: {
        catalogId_collectionId: {
          catalogId,
          collectionId,
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Collection not found in this catalog');
    }

    await this.prisma.catalogCollection.delete({
      where: { id: item.id },
    });

    await this.auditLog.log({
      action: 'CATALOG_COLLECTION_REMOVED',
      entity: 'Catalog',
      entityId: catalogId,
      userId: actorId ?? null,
      metadata: { collectionId },
    });

    return { message: 'Collection removed from catalog successfully' };
  }

  async reorderCollections(
    catalogId: string,
    dto: CatalogCollectionsOrderDto,
    actorId?: string,
  ) {
    await this.findById(catalogId);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.catalogCollection.updateMany({
          where: { catalogId, collectionId: item.collectionId },
          data: { position: item.position },
        }),
      ),
    );

    await this.auditLog.log({
      action: 'CATALOG_COLLECTIONS_REORDERED',
      entity: 'Catalog',
      entityId: catalogId,
      userId: actorId ?? null,
      metadata: { count: dto.items.length },
    });

    return { message: 'Catalog collections reordered successfully' };
  }
}
