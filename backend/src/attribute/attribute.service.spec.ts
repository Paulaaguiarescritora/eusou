import { Test, TestingModule } from '@nestjs/testing';
import { AttributeService } from './attribute.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('AttributeService', () => {
  let service: AttributeService;
  let prisma: any;
  let auditLog: any;

  const mockAttrs: any[] = [];
  const mockAuditLogs: any[] = [];

  beforeEach(async () => {
    mockAttrs.length = 0;
    mockAuditLogs.length = 0;

    prisma = {
      attributeDefinition: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.id) return mockAttrs.find((a) => a.id === where.id) || null;
          if (where.slug)
            return mockAttrs.find((a) => a.slug === where.slug) || null;
          return null;
        }),
        create: jest.fn(async ({ data }) => {
          const attr = {
            id: `attr-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAttrs.push(attr);
          return { ...attr };
        }),
        findMany: jest.fn(async ({ where, skip = 0, take = 10 }) => {
          let results = [...mockAttrs];
          if (where?.OR) {
            const search = where.OR[0]?.name?.contains?.toLowerCase();
            if (search)
              results = results.filter(
                (a) =>
                  a.name.toLowerCase().includes(search) ||
                  a.slug.toLowerCase().includes(search),
              );
          }
          if (where?.isActive !== undefined)
            results = results.filter((a) => a.isActive === where.isActive);
          return results.slice(skip, skip + take);
        }),
        count: jest.fn(async ({ where }) => {
          let results = [...mockAttrs];
          if (where?.OR) {
            const search = where.OR[0]?.name?.contains?.toLowerCase();
            if (search)
              results = results.filter((a) =>
                a.name.toLowerCase().includes(search),
              );
          }
          if (where?.isActive !== undefined)
            results = results.filter((a) => a.isActive === where.isActive);
          return results.length;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = mockAttrs.findIndex((a) => a.id === where.id);
          if (idx === -1) return null;
          const updated = { ...mockAttrs[idx], ...data, updatedAt: new Date() };
          mockAttrs[idx] = updated;
          return { ...updated };
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
        AttributeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<AttributeService>(AttributeService);
  });

  describe('create', () => {
    it('should create attribute with auto-generated slug', async () => {
      const attr = await service.create({ name: 'Cor do Produto' }, 'admin');
      expect(attr.name).toBe('Cor do Produto');
      expect(attr.slug).toBe('cor-do-produto');
      expect(attr.isActive).toBe(true);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTRIBUTE_CREATED' }),
      );
    });

    it('should create attribute with custom slug', async () => {
      const attr = await service.create(
        { name: 'Color', slug: 'my-color' },
        'admin',
      );
      expect(attr.slug).toBe('my-color');
    });

    it('should reject duplicate slug', async () => {
      await service.create({ name: 'Cor', slug: 'cor' }, 'admin');
      await expect(
        service.create({ name: 'Cor 2', slug: 'cor' }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated attributes', async () => {
      await service.create({ name: 'Cor', slug: 'cor-1' }, 'admin');
      await service.create({ name: 'Tamanho', slug: 'tamanho-1' }, 'admin');
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data.length).toBe(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('findById', () => {
    it('should find by id', async () => {
      const created = await service.create(
        { name: 'Voltagem', slug: 'voltagem' },
        'admin',
      );
      const found = await service.findById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw NotFoundException if not exists', async () => {
      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update name and log audit', async () => {
      const created = await service.create({ name: 'Material' }, 'admin');
      const updated = await service.update(
        created.id,
        { name: 'Material Principal' },
        'admin',
      );
      expect(updated.name).toBe('Material Principal');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTRIBUTE_UPDATED' }),
      );
    });

    it('should soft delete attribute', async () => {
      const created = await service.create({ name: 'Sabor' }, 'admin');
      const res = await service.delete(created.id, 'admin');
      expect(res.message).toBe('Attribute deactivated successfully');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTRIBUTE_DEACTIVATED' }),
      );
    });
  });
});
