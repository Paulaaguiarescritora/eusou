import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CatalogStatus, CatalogType, CatalogRuleType } from '@prisma/client';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      niche: { findUnique: jest.fn() },
      theme: { findUnique: jest.fn() },
      product: { findUnique: jest.fn(), findMany: jest.fn() },
      collection: { findUnique: jest.fn() },
      catalog: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      catalogItem: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
      catalogCollection: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
      catalogRule: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('create', () => {
    it('should create a manual catalog', async () => {
      prisma.catalog.findUnique.mockResolvedValue(null);
      const createdCatalog = {
        id: 'cat-1',
        name: 'Catálogo de Natal',
        slug: 'catalogo-de-natal',
        type: CatalogType.MANUAL,
        status: CatalogStatus.DRAFT,
      };
      prisma.catalog.create.mockResolvedValue(createdCatalog);

      const result = await service.create(
        { name: 'Catálogo de Natal' },
        'admin-1',
      );
      expect(result).toEqual(createdCatalog);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CATALOG_CREATED',
          entityId: 'cat-1',
        }),
      );
    });

    it('should create an automatic catalog with rules', async () => {
      prisma.catalog.findUnique.mockResolvedValue(null);
      const createdCatalog = {
        id: 'cat-auto-1',
        name: 'Catálogo Automático',
        slug: 'catalogo-automatico',
        type: CatalogType.AUTOMATIC,
        status: CatalogStatus.ACTIVE,
        rules: [{ type: CatalogRuleType.NICHE, value: 'niche-1' }],
      };
      prisma.catalog.create.mockResolvedValue(createdCatalog);

      const result = await service.create(
        {
          name: 'Catálogo Automático',
          type: CatalogType.AUTOMATIC,
          status: CatalogStatus.ACTIVE,
          rules: [{ type: CatalogRuleType.NICHE, value: 'niche-1' }],
        },
        'admin-1',
      );
      expect(result.type).toBe(CatalogType.AUTOMATIC);
      expect(prisma.catalog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: CatalogType.AUTOMATIC,
            rules: {
              create: [{ type: CatalogRuleType.NICHE, value: 'niche-1' }],
            },
          }),
        }),
      );
    });
  });

  describe('resolveProducts', () => {
    it('should return manual catalog items for MANUAL type', async () => {
      const mockCatalog = {
        id: 'cat-1',
        type: CatalogType.MANUAL,
        items: [
          {
            productId: 'p1',
            position: 0,
            product: { id: 'p1', name: 'Prod 1' },
          },
        ],
      };
      prisma.catalog.findUnique.mockResolvedValue(mockCatalog);

      const products = await service.resolveProducts('cat-1');
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe('p1');
    });

    it('should query products matching rules for AUTOMATIC type', async () => {
      const mockCatalog = {
        id: 'cat-auto',
        type: CatalogType.AUTOMATIC,
        rules: [{ type: 'NICHE', value: 'niche-1' }],
      };
      prisma.catalog.findUnique.mockResolvedValue(mockCatalog);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Auto Prod' },
      ]);

      const products = await service.resolveProducts('cat-auto');
      expect(products).toHaveLength(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          OR: [{ niches: { some: { nicheId: 'niche-1' } } }],
        },
        include: {
          media: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
          },
        },
      });
    });
  });

  describe('addProduct & duplicate prevention', () => {
    it('should add a product with position', async () => {
      prisma.catalog.findUnique.mockResolvedValue({
        id: 'cat-1',
        type: CatalogType.MANUAL,
      });
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.catalogItem.findUnique.mockResolvedValue(null);
      prisma.catalogItem.findFirst.mockResolvedValue(null);
      prisma.catalogItem.create.mockResolvedValue({
        id: 'item-1',
        catalogId: 'cat-1',
        productId: 'p1',
        position: 0,
      });

      const item = await service.addProduct(
        'cat-1',
        { productId: 'p1' },
        'admin-1',
      );
      expect(item.position).toBe(0);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CATALOG_PRODUCT_ADDED' }),
      );
    });

    it('should throw ConflictException if product already in catalog', async () => {
      prisma.catalog.findUnique.mockResolvedValue({
        id: 'cat-1',
        type: CatalogType.MANUAL,
      });
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.catalogItem.findUnique.mockResolvedValue({ id: 'existing-item' });

      await expect(
        service.addProduct('cat-1', { productId: 'p1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if adding manual product to AUTOMATIC catalog', async () => {
      prisma.catalog.findUnique.mockResolvedValue({
        id: 'cat-1',
        type: CatalogType.AUTOMATIC,
      });

      await expect(
        service.addProduct('cat-1', { productId: 'p1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('duplicate', () => {
    it('should duplicate a catalog with items, collections and rules', async () => {
      const original = {
        id: 'cat-1',
        name: 'Catálogo Base',
        slug: 'catalogo-base',
        type: CatalogType.MANUAL,
        status: CatalogStatus.ACTIVE,
        items: [{ productId: 'p1', position: 0 }],
        collections: [{ collectionId: 'col-1', position: 0 }],
        rules: [],
      };
      prisma.catalog.findUnique
        .mockResolvedValueOnce(original) // findById
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce({ ...original, id: 'cat-copy' }); // findById after create

      prisma.catalog.create.mockResolvedValue({ id: 'cat-copy' });

      const copy = await service.duplicate('cat-1', 'admin-1');
      expect(copy.id).toBe('cat-copy');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CATALOG_DUPLICATED' }),
      );
    });
  });
});
