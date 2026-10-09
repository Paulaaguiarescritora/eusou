import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { generateSlug } from './utils/slug.util';
import { Product, ProductStatus } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateProductDto, actorId?: string): Promise<Product> {
    const slug =
      dto.slug && dto.slug.trim().length > 0
        ? dto.slug.trim()
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
      },
    });

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

    if (query.categoryId) {
      where.categories = { some: { categoryId: query.categoryId } };
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
        },
      }),
      this.prisma.product.count({ where }),
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

  async findById(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        attributeValues: {
          include: { attributeDefinition: true },
        },
        variants: {
          include: {
            variantAttributeValues: {
              include: {
                productAttributeValue: {
                  include: { attributeDefinition: true },
                },
              },
            },
          },
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
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return product;
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
      const targetSlug = dto.slug.trim();
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

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

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

    // Soft delete: sets status to ARCHIVED, preserving data integrity and audit history
    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
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
    });

    return { message: 'Product archived successfully', id };
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
    const count = await this.prisma.category.count({
      where: { id: { in: categoryIds } },
    });
    if (count !== categoryIds.length) {
      throw new NotFoundException('One or more categories not found');
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
}
