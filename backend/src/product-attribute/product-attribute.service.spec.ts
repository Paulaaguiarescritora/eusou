import { Test, TestingModule } from '@nestjs/testing';
import { ProductAttributeService } from './product-attribute.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('ProductAttributeService', () => {
  let service: ProductAttributeService;
  let prisma: any;
  let auditLog: any;

  const mockProducts = [{ id: 'prod-1', name: 'Camiseta' }];
  const mockDefs = [
    { id: 'def-cor', name: 'Cor', isActive: true },
    { id: 'def-inativa', name: 'Inativa', isActive: false },
  ];
  const mockPavs: any[] = [];
  const mockAuditLogs: any[] = [];

  beforeEach(async () => {
    mockPavs.length = 0;
    mockAuditLogs.length = 0;

    prisma = {
      product: {
        findUnique: jest.fn(
          async ({ where }) =>
            mockProducts.find((p) => p.id === where.id) || null,
        ),
      },
      attributeDefinition: {
        findUnique: jest.fn(
          async ({ where }) => mockDefs.find((d) => d.id === where.id) || null,
        ),
      },
      productAttributeValue: {
        findFirst: jest.fn(async ({ where }) => {
          return (
            mockPavs.find((pav) => {
              if (where.id && pav.id !== where.id) return false;
              if (where.productId && pav.productId !== where.productId)
                return false;
              if (
                where.attributeDefinitionId &&
                pav.attributeDefinitionId !== where.attributeDefinitionId
              )
                return false;
              if (where.value && pav.value !== where.value) return false;
              if (where.NOT?.id && pav.id === where.NOT.id) return false;
              return true;
            }) || null
          );
        }),
        findMany: jest.fn(async ({ where }) =>
          mockPavs.filter((p) => p.productId === where.productId),
        ),
        create: jest.fn(async ({ data }) => {
          const pav = {
            id: `pav-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockPavs.push(pav);
          return { ...pav };
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = mockPavs.findIndex((p) => p.id === where.id);
          if (idx === -1) return null;
          const updated = { ...mockPavs[idx], ...data, updatedAt: new Date() };
          mockPavs[idx] = updated;
          return { ...updated };
        }),
        delete: jest.fn(async ({ where }) => {
          const idx = mockPavs.findIndex((p) => p.id === where.id);
          if (idx !== -1) mockPavs.splice(idx, 1);
          return {};
        }),
      },
      variantAttributeValue: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
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
        ProductAttributeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<ProductAttributeService>(ProductAttributeService);
  });

  it('should create product attribute value', async () => {
    const pav = await service.create(
      'prod-1',
      { attributeDefinitionId: 'def-cor', value: 'Azul' },
      'admin',
    );
    expect(pav.value).toBe('Azul');
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_ATTRIBUTE_CREATED' }),
    );
  });

  it('should fail when product does not exist', async () => {
    await expect(
      service.create('prod-404', {
        attributeDefinitionId: 'def-cor',
        value: 'Azul',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should fail when attribute definition is inactive', async () => {
    await expect(
      service.create('prod-1', {
        attributeDefinitionId: 'def-inativa',
        value: 'Valor',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject duplicate value for same definition and product', async () => {
    await service.create('prod-1', {
      attributeDefinitionId: 'def-cor',
      value: 'Azul',
    });
    await expect(
      service.create('prod-1', {
        attributeDefinitionId: 'def-cor',
        value: 'Azul',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should delete product attribute value and log audit', async () => {
    const pav = await service.create('prod-1', {
      attributeDefinitionId: 'def-cor',
      value: 'Vermelho',
    });
    const res = await service.delete('prod-1', pav.id, 'admin');
    expect(res.message).toBe('Product attribute deleted successfully');
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_ATTRIBUTE_DELETED' }),
    );
  });
});
