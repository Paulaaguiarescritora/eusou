import { Test, TestingModule } from '@nestjs/testing';
import { NicheService } from './niche.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { NicheStatus } from '@prisma/client';

describe('NicheService', () => {
  let service: NicheService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      niche: {
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
        NicheService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<NicheService>(NicheService);
  });

  describe('create', () => {
    it('should create a niche and log audit event', async () => {
      prisma.niche.findUnique.mockResolvedValue(null);
      const createdNiche = {
        id: 'niche-1',
        name: 'Sensual',
        slug: 'sensual',
        description: 'Nicho sensual',
        status: NicheStatus.ACTIVE,
      };
      prisma.niche.create.mockResolvedValue(createdNiche);

      const result = await service.create(
        { name: 'Sensual', description: 'Nicho sensual' },
        'admin-1',
      );

      expect(result).toEqual(createdNiche);
      expect(prisma.niche.create).toHaveBeenCalledWith({
        data: {
          name: 'Sensual',
          slug: 'sensual',
          description: 'Nicho sensual',
          status: NicheStatus.ACTIVE,
        },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NICHE_CREATED',
          entity: 'Niche',
          entityId: 'niche-1',
          userId: 'admin-1',
        }),
      );
    });

    it('should throw ConflictException if slug already exists', async () => {
      prisma.niche.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: 'Sensual', slug: 'sensual' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of niches', async () => {
      prisma.niche.findMany.mockResolvedValue([{ id: 'niche-1', name: 'N1' }]);
      prisma.niche.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return niche if found', async () => {
      prisma.niche.findUnique.mockResolvedValue({ id: 'niche-1', name: 'N1' });
      const result = await service.findById('niche-1');
      expect(result.id).toBe('niche-1');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.niche.findUnique.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update niche and log audit event', async () => {
      prisma.niche.findUnique.mockResolvedValue({
        id: 'niche-1',
        name: 'Old',
        slug: 'old',
      });
      prisma.niche.update.mockResolvedValue({
        id: 'niche-1',
        name: 'New',
        slug: 'old',
      });

      const result = await service.update(
        'niche-1',
        { name: 'New' },
        'admin-1',
      );
      expect(result.name).toBe('New');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NICHE_UPDATED',
          entityId: 'niche-1',
        }),
      );
    });
  });

  describe('delete', () => {
    it('should deactivate niche (soft delete) and log audit event', async () => {
      prisma.niche.findUnique.mockResolvedValue({
        id: 'niche-1',
        status: NicheStatus.ACTIVE,
      });
      prisma.niche.update.mockResolvedValue({
        id: 'niche-1',
        status: NicheStatus.INACTIVE,
      });

      const result = await service.delete('niche-1', 'admin-1');
      expect(result).toEqual({ message: 'Niche deactivated successfully' });
      expect(prisma.niche.update).toHaveBeenCalledWith({
        where: { id: 'niche-1' },
        data: { status: NicheStatus.INACTIVE },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NICHE_DEACTIVATED',
          entityId: 'niche-1',
        }),
      );
    });
  });
});
