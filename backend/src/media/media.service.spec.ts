import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { BadRequestException } from '@nestjs/common';
import { MediaType } from '@prisma/client';

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
});
