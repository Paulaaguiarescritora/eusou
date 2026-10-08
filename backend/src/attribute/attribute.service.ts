import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { QueryAttributesDto } from './dto/query-attributes.dto';
import { AttributeDefinition } from '@prisma/client';

function generateSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AttributeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateAttributeDto,
    actorId?: string,
  ): Promise<AttributeDefinition> {
    const slug = dto.slug?.trim() || generateSlug(dto.name);

    const existing = await this.prisma.attributeDefinition.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(
        `Attribute with slug "${slug}" already exists`,
      );
    }

    const attr = await this.prisma.attributeDefinition.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.auditLog.log({
      action: 'ATTRIBUTE_CREATED',
      entity: 'AttributeDefinition',
      entityId: attr.id,
      userId: actorId ?? null,
      metadata: { name: attr.name, slug: attr.slug },
    });

    return attr;
  }

  async findAll(query: QueryAttributesDto) {
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
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.attributeDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.attributeDefinition.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findById(id: string): Promise<AttributeDefinition> {
    const attr = await this.prisma.attributeDefinition.findUnique({
      where: { id },
    });
    if (!attr) throw new NotFoundException(`Attribute "${id}" not found`);
    return attr;
  }

  async update(
    id: string,
    dto: UpdateAttributeDto,
    actorId?: string,
  ): Promise<AttributeDefinition> {
    const attr = await this.findById(id);

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
      if (targetSlug !== attr.slug) {
        const existing = await this.prisma.attributeDefinition.findUnique({
          where: { slug: targetSlug },
        });
        if (existing)
          throw new ConflictException(
            `Attribute with slug "${targetSlug}" already exists`,
          );
        updateData.slug = targetSlug;
        updatedFields.push('slug');
      }
    }

    const isDeactivating =
      dto.isActive !== undefined &&
      dto.isActive === false &&
      attr.isActive === true;
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
      updatedFields.push('isActive');
    }

    const updated = await this.prisma.attributeDefinition.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: isDeactivating ? 'ATTRIBUTE_DEACTIVATED' : 'ATTRIBUTE_UPDATED',
      entity: 'AttributeDefinition',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { updatedFields },
    });

    return updated;
  }

  async delete(id: string, actorId?: string): Promise<{ message: string }> {
    await this.findById(id);
    // Soft delete via isActive = false
    await this.prisma.attributeDefinition.update({
      where: { id },
      data: { isActive: false },
    });
    await this.auditLog.log({
      action: 'ATTRIBUTE_DEACTIVATED',
      entity: 'AttributeDefinition',
      entityId: id,
      userId: actorId ?? null,
    });
    return { message: 'Attribute deactivated successfully' };
  }
}
