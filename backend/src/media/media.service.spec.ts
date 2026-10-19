import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { BadRequestException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
const sharp = require('sharp');

describe('MediaService', () => {
  let service: MediaService;
  let prisma: any;
  let auditLog: any;

  const mockMedia: any[] = [];
  const mockAuditLogs: any[] = [];

  beforeEach(async () => {
    mockMedia.length = 0;
    mockAuditLogs.length = 0;

    prisma = {
      product: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === 'prod-1' ? { id: 'prod-1' } : null,
        ),
      },
      productVariant: {
        findFirst: jest.fn(async ({ where }) =>
          where.id === 'var-1' && where.productId === 'prod-1'
            ? { id: 'var-1' }
            : null,
        ),
      },
      media: {
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `med-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockMedia.push(item);
          return { ...item };
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0;
          for (const m of mockMedia) {
            if (
              m.productId === where.productId &&
              m.variantId === where.variantId &&
              (!where.id?.not || m.id !== where.id.not)
            ) {
              Object.assign(m, data);
              count++;
            }
          }
          return { count };
        }),
        findMany: jest.fn(async ({ where }) =>
          mockMedia.filter((m) => m.productId === where.productId),
        ),
        findFirst: jest.fn(
          async ({ where }) =>
            mockMedia.find(
              (m) => m.id === where.id && m.productId === where.productId,
            ) || null,
        ),
        update: jest.fn(async ({ where, data }) => {
          const idx = mockMedia.findIndex((m) => m.id === where.id);
          if (idx === -1) return null;
          const updated = { ...mockMedia[idx], ...data, updatedAt: new Date() };
          mockMedia[idx] = updated;
          return { ...updated };
        }),
        delete: jest.fn(async ({ where }) => {
          const idx = mockMedia.findIndex((m) => m.id === where.id);
          if (idx !== -1) mockMedia.splice(idx, 1);
          return {};
        }),
      },
    };

    auditLog = {
      log: jest.fn(async (entry) => {
        mockAuditLogs.push(entry);
        return entry;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it('should create media and log audit', async () => {
    const media = await service.create(
      'prod-1',
      {
        type: MediaType.IMAGE,
        url: 'https://example.com/img1.jpg',
        isPrimary: true,
      },
      'admin',
    );
    expect(media.url).toBe('https://example.com/img1.jpg');
    expect(media.isPrimary).toBe(true);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEDIA_CREATED' }),
    );
  });

  it('should reject media for variant of another product', async () => {
    await expect(
      service.create('prod-1', {
        type: MediaType.IMAGE,
        url: 'https://example.com/img2.jpg',
        variantId: 'var-999',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update media and set isPrimary', async () => {
    const m1 = await service.create('prod-1', {
      type: MediaType.IMAGE,
      url: 'https://example.com/1.jpg',
      isPrimary: true,
    });
    const m2 = await service.create('prod-1', {
      type: MediaType.IMAGE,
      url: 'https://example.com/2.jpg',
      isPrimary: false,
    });

    const updatedM2 = await service.update(
      'prod-1',
      m2.id,
      { isPrimary: true },
      'admin',
    );

    expect(updatedM2.isPrimary).toBe(true);
    const foundM1 = await prisma.media.findFirst({
      where: { id: m1.id, productId: 'prod-1' },
    });
    expect(foundM1.isPrimary).toBe(false);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEDIA_UPDATED' }),
    );
  });

  it('should delete media and log audit', async () => {
    const media = await service.create('prod-1', {
      type: MediaType.IMAGE,
      url: 'https://example.com/delete.jpg',
    });
    const res = await service.delete('prod-1', media.id, 'admin');
    expect(res.message).toBe('Media deleted successfully');
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEDIA_DELETED' }),
    );
  });

  describe('Otimização Automática de Imagens para WebP', () => {
    const createdFilesToClean: string[] = [];

    afterAll(() => {
      // Limpeza de arquivos criados durante os testes
      for (const f of createdFilesToClean) {
        if (fs.existsSync(f)) {
          try {
            fs.unlinkSync(f);
          } catch {
            // ignore
          }
        }
      }
    });

    it('1. Deve converter JPG para WebP mantendo dimensões originais e salvando original', async () => {
      const width = 400;
      const height = 300;
      const jpgBuf = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 120, b: 50 },
        },
      })
        .jpeg({ quality: 90 })
        .toBuffer();

      const base64 = `data:image/jpeg;base64,${jpgBuf.toString('base64')}`;

      const media = await service.uploadBase64(
        'prod-1',
        base64,
        'foto-produto.jpg',
        true,
        'admin-user',
      );

      // Produto deve apontar para a versão WebP
      expect(media.url).toMatch(/\.webp$/);
      expect(media.isPrimary).toBe(true);
      expect(media.title).toMatch(/-orig\.jpg$/);

      // Validar arquivo WebP no disco
      const webpPath = path.join(
        process.cwd(),
        'uploads',
        'products',
        path.basename(media.url),
      );
      createdFilesToClean.push(webpPath);
      expect(fs.existsSync(webpPath)).toBe(true);

      const webpMeta = await sharp(webpPath).metadata();
      expect(webpMeta.format).toBe('webp');
      expect(webpMeta.width).toBe(width);
      expect(webpMeta.height).toBe(height);

      // Validar que o original foi preservado no disco
      const origPath = path.join(
        process.cwd(),
        'uploads',
        'products',
        media.title!,
      );
      createdFilesToClean.push(origPath);
      expect(fs.existsSync(origPath)).toBe(true);

      const origMeta = await sharp(origPath).metadata();
      expect(origMeta.format).toBe('jpeg');
      expect(origMeta.width).toBe(width);
      expect(origMeta.height).toBe(height);
    });

    it('2. Deve converter JPEG para WebP', async () => {
      const width = 250;
      const height = 150;
      const jpegBuf = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 50, g: 150, b: 250 },
        },
      })
        .jpeg()
        .toBuffer();

      const base64 = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;

      const media = await service.uploadBase64(
        'prod-1',
        base64,
        'bolinha.jpeg',
        false,
        'admin-user',
      );

      expect(media.url).toMatch(/\.webp$/);
      const webpPath = path.join(
        process.cwd(),
        'uploads',
        'products',
        path.basename(media.url),
      );
      createdFilesToClean.push(webpPath);
      if (media.title) {
        createdFilesToClean.push(
          path.join(process.cwd(), 'uploads', 'products', media.title),
        );
      }

      const webpMeta = await sharp(webpPath).metadata();
      expect(webpMeta.format).toBe('webp');
      expect(webpMeta.width).toBe(width);
      expect(webpMeta.height).toBe(height);
    });

    it('3. Deve converter PNG para WebP mantendo dimensões', async () => {
      const width = 350;
      const height = 200;
      const pngBuf = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 0, g: 200, b: 100 },
        },
      })
        .png()
        .toBuffer();

      const base64 = `data:image/png;base64,${pngBuf.toString('base64')}`;

      const media = await service.uploadBase64(
        'prod-1',
        base64,
        'logo.png',
        false,
        'admin-user',
      );

      expect(media.url).toMatch(/\.webp$/);
      const webpPath = path.join(
        process.cwd(),
        'uploads',
        'products',
        path.basename(media.url),
      );
      createdFilesToClean.push(webpPath);
      if (media.title) {
        createdFilesToClean.push(
          path.join(process.cwd(), 'uploads', 'products', media.title),
        );
      }

      const webpMeta = await sharp(webpPath).metadata();
      expect(webpMeta.format).toBe('webp');
      expect(webpMeta.width).toBe(width);
      expect(webpMeta.height).toBe(height);
    });

    it('4. Deve preservar canal alfa / transparência ao converter PNG transparente para WebP', async () => {
      const width = 120;
      const height = 120;
      const transparentPngBuf = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.4 },
        },
      })
        .png()
        .toBuffer();

      const base64 = `data:image/png;base64,${transparentPngBuf.toString('base64')}`;

      const media = await service.uploadBase64(
        'prod-1',
        base64,
        'transparente.png',
        false,
      );

      const webpPath = path.join(
        process.cwd(),
        'uploads',
        'products',
        path.basename(media.url),
      );
      createdFilesToClean.push(webpPath);
      if (media.title) {
        createdFilesToClean.push(
          path.join(process.cwd(), 'uploads', 'products', media.title),
        );
      }

      const webpMeta = await sharp(webpPath).metadata();
      expect(webpMeta.format).toBe('webp');
      expect(webpMeta.hasAlpha).toBe(true);
      expect(webpMeta.width).toBe(width);
      expect(webpMeta.height).toBe(height);
    });

    it('5. Imagens antigas criadas diretamente com URL continuam funcionando normalmente', async () => {
      const legacyMedia = await service.create('prod-1', {
        type: MediaType.IMAGE,
        url: 'https://cdn.exemplo.com/antiga.png',
        isPrimary: false,
      });

      expect(legacyMedia.url).toBe('https://cdn.exemplo.com/antiga.png');
      expect(legacyMedia.type).toBe('IMAGE');
    });
  });
});
