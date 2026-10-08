import { Test, TestingModule } from '@nestjs/testing';
import { VariantService } from './variant.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('VariantService', () => {
  let service: VariantService;
  let prisma: any;
  let auditLog: any;

  const mockVariants: any[] = [];
  const mockVavs: any[] = [];
  const mockPavs: any[] = [
    {
      id: 'pav-p',
      productId: 'prod-1',
      attributeDefinitionId: 'def-tam',
      value: 'P',
    },
    {
      id: 'pav-m',
      productId: 'prod-1',
      attributeDefinitionId: 'def-tam',
      value: 'M',
    },
    {
      id: 'pav-azul',
      productId: 'prod-1',
      attributeDefinitionId: 'def-cor',
      value: 'Azul',
    },
    {
      id: 'pav-outro',
      productId: 'prod-2',
      attributeDefinitionId: 'def-cor',
      value: 'Azul',
    },
  ];
  const mockAuditLogs: any[] = [];

  beforeEach(async () => {
    mockVariants.length = 0;
    mockVavs.length = 0;
    mockAuditLogs.length = 0;

    prisma = {
      product: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === 'prod-1' ? { id: 'prod-1' } : null,
        ),
      },
      productAttributeValue: {
        findFirst: jest.fn(async ({ where }) => {
          return (
            mockPavs.find(
              (p) =>
                p.id === where.id &&
                (!where.productId || p.productId === where.productId),
            ) || null
          );
        }),
      },
      productVariant: {
        findUnique: jest.fn(
          async ({ where }) =>
            mockVariants.find((v) => v.sku === where.sku) || null,
        ),
        findFirst: jest.fn(async ({ where }) => {
          const v = mockVariants.find(
            (item) =>
              item.id === where.id && item.productId === where.productId,
          );
          if (!v) return null;
          return {
            ...v,
            variantAttributeValues: mockVavs
              .filter((vav) => vav.variantId === v.id)
              .map((vav) => ({
                ...vav,
                productAttributeValue: mockPavs.find(
                  (p) => p.id === vav.productAttributeValueId,
                ),
              })),
          };
        }),
        findMany: jest.fn(async ({ where }) => {
          let list = mockVariants.filter(
            (v) => v.productId === where.productId,
          );
          if (where.id?.not) list = list.filter((v) => v.id !== where.id.not);
          return list.map((v) => ({
            ...v,
            variantAttributeValues: mockVavs
              .filter((vav) => vav.variantId === v.id)
              .map((vav) => ({
                ...vav,
                productAttributeValue: mockPavs.find(
                  (p) => p.id === vav.productAttributeValueId,
                ),
              })),
          }));
        }),
        create: jest.fn(async ({ data }) => {
          const variant = {
            id: `var-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockVariants.push(variant);
          return { ...variant };
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = mockVariants.findIndex((v) => v.id === where.id);
          if (idx === -1) return null;
          const updated = {
            ...mockVariants[idx],
            ...data,
            updatedAt: new Date(),
          };
          mockVariants[idx] = updated;
          return { ...updated };
        }),
      },
      variantAttributeValue: {
        findFirst: jest.fn(
          async ({ where }) =>
            mockVavs.find(
              (vav) => vav.id === where.id && vav.variantId === where.variantId,
            ) || null,
        ),
        create: jest.fn(async ({ data }) => {
          const vav = { id: `vav-${Date.now()}-${Math.random()}`, ...data };
          mockVavs.push(vav);
          return { ...vav };
        }),
        delete: jest.fn(async ({ where }) => {
          const idx = mockVavs.findIndex((vav) => vav.id === where.id);
          if (idx !== -1) mockVavs.splice(idx, 1);
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
        VariantService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<VariantService>(VariantService);
  });

  describe('create & update variant', () => {
    it('should create a variant and log audit', async () => {
      const v = await service.create(
        'prod-1',
        { name: 'P / Azul', sku: 'SKU-P-AZUL' },
        'admin',
      );
      expect(v.sku).toBe('SKU-P-AZUL');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VARIANT_CREATED' }),
      );
    });

    it('should reject duplicate variant sku', async () => {
      await service.create('prod-1', { sku: 'SKU-DUP' });
      await expect(
        service.create('prod-1', { sku: 'SKU-DUP' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should soft delete variant', async () => {
      const v = await service.create('prod-1', { sku: 'SKU-DEL' });
      const res = await service.delete('prod-1', v.id, 'admin');
      expect(res.message).toBe('Variant deactivated successfully');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VARIANT_DEACTIVATED' }),
      );
    });
  });

  describe('variant attribute values', () => {
    it('should add attribute to variant', async () => {
      const v = await service.create('prod-1', { sku: 'SKU-V1' });
      const vav = await service.addAttribute('prod-1', v.id, 'pav-p', 'admin');
      expect(vav.productAttributeValueId).toBe('pav-p');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VARIANT_ATTRIBUTE_ADDED' }),
      );
    });

    it('should reject PAV that belongs to another product', async () => {
      const v = await service.create('prod-1', { sku: 'SKU-V2' });
      await expect(
        service.addAttribute('prod-1', v.id, 'pav-outro'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate attribute definition in same variant', async () => {
      const v = await service.create('prod-1', { sku: 'SKU-V3' });
      await service.addAttribute('prod-1', v.id, 'pav-p');
      await expect(
        service.addAttribute('prod-1', v.id, 'pav-m'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject two variants having identical attribute combinations', async () => {
      const v1 = await service.create('prod-1', { sku: 'SKU-COMB-1' });
      await service.addAttribute('prod-1', v1.id, 'pav-p');

      const v2 = await service.create('prod-1', { sku: 'SKU-COMB-2' });
      await expect(
        service.addAttribute('prod-1', v2.id, 'pav-p'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
