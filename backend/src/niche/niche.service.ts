import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateNicheDto } from './dto/create-niche.dto';
import { UpdateNicheDto } from './dto/update-niche.dto';
import { QueryNichesDto } from './dto/query-niches.dto';
import { Niche, NicheStatus } from '@prisma/client';
import { generateSlug } from '../product/utils/slug.util';

@Injectable()
export class NicheService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateNicheDto, actorId?: string): Promise<Niche> {
    const slug = dto.slug?.trim() || generateSlug(dto.name);

    const existing = await this.prisma.niche.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Niche with slug "${slug}" already exists`);
    }

    const niche = await this.prisma.niche.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        status: dto.status || NicheStatus.ACTIVE,
      },
    });

    await this.auditLog.log({
      action: 'NICHE_CREATED',
      entity: 'Niche',
      entityId: niche.id,
      userId: actorId ?? null,
      metadata: { name: niche.name, slug: niche.slug },
    });

    return niche;
  }

  async findAll(query: QueryNichesDto) {
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
      this.prisma.niche.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          categories: {
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              _count: { select: { products: true } },
            },
          },
          _count: {
            select: { categories: true, products: true },
          },
        },
      }),
      this.prisma.niche.count({ where }),
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

  async findById(id: string): Promise<Niche> {
    const niche = await this.prisma.niche.findUnique({
      where: { id },
      include: {
        categories: true,
        _count: {
          select: { products: true },
        },
      },
    });
    if (!niche) {
      throw new NotFoundException(`Niche "${id}" not found`);
    }
    return niche;
  }

  async update(
    id: string,
    dto: UpdateNicheDto,
    actorId?: string,
  ): Promise<Niche> {
    const niche = await this.findById(id);

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
      if (targetSlug !== niche.slug) {
        const existing = await this.prisma.niche.findUnique({
          where: { slug: targetSlug },
        });
        if (existing) {
          throw new ConflictException(
            `Niche with slug "${targetSlug}" already exists`,
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

    const updated = await this.prisma.niche.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'NICHE_UPDATED',
      entity: 'Niche',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { updatedFields },
    });

    return updated;
  }

  async delete(id: string, actorId?: string): Promise<{ message: string }> {
    await this.findById(id);

    await this.prisma.niche.update({
      where: { id },
      data: { status: NicheStatus.INACTIVE },
    });

    await this.auditLog.log({
      action: 'NICHE_DEACTIVATED',
      entity: 'Niche',
      entityId: id,
      userId: actorId ?? null,
    });

    return { message: 'Niche deactivated successfully' };
  }
}
