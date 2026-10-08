import { Test, TestingModule } from '@nestjs/testing';
import { CollectionService } from './collection.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConflictException } from '@nestjs/common';
import { CollectionStatus } from '@prisma/client';

describe('CollectionService', () => {
  let service: CollectionService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      collection: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      collectionItem: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
  });

  describe('create', () => {
    it('should create a collection and log audit event', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      const created = {
        id: 'col-1',
        name: 'Mais Vendidos',
        slug: 'mais-vendidos',
        status: CollectionStatus.DRAFT,
      };
      prisma.collection.create.mockResolvedValue(created);

      const result = await service.create({ name: 'Mais Vendidos' }, 'admin-1');
      expect(result).toEqual(created);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COLLECTION_CREATED',
          entityId: 'col-1',
        }),
      );
    });

    it('should throw ConflictException if slug exists', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create({ name: 'Mais Vendidos' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('addProduct & prevent duplicate', () => {
    it('should add a product with position', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'col-1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.collectionItem.findUnique.mockResolvedValue(null);
      prisma.collectionItem.findFirst.mockResolvedValue(null);
      prisma.collectionItem.create.mockResolvedValue({
        id: 'ci-1',
        collectionId: 'col-1',
        productId: 'p1',
        position: 0,
      });

      const item = await service.addProduct(
        'col-1',
        { productId: 'p1' },
        'admin-1',
      );
      expect(item.position).toBe(0);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COLLECTION_PRODUCT_ADDED' }),
      );
    });

    it('should throw ConflictException if product already in collection', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'col-1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.collectionItem.findUnique.mockResolvedValue({
        id: 'item-existing',
      });

      await expect(
        service.addProduct('col-1', { productId: 'p1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('duplicate', () => {
    it('should duplicate collection with its items', async () => {
      const original = {
        id: 'col-1',
        name: 'Coleção Original',
        slug: 'colecao-original',
        items: [{ productId: 'p1', position: 0 }],
      };
      prisma.collection.findUnique
        .mockResolvedValueOnce(original) // findById
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce({ ...original, id: 'col-copy' }); // findById after create

      prisma.collection.create.mockResolvedValue({ id: 'col-copy' });

      const copy = await service.duplicate('col-1', 'admin-1');
      expect(copy.id).toBe('col-copy');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COLLECTION_DUPLICATED' }),
      );
    });
  });
});
