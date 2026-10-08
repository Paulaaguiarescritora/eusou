import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { QueryThemesDto } from './dto/query-themes.dto';
import { Theme, ThemeStatus } from '@prisma/client';
import { generateSlug } from '../product/utils/slug.util';

export const THEME_PRESETS = [
  {
    name: 'Minimalista',
    slug: 'preset-minimalista',
    description: 'Design limpo, espaçoso e com foco total nos produtos.',
    primaryColor: '#111827',
    secondaryColor: '#f9fafb',
    font: 'Inter',
    buttonStyle: 'rounded-md',
    cardStyle: 'flat',
    bannerStyle: 'contained',
    productsPerRow: 4,
    showCategories: true,
    showHighlights: true,
    showNewProducts: true,
    showOffers: false,
    isPreset: true,
  },
  {
    name: 'Premium',
    slug: 'preset-premium',
    description: 'Estética sofisticada com tons escuros e dourados elegantes.',
    primaryColor: '#1a1a1a',
    secondaryColor: '#d4af37',
    font: 'Playfair Display',
    buttonStyle: 'sharp',
    cardStyle: 'bordered',
    bannerStyle: 'full-width',
    productsPerRow: 3,
    showCategories: true,
    showHighlights: true,
    showNewProducts: true,
    showOffers: true,
    isPreset: true,
  },
  {
    name: 'Moderno',
    slug: 'preset-moderno',
    description: 'Visual contemporâneo, vibrante e adaptado para mobile-first.',
    primaryColor: '#2563eb',
    secondaryColor: '#ffffff',
    font: 'Poppins',
    buttonStyle: 'full-rounded',
    cardStyle: 'elevated',
    bannerStyle: 'full-width',
    productsPerRow: 4,
    showCategories: true,
    showHighlights: true,
    showNewProducts: true,
    showOffers: true,
    isPreset: true,
  },
  {
    name: 'Colorido',
    slug: 'preset-colorido',
    description:
      'Alegre, dinâmico e convidativo para públicos jovens e criativos.',
    primaryColor: '#ec4899',
    secondaryColor: '#fef08a',
    font: 'Nunito',
    buttonStyle: 'full-rounded',
    cardStyle: 'elevated',
    bannerStyle: 'contained',
    productsPerRow: 4,
    showCategories: true,
    showHighlights: true,
    showNewProducts: true,
    showOffers: true,
    isPreset: true,
  },
  {
    name: 'Editorial',
    slug: 'preset-editorial',
    description:
      'Estilo revista de moda/lifestyle com tipografia refinada e cards amplos.',
    primaryColor: '#0f172a',
    secondaryColor: '#f1f5f9',
    font: 'Lora',
    buttonStyle: 'sharp',
    cardStyle: 'flat',
    bannerStyle: 'split',
    productsPerRow: 2,
    showCategories: true,
    showHighlights: true,
    showNewProducts: false,
    showOffers: false,
    isPreset: true,
  },
];

@Injectable()
export class ThemeService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async onModuleInit() {
    await this.seedPresets();
  }

  async seedPresets() {
    for (const preset of THEME_PRESETS) {
      await this.prisma.theme.upsert({
        where: { slug: preset.slug },
        update: {},
        create: preset,
      });
    }
  }

  async create(dto: CreateThemeDto, actorId?: string): Promise<Theme> {
    const slug = dto.slug?.trim() || generateSlug(dto.name);

    const existing = await this.prisma.theme.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Theme with slug "${slug}" already exists`);
    }

    const theme = await this.prisma.theme.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        status: dto.status || ThemeStatus.ACTIVE,
        logo: dto.logo || null,
        primaryColor: dto.primaryColor || '#000000',
        secondaryColor: dto.secondaryColor || '#ffffff',
        font: dto.font || 'Inter',
        buttonStyle: dto.buttonStyle || 'rounded',
        cardStyle: dto.cardStyle || 'elevated',
        bannerStyle: dto.bannerStyle || 'full-width',
        productsPerRow: dto.productsPerRow || 4,
        showCategories:
          dto.showCategories !== undefined ? dto.showCategories : true,
        showHighlights:
          dto.showHighlights !== undefined ? dto.showHighlights : true,
        showNewProducts:
          dto.showNewProducts !== undefined ? dto.showNewProducts : true,
        showOffers: dto.showOffers !== undefined ? dto.showOffers : true,
        isPreset: dto.isPreset !== undefined ? dto.isPreset : false,
      },
    });

    await this.auditLog.log({
      action: 'THEME_CREATED',
      entity: 'Theme',
      entityId: theme.id,
      userId: actorId ?? null,
      metadata: { name: theme.name, slug: theme.slug },
    });

    return theme;
  }

  async duplicate(id: string, actorId?: string): Promise<Theme> {
    const original = await this.findById(id);

    const baseName = `${original.name} (Cópia)`;
    let targetSlug = `${original.slug}-copia`;
    let counter = 1;

    while (
      await this.prisma.theme.findUnique({ where: { slug: targetSlug } })
    ) {
      counter++;
      targetSlug = `${original.slug}-copia-${counter}`;
    }

    const duplicated = await this.prisma.theme.create({
      data: {
        name: baseName,
        slug: targetSlug,
        description: original.description,
        status: ThemeStatus.ACTIVE,
        logo: original.logo,
        primaryColor: original.primaryColor,
        secondaryColor: original.secondaryColor,
        font: original.font,
        buttonStyle: original.buttonStyle,
        cardStyle: original.cardStyle,
        bannerStyle: original.bannerStyle,
        productsPerRow: original.productsPerRow,
        showCategories: original.showCategories,
        showHighlights: original.showHighlights,
        showNewProducts: original.showNewProducts,
        showOffers: original.showOffers,
        isPreset: false, // Duplicates are never presets
      },
    });

    await this.auditLog.log({
      action: 'THEME_DUPLICATED',
      entity: 'Theme',
      entityId: duplicated.id,
      userId: actorId ?? null,
      metadata: { originalId: original.id, slug: duplicated.slug },
    });

    return duplicated;
  }

  async findAll(query: QueryThemesDto) {
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
    if (query.isPreset !== undefined) {
      where.isPreset = query.isPreset;
    }

    const [data, total] = await Promise.all([
      this.prisma.theme.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.theme.count({ where }),
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

  async findById(id: string): Promise<Theme> {
    const theme = await this.prisma.theme.findUnique({
      where: { id },
    });
    if (!theme) {
      throw new NotFoundException(`Theme "${id}" not found`);
    }
    return theme;
  }

  async update(
    id: string,
    dto: UpdateThemeDto,
    actorId?: string,
  ): Promise<Theme> {
    const theme = await this.findById(id);

    const updateData: any = {};
    const updatedFields: string[] = [];

    const scalarFields: (keyof UpdateThemeDto)[] = [
      'name',
      'description',
      'status',
      'logo',
      'primaryColor',
      'secondaryColor',
      'font',
      'buttonStyle',
      'cardStyle',
      'bannerStyle',
      'productsPerRow',
      'showCategories',
      'showHighlights',
      'showNewProducts',
      'showOffers',
      'isPreset',
    ];

    for (const field of scalarFields) {
      if (dto[field] !== undefined) {
        updateData[field] = dto[field];
        updatedFields.push(field);
      }
    }

    if (dto.slug !== undefined) {
      const targetSlug = dto.slug.trim();
      if (targetSlug !== theme.slug) {
        const existing = await this.prisma.theme.findUnique({
          where: { slug: targetSlug },
        });
        if (existing) {
          throw new ConflictException(
            `Theme with slug "${targetSlug}" already exists`,
          );
        }
        updateData.slug = targetSlug;
        updatedFields.push('slug');
      }
    }

    const updated = await this.prisma.theme.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'THEME_UPDATED',
      entity: 'Theme',
      entityId: updated.id,
      userId: actorId ?? null,
      metadata: { updatedFields },
    });

    return updated;
  }

  async delete(id: string, actorId?: string): Promise<{ message: string }> {
    await this.findById(id);

    await this.prisma.theme.update({
      where: { id },
      data: { status: ThemeStatus.INACTIVE },
    });

    await this.auditLog.log({
      action: 'THEME_DEACTIVATED',
      entity: 'Theme',
      entityId: id,
      userId: actorId ?? null,
    });

    return { message: 'Theme deactivated successfully' };
  }
}
