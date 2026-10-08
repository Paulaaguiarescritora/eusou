import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { QueryTagsDto } from './dto/query-tags.dto';
import { Tag, TagStatus } from '@prisma/client';
import { generateSlug } from '../product/utils/slug.util';

@Injectable()
export class TagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateTagDto, actorId?: string): Promise<Tag> {
    const slug = dto.slug?.trim() || generateSlug(dto.name);

    const existing = await this.prisma.tag.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Tag with slug "${slug}" already exists`);
    }

    const tag = await this.prisma.tag.create({
      data: {
        name: dto.name.trim(),
        slug,
        status: dto.status || TagStatus.ACTIVE,
      },
    });

    await this.auditLog.log({
      action: 'TAG_CREATED',
      entity: 'Tag',
      entityId: tag.id,
      userId: actorId ?? null,
      metadata: { name: tag.name, slug: tag.slug },
    });

    return tag;
  }

  async findAll(query: QueryTagsDto) {
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
      this.prisma.tag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      this.prisma.tag.count({ where }),
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

  async findById(id: string): Promise<Tag> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    if (!tag) {
      throw new NotFoundException(`Tag "${id}" not found`);
    }
    return tag;
  }

  async update(id: string, dto: UpdateTagDto, actorId?: string): Promise<Tag> {
    const tag = await this.findById(id);

    const updateData: any = {};
    const updatedFields: string[] = [];

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
      updatedFields.push('name');
    }

    if (dto.slug !== undefined) {
      const targetSlug = dto.slug.trim();
      if (targetSlug !== tag.slug) {
        const existing = await this.prisma.tag.findUnique({
          where: { slug: targetSlug },
        });
        if (existing) {
          throw new ConflictException(
            `Tag with slug "${targetSlug}" already exists`,
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

    const updated = await this.prisma.tag.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'TAG_UPDATED',
      entity: 'Tag',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { updatedFields },
    });

    return updated;
  }

  async delete(id: string, actorId?: string): Promise<{ message: string }> {
    await this.findById(id);

    await this.prisma.tag.update({
      where: { id },
      data: { status: TagStatus.INACTIVE },
    });

    await this.auditLog.log({
      action: 'TAG_DEACTIVATED',
      entity: 'Tag',
      entityId: id,
      userId: actorId ?? null,
    });

    return { message: 'Tag deactivated successfully' };
  }
}
