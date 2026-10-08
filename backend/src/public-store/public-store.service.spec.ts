import { Test, TestingModule } from '@nestjs/testing';
import { PublicStoreService } from './public-store.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('PublicStoreService', () => {
  let service: PublicStoreService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
      catalog: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      collection: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicStoreService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PublicStoreService>(PublicStoreService);
  });

  describe('getProducts', () => {
    it('should only return ACTIVE products and filter properly', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Ativo', status: 'ACTIVE' },
      ]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.getProducts({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });
  });

  describe('getProductBySlug', () => {
    it('should return product details if ACTIVE', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        slug: 'produto-ativo',
        status: 'ACTIVE',
      });

      const result = await service.getProductBySlug('produto-ativo');
      expect(result.id).toBe('p1');
    });

    it('should throw NotFoundException if not found or not active', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getProductBySlug('produto-inativo')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEmbedProductById', () => {
    it('should return strictly public product details if ACTIVE', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Porta-Chaves Gatinho',
        slug: 'porta-chaves-gatinho',
        sku: 'FEL-GAT-001',
        basePrice: '29.90',
        status: 'ACTIVE',
        media: [{ id: 'm1', url: 'https://img.com/cat.jpg', isPrimary: true }],
        variants: [],
      });

      const result = await service.getEmbedProductById('p1');
      expect(result.id).toBe('p1');
      expect(result.name).toBe('Porta-Chaves Gatinho');
      expect((result as any).productionCost).toBeUndefined();
      expect((result as any).materials).toBeUndefined();
    });

    it('should throw NotFoundException if product is inactive or not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getEmbedProductById('p-inativo')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
