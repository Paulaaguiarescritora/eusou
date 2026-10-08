import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CategoryStatus } from '@prisma/client';

describe('CategoryService', () => {
  let service: CategoryService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      niche: {
        findUnique: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLog = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('create', () => {
    it('should create a root category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      const createdCategory = {
        id: 'cat-1',
        name: 'Vibradores',
        slug: 'vibradores',
        status: CategoryStatus.ACTIVE,
        parentId: null,
        nicheId: null,
      };
      prisma.category.create.mockResolvedValue(createdCategory);

      const result = await service.create({ name: 'Vibradores' }, 'admin-1');
      expect(result).toEqual(createdCategory);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CATEGORY_CREATED',
          entityId: 'cat-1',
        }),
      );
    });

    it('should inherit nicheId from parent if not specified', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce({ id: 'parent-1', nicheId: 'niche-1' }); // parent check

      const createdCategory = {
        id: 'cat-2',
        name: 'Bullet',
        slug: 'bullet',
        status: CategoryStatus.ACTIVE,
        parentId: 'parent-1',
        nicheId: 'niche-1',
      };
      prisma.category.create.mockResolvedValue(createdCategory);

      const result = await service.create({
        name: 'Bullet',
        parentId: 'parent-1',
      });
      expect(result.nicheId).toBe('niche-1');
    });

    it('should throw BadRequestException if child niche differs from parent niche', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce({ id: 'parent-1', nicheId: 'niche-1' }); // parent check
      prisma.niche.findUnique.mockResolvedValue({ id: 'niche-2' });

      await expect(
        service.create({
          name: 'Bullet',
          parentId: 'parent-1',
          nicheId: 'niche-2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if slug already exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create({ name: 'Vibradores' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('hierarchy and cycle detection', () => {
    it('should throw BadRequestException if category is set as its own parent', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        slug: 'cat-1',
      });

      await expect(
        service.update('cat-1', { parentId: 'cat-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect circular hierarchy on update', async () => {
      // Structure: cat-1 -> cat-2. Now updating cat-1 to have parent cat-2
      prisma.category.findUnique
        .mockResolvedValueOnce({ id: 'cat-1', slug: 'cat-1', parentId: null }) // findById
        .mockResolvedValueOnce({ id: 'cat-2', parentId: 'cat-1' }); // assertParentCategory check parent

      await expect(
        service.update('cat-1', { parentId: 'cat-2' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should deactivate category (soft delete)', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        status: CategoryStatus.ACTIVE,
      });
      prisma.category.update.mockResolvedValue({
        id: 'cat-1',
        status: CategoryStatus.INACTIVE,
      });

      const result = await service.delete('cat-1', 'admin-1');
      expect(result).toEqual({ message: 'Category deactivated successfully' });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CATEGORY_DEACTIVATED',
          entityId: 'cat-1',
        }),
      );
    });
  });
});
