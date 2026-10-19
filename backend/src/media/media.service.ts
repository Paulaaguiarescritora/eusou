import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
const sharp = require('sharp');
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { Media } from '@prisma/client';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product)
      throw new NotFoundException(`Product "${productId}" not found`);
    return product;
  }

  private async assertVariantBelongsToProduct(
    variantId: string,
    productId: string,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new BadRequestException(
        `Variant "${variantId}" does not belong to product "${productId}"`,
      );
    }
    return variant;
  }

  async create(
    productId: string,
    dto: CreateMediaDto,
    actorId?: string,
  ): Promise<Media> {
    await this.assertProductExists(productId);

    if (dto.variantId) {
      await this.assertVariantBelongsToProduct(dto.variantId, productId);
    }

    // If isPrimary=true, unset other primary for same context
    if (dto.isPrimary) {
      await this.prisma.media.updateMany({
        where: { productId, variantId: dto.variantId || null, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const media = await this.prisma.media.create({
      data: {
        productId,
        variantId: dto.variantId || null,
        type: dto.type,
        url: dto.url.trim(),
        altText: dto.altText?.trim() || null,
        title: dto.title?.trim() || null,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : 0,
        isPrimary: dto.isPrimary || false,
      },
    });

    await this.auditLog.log({
      action: 'MEDIA_CREATED',
      entity: 'Media',
      entityId: media.id,
      userId: actorId ?? null,
      metadata: {
        productId,
        variantId: dto.variantId || null,
        type: dto.type,
        url: dto.url,
      },
    });

    return media;
  }

  async findAll(productId: string): Promise<Media[]> {
    await this.assertProductExists(productId);
    return this.prisma.media.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async update(
    productId: string,
    mediaId: string,
    dto: UpdateMediaDto,
    actorId?: string,
  ): Promise<Media> {
    await this.assertProductExists(productId);

    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, productId },
    });
    if (!media)
      throw new NotFoundException(
        `Media "${mediaId}" not found for product "${productId}"`,
      );

    if (dto.variantId !== undefined && dto.variantId !== null) {
      await this.assertVariantBelongsToProduct(dto.variantId, productId);
    }

    const updateData: any = {};
    const updatedFields: string[] = [];

    if (dto.type !== undefined) {
      updateData.type = dto.type;
      updatedFields.push('type');
    }
    if (dto.url !== undefined) {
      updateData.url = dto.url.trim();
      updatedFields.push('url');
    }
    if (dto.altText !== undefined) {
      updateData.altText = dto.altText?.trim() || null;
      updatedFields.push('altText');
    }
    if (dto.title !== undefined) {
      updateData.title = dto.title?.trim() || null;
      updatedFields.push('title');
    }
    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = dto.sortOrder;
      updatedFields.push('sortOrder');
    }
    if (dto.variantId !== undefined) {
      updateData.variantId = dto.variantId || null;
      updatedFields.push('variantId');
    }

    if (dto.isPrimary !== undefined) {
      if (dto.isPrimary) {
        // Determine effective variantId for context
        const effectiveVariantId =
          dto.variantId !== undefined ? dto.variantId || null : media.variantId;
        await this.prisma.media.updateMany({
          where: {
            productId,
            variantId: effectiveVariantId,
            isPrimary: true,
            id: { not: mediaId },
          },
          data: { isPrimary: false },
        });
      }
      updateData.isPrimary = dto.isPrimary;
      updatedFields.push('isPrimary');
    }

    const updated = await this.prisma.media.update({
      where: { id: mediaId },
      data: updateData,
    });

    await this.auditLog.log({
      action: 'MEDIA_UPDATED',
      entity: 'Media',
      entityId: mediaId,
      userId: actorId ?? null,
      metadata: { productId, updatedFields },
    });

    return updated;
  }

  async delete(
    productId: string,
    mediaId: string,
    actorId?: string,
  ): Promise<{ message: string }> {
    await this.assertProductExists(productId);
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, productId },
    });
    if (!media)
      throw new NotFoundException(
        `Media "${mediaId}" not found for product "${productId}"`,
      );

    await this.prisma.media.delete({ where: { id: mediaId } });

    await this.auditLog.log({
      action: 'MEDIA_DELETED',
      entity: 'Media',
      entityId: mediaId,
      userId: actorId ?? null,
      metadata: { productId },
    });

    return { message: 'Media deleted successfully' };
  }

  async uploadBase64(
    productId: string,
    fileBase64: string,
    originalName?: string,
    isPrimary: boolean = false,
    actorId?: string,
  ): Promise<Media> {
    await this.assertProductExists(productId);

    // Parse mime type and buffer
    const matches = fileBase64.match(/^data:([A-Za-z-+/_]+);base64,(.+)$/);
    let buffer: Buffer;
    let originalExt = 'jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) originalExt = 'png';
      else if (mime.includes('jpeg')) originalExt = 'jpeg';
      else if (mime.includes('jpg')) originalExt = 'jpg';
      else if (mime.includes('gif')) originalExt = 'gif';
      else if (mime.includes('webp')) originalExt = 'webp';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(fileBase64, 'base64');
    }

    if (originalName) {
      const matchExt = originalName.match(/\.([a-zA-Z0-9]+)$/);
      if (matchExt) {
        const foundExt = matchExt[1].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(foundExt)) {
          originalExt = foundExt;
        }
      }
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const baseName = `${productId}-${timestamp}-${randomSuffix}`;

    // 1. Salvar o arquivo original preservado no disco (sem apagar)
    const originalFileName = `${baseName}-orig.${originalExt}`;
    const originalFilePath = path.join(uploadsDir, originalFileName);
    fs.writeFileSync(originalFilePath, buffer);

    // 2. Converter para WebP com qualidade 85%, preservando dimensões originais e transparência
    const webpFileName = `${baseName}.webp`;
    const webpFilePath = path.join(uploadsDir, webpFileName);

    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err: any) {
      this.logger.warn(
        `Erro ao converter imagem para WebP: ${err.message}. Mantendo buffer original como fallback.`,
      );
      webpBuffer = buffer;
    }

    fs.writeFileSync(webpFilePath, webpBuffer);

    // 3. Montar URL pública da versão WebP utilizada pelo produto
    const port = process.env.PORT || 3000;
    const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
    const publicUrl = `${baseUrl}/uploads/products/${webpFileName}`;

    return this.create(
      productId,
      {
        url: publicUrl,
        type: 'IMAGE',
        isPrimary,
        altText: originalName || undefined,
        title: originalFileName,
      },
      actorId,
    );
  }
}
