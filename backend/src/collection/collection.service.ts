import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { QueryCollectionsDto } from './dto/query-collections.dto';
import {
  AddCollectionProductDto,
  CollectionProductsOrderDto,
} from './dto/manage-collection-items.dto';
import { Collection, CollectionStatus } from '@prisma/client';
import { generateSlug } from '../product/utils/slug.util';

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product "${productId}" not found`);
    }
    return product;
  }

  async create(
    dto: CreateCollectionDto,
    actorId?: string,
  ): Promise<Collection> {
    const slug = dto.slug?.trim() || generateSlug(dto.name);

    const existing = await this.prisma.collection.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(
        `Collection with slug "${slug}" already exists`,
      );
    }

    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        coverMediaId: dto.coverMediaId || null,
        status: dto.status || CollectionStatus.DRAFT,
      },
    });

    await this.auditLog.log({
      action: 'COLLECTION_CREATED',
      entity: 'Collection',
      entityId: collection.id,
      userId: actorId ?? null,
      metadata: { name: collection.name, slug: collection.slug },
    });

    return collection;
  }

  async findAll(query: QueryCollectionsDto) {
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
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { items: true, catalogs: true },
          },
        },
      }),
      this.prisma.collection.count({ where }),
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

  async findById(id: string): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              include: {
                media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
                variants: { take: 1 },
              },
            },
          },
        },
        catalogs: {
          include: {
            catalog: true,
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection "${id}" not found`);
    }

    return collection;
  }

  async update(
    id: string,
    dto: UpdateCollectionDto,
    actorId?: string,
  ): Promise<Collection> {
    const collection = await this.findById(id);

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
    if (dto.coverMediaId !== undefined) {
      updateData.coverMediaId = dto.coverMediaId;
      updatedFields.push('coverMediaId');
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      updatedFields.push('status');
    }

    if (dto.slug !== undefined) {
      const targetSlug = dto.slug.trim();
      if (targetSlug !== collection.slug) {
        const existing = await this.prisma.collection.findUnique({
          where: { slug: targetSlug },
        });
        if (existing) {
          throw new ConflictException(
            `Collection with slug "${targetSlug}" already exists`,
          );
        }
        updateData.slug = targetSlug;
        updatedFields.push('slug');
      }
    }

    const updated = await this.prisma.collection.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'COLLECTION_UPDATED',
      entity: 'Collection',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { updatedFields },
    });

    if (dto.status !== undefined && dto.status !== collection.status) {
      await this.auditLog.log({
        action: 'COLLECTION_STATUS_CHANGED',
        entity: 'Collection',
        entityId: updated.id,
        userId: actorId ?? null,
        metadata: { oldStatus: collection.status, newStatus: dto.status },
      });
    }

    return this.findById(id);
  }

  async delete(id: string, actorId?: string): Promise<{ message: string }> {
    await this.findById(id);

    await this.prisma.collection.update({
      where: { id },
      data: { status: CollectionStatus.ARCHIVED },
    });

    await this.auditLog.log({
      action: 'COLLECTION_ARCHIVED',
      entity: 'Collection',
      entityId: id,
      userId: actorId ?? null,
    });

    return { message: 'Collection archived successfully' };
  }

  async duplicate(id: string, actorId?: string): Promise<Collection> {
    const original = await this.findById(id);

    const baseName = `${original.name} (Cópia)`;
    let targetSlug = `${original.slug}-copia`;
    let counter = 1;

    while (
      await this.prisma.collection.findUnique({ where: { slug: targetSlug } })
    ) {
      counter++;
      targetSlug = `${original.slug}-copia-${counter}`;
    }

    const originalItems = (original as any).items || [];

    const duplicated = await this.prisma.collection.create({
      data: {
        name: baseName,
        slug: targetSlug,
        description: original.description,
        coverMediaId: original.coverMediaId,
        status: CollectionStatus.DRAFT,
        items: {
          create: originalItems.map((i: any) => ({
            productId: i.productId,
            position: i.position,
          })),
        },
      },
    });

    await this.auditLog.log({
      action: 'COLLECTION_DUPLICATED',
      entity: 'Collection',
      entityId: duplicated.id,
      userId: actorId ?? null,
      metadata: { originalId: original.id, slug: duplicated.slug },
    });

    return this.findById(duplicated.id);
  }

  // --- ITEM (PRODUCT) OPERATIONS ---

  async addProduct(
    collectionId: string,
    dto: AddCollectionProductDto,
    actorId?: string,
  ) {
    await this.findById(collectionId);
    await this.assertProductExists(dto.productId);

    const existing = await this.prisma.collectionItem.findUnique({
      where: {
        collectionId_productId: {
          collectionId,
          productId: dto.productId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Product is already in this collection');
    }

    let position = dto.position;
    if (position === undefined) {
      const maxItem = await this.prisma.collectionItem.findFirst({
        where: { collectionId },
        orderBy: { position: 'desc' },
      });
      position = maxItem ? maxItem.position + 1 : 0;
    }

    const item = await this.prisma.collectionItem.create({
      data: {
        collectionId,
        productId: dto.productId,
        position,
      },
    });

    await this.auditLog.log({
      action: 'COLLECTION_PRODUCT_ADDED',
      entity: 'Collection',
      entityId: collectionId,
      userId: actorId ?? null,
      metadata: { productId: dto.productId, position },
    });

    return item;
  }

  async removeProduct(
    collectionId: string,
    productId: string,
    actorId?: string,
  ) {
    await this.findById(collectionId);

    const item = await this.prisma.collectionItem.findUnique({
      where: {
        collectionId_productId: {
          collectionId,
          productId,
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Product not found in this collection');
    }

    await this.prisma.collectionItem.delete({
      where: { id: item.id },
    });

    await this.auditLog.log({
      action: 'COLLECTION_PRODUCT_REMOVED',
      entity: 'Collection',
      entityId: collectionId,
      userId: actorId ?? null,
      metadata: { productId },
    });

    return { message: 'Product removed from collection successfully' };
  }

  async reorderProducts(
    collectionId: string,
    dto: CollectionProductsOrderDto,
    actorId?: string,
  ) {
    await this.findById(collectionId);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.collectionItem.updateMany({
          where: { collectionId, productId: item.productId },
          data: { position: item.position },
        }),
      ),
    );

    await this.auditLog.log({
      action: 'COLLECTION_PRODUCTS_REORDERED',
      entity: 'Collection',
      entityId: collectionId,
      userId: actorId ?? null,
      metadata: { count: dto.items.length },
    });

    return { message: 'Collection products reordered successfully' };
  }
}
