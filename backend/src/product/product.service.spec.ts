import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ProductStatus } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: any;
  let auditLog: any;

  const mockProducts: any[] = [];
  const mockAuditLogs: any[] = [];

  beforeEach(async () => {
    mockProducts.length = 0;
    mockAuditLogs.length = 0;

    prisma = {
      product: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.id)
            return mockProducts.find((p) => p.id === where.id) || null;
          if (where.slug)
            return mockProducts.find((p) => p.slug === where.slug) || null;
          if (where.sku)
            return mockProducts.find((p) => p.sku === where.sku) || null;
          return null;
        }),
        findFirst: jest.fn(async ({ where }) => {
          return (
            mockProducts.find((p) => {
              if (where.id?.not && p.id === where.id.not) return false;
              if (where.slug && p.slug === where.slug) return true;
              if (where.sku && p.sku === where.sku) return true;
              return false;
            }) || null
          );
        }),
        create: jest.fn(async ({ data }) => {
          const product = {
            id: `prod-${Date.now()}-${Math.random()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          mockProducts.push(product);
          return product;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = mockProducts.findIndex((p) => p.id === where.id);
          if (idx === -1) return null;
          // Replace entry in-place with a new object so callers holding the old
          // reference are not retroactively mutated.
          const updated = {
            ...mockProducts[idx],
            ...data,
            updatedAt: new Date(),
          };
          mockProducts[idx] = updated;
          return { ...updated };
        }),
        findMany: jest.fn(async ({ where, skip = 0, take = 10, orderBy }) => {
          let results = [...mockProducts];
          if (where?.name?.contains) {
            const search = where.name.contains.toLowerCase();
            results = results.filter((p) =>
              p.name.toLowerCase().includes(search),
            );
          }
          if (where?.status) {
            results = results.filter((p) => p.status === where.status);
          }
          if (orderBy) {
            const [field, order] = Object.entries(orderBy)[0];
            results.sort((a, b) => {
              if (a[field] < b[field]) return order === 'asc' ? -1 : 1;
              if (a[field] > b[field]) return order === 'asc' ? 1 : -1;
              return 0;
            });
          }
          return results.slice(skip, skip + take);
        }),
        count: jest.fn(async ({ where }) => {
          let results = [...mockProducts];
          if (where?.name?.contains) {
            const search = where.name.contains.toLowerCase();
            results = results.filter((p) =>
              p.name.toLowerCase().includes(search),
            );
          }
          if (where?.status) {
            results = results.filter((p) => p.status === where.status);
          }
          return results.length;
        }),
      },
      productChannel: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      channelProduct: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('create', () => {
    it('should create a product with auto-generated slug from name', async () => {
      const product = await service.create(
        {
          name: 'Porta Chaves Gatinho',
          description: 'Lindo porta chaves em formato de gatinho',
        },
        'admin-user-id',
      );

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe('Porta Chaves Gatinho');
      expect(product.slug).toBe('porta-chaves-gatinho');
      expect(product.status).toBe(ProductStatus.DRAFT);
      expect(product.sku).toBeNull();

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCT_CREATED',
          entity: 'Product',
          entityId: product.id,
          userId: 'admin-user-id',
        }),
      );
    });

    it('should respect explicitly provided slug', async () => {
      const product = await service.create(
        {
          name: 'Produto Especial',
          slug: 'slug-customizado-admin',
        },
        'admin-user-id',
      );

      expect(product.slug).toBe('slug-customizado-admin');
    });

    it('should reject duplicate slug with ConflictException (409)', async () => {
      await service.create({ name: 'Produto Um', slug: 'slug-duplicado' });

      await expect(
        service.create({ name: 'Produto Dois', slug: 'slug-duplicado' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject duplicate SKU with ConflictException (409)', async () => {
      await service.create({ name: 'Produto Um', sku: 'SKU-100' });

      await expect(
        service.create({ name: 'Produto Dois', sku: 'SKU-100' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return product when found', async () => {
      const created = await service.create({ name: 'Produto Buscado' });
      const found = await service.findById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw NotFoundException (404) when product does not exist', async () => {
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should paginate products properly', async () => {
      for (let i = 1; i <= 15; i++) {
        await service.create({ name: `Produto ${i}`, slug: `prod-${i}` });
      }

      const res = await service.findAll({ page: 1, limit: 10 });
      expect(res.data.length).toBe(10);
      expect(res.meta.total).toBe(15);
      expect(res.meta.totalPages).toBe(2);
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(10);
    });

    it('should filter products by search term', async () => {
      await service.create({ name: 'Camiseta Azul', slug: 'cam-azul' });
      await service.create({ name: 'Camiseta Vermelha', slug: 'cam-vermelha' });
      await service.create({ name: 'Caneca Preta', slug: 'can-preta' });

      const res = await service.findAll({ search: 'Camiseta' });
      expect(res.data.length).toBe(2);
      expect(res.meta.total).toBe(2);
    });

    it('should filter products by status', async () => {
      await service.create({
        name: 'Produto Ativo',
        status: ProductStatus.ACTIVE,
        slug: 'p-ativo',
      });
      await service.create({
        name: 'Produto Rascunho',
        status: ProductStatus.DRAFT,
        slug: 'p-rascunho',
      });

      const res = await service.findAll({ status: ProductStatus.ACTIVE });
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe(ProductStatus.ACTIVE);
    });
  });

  describe('update', () => {
    it('should update product fields and log PRODUCT_UPDATED', async () => {
      const created = await service.create(
        { name: 'Nome Original', brand: 'Marca A' },
        'admin-user',
      );

      const updated = await service.update(
        created.id,
        { name: 'Nome Atualizado', brand: 'Marca B' },
        'admin-user',
      );

      expect(updated.name).toBe('Nome Atualizado');
      expect(updated.brand).toBe('Marca B');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCT_UPDATED',
          entity: 'Product',
          entityId: created.id,
        }),
      );
    });

    it('should reject update if slug conflicts with another product', async () => {
      await service.create({ name: 'Produto 1', slug: 'slug-1' });
      const p2 = await service.create({ name: 'Produto 2', slug: 'slug-2' });

      await expect(service.update(p2.id, { slug: 'slug-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject update if SKU conflicts with another product', async () => {
      await service.create({ name: 'Produto 1', sku: 'SKU-001' });
      const p2 = await service.create({ name: 'Produto 2', sku: 'SKU-002' });

      await expect(service.update(p2.id, { sku: 'SKU-001' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should log PRODUCT_STATUS_CHANGED when status changes', async () => {
      const created = await service.create(
        { name: 'Produto Teste', status: ProductStatus.DRAFT },
        'admin-user',
      );

      const updated = await service.update(
        created.id,
        { status: ProductStatus.ACTIVE },
        'admin-user',
      );

      expect(updated.status).toBe(ProductStatus.ACTIVE);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCT_STATUS_CHANGED',
          entity: 'Product',
          metadata: {
            oldStatus: ProductStatus.DRAFT,
            newStatus: ProductStatus.ACTIVE,
          },
        }),
      );
    });
  });

  describe('delete / archive', () => {
    it('should soft delete product by setting status to ARCHIVED and logging audit event', async () => {
      const created = await service.create(
        { name: 'Produto a Arquivar', status: ProductStatus.ACTIVE },
        'admin-user',
      );

      const res = await service.delete(created.id, 'admin-user');
      expect(res.message).toBe('Product archived successfully');

      const archived = await service.findById(created.id);
      expect(archived.status).toBe(ProductStatus.ARCHIVED);

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCT_ARCHIVED',
          entity: 'Product',
          entityId: created.id,
          userId: 'admin-user',
        }),
      );
    });
  });
});
