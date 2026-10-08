import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { Category, CategoryStatus } from '@prisma/client';
import { generateSlug } from '../product/utils/slug.util';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async assertNicheExists(nicheId: string) {
    const niche = await this.prisma.niche.findUnique({
      where: { id: nicheId },
    });
    if (!niche) {
      throw new NotFoundException(`Niche "${nicheId}" not found`);
    }
    return niche;
  }

  private async assertParentCategory(
    parentId: string,
    currentCategoryId?: string,
  ) {
    if (currentCategoryId && parentId === currentCategoryId) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new NotFoundException(`Parent category "${parentId}" not found`);
    }

    // Check for circular reference: traverse upward from candidate parent
    if (currentCategoryId) {
      let curr = parent;
      while (curr.parentId) {
        if (curr.parentId === currentCategoryId) {
          throw new BadRequestException('Circular hierarchy detected');
        }
        const next = await this.prisma.category.findUnique({
          where: { id: curr.parentId },
        });
        if (!next) break;
        curr = next;
      }
    }

    return parent;
  }

  async create(dto: CreateCategoryDto, actorId?: string): Promise<Category> {
    const slug = dto.slug?.trim() || generateSlug(dto.name);

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(
        `Category with slug "${slug}" already exists`,
      );
    }

    if (dto.nicheId) {
      await this.assertNicheExists(dto.nicheId);
    }

    if (dto.parentId) {
      const parent = await this.assertParentCategory(dto.parentId);
      // Coherence: if parent has a nicheId and dto doesn't specify one, inherit parent's nicheId
      if (!dto.nicheId && parent.nicheId) {
        dto.nicheId = parent.nicheId;
      } else if (
        dto.nicheId &&
        parent.nicheId &&
        dto.nicheId !== parent.nicheId
      ) {
        throw new BadRequestException(
          'Child category niche must match parent category niche',
        );
      }
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        status: dto.status || CategoryStatus.ACTIVE,
        parentId: dto.parentId || null,
        nicheId: dto.nicheId || null,
      },
    });

    await this.auditLog.log({
      action: 'CATEGORY_CREATED',
      entity: 'Category',
      entityId: category.id,
      userId: actorId ?? null,
      metadata: {
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        nicheId: category.nicheId,
      },
    });

    return category;
  }

  async findAll(query: QueryCategoriesDto) {
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
    if (query.nicheId) {
      where.nicheId = query.nicheId;
    }
    if (query.parentId !== undefined) {
      where.parentId = query.parentId;
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          niche: true,
          parent: true,
          _count: {
            select: { children: true, products: true },
          },
        },
      }),
      this.prisma.category.count({ where }),
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

  async getTree() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        niche: true,
        children: {
          include: {
            children: true,
          },
        },
      },
    });

    // Return root categories with populated children
    return categories.filter((c) => !c.parentId);
  }

  async findById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        niche: true,
        parent: true,
        children: true,
        _count: {
          select: { products: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Category "${id}" not found`);
    }
    return category;
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    actorId?: string,
  ): Promise<Category> {
    const category = await this.findById(id);

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

    if (dto.slug !== undefined) {
      const targetSlug = dto.slug.trim();
      if (targetSlug !== category.slug) {
        const existing = await this.prisma.category.findUnique({
          where: { slug: targetSlug },
        });
        if (existing) {
          throw new ConflictException(
            `Category with slug "${targetSlug}" already exists`,
          );
        }
        updateData.slug = targetSlug;
        updatedFields.push('slug');
      }
    }

    if (dto.status !== undefined) {
      updateData.status = dto.status;
      updatedFields.push('status');
    }

    if (dto.nicheId !== undefined) {
      if (dto.nicheId) {
        await this.assertNicheExists(dto.nicheId);
      }
      updateData.nicheId = dto.nicheId;
      updatedFields.push('nicheId');
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        const parent = await this.assertParentCategory(dto.parentId, id);
        const effectiveNicheId =
          dto.nicheId !== undefined ? dto.nicheId : category.nicheId;
        if (
          effectiveNicheId &&
          parent.nicheId &&
          effectiveNicheId !== parent.nicheId
        ) {
          throw new BadRequestException(
            'Child category niche must match parent category niche',
          );
        }
      }
      updateData.parentId = dto.parentId;
      updatedFields.push('parentId');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'CATEGORY_UPDATED',
      entity: 'Category',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { updatedFields },
    });

    return updated;
  }

  async delete(id: string, actorId?: string): Promise<{ message: string }> {
    await this.findById(id);

    await this.prisma.category.update({
      where: { id },
      data: { status: CategoryStatus.INACTIVE },
    });

    await this.auditLog.log({
      action: 'CATEGORY_DEACTIVATED',
      entity: 'Category',
      entityId: id,
      userId: actorId ?? null,
    });

    return { message: 'Category deactivated successfully' };
  }
}
