import { Test, TestingModule } from '@nestjs/testing';
import { TagService } from './tag.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConflictException } from '@nestjs/common';
import { TagStatus } from '@prisma/client';

describe('TagService', () => {
  let service: TagService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      tag: {
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
        TagService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  describe('create', () => {
    it('should create a tag and log audit event', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      const createdTag = {
        id: 'tag-1',
        name: 'Destaque',
        slug: 'destaque',
        status: TagStatus.ACTIVE,
      };
      prisma.tag.create.mockResolvedValue(createdTag);

      const result = await service.create({ name: 'Destaque' }, 'admin-1');
      expect(result).toEqual(createdTag);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TAG_CREATED',
          entityId: 'tag-1',
        }),
      );
    });

    it('should throw ConflictException on duplicate slug', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create({ name: 'Destaque' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('delete', () => {
    it('should deactivate tag', async () => {
      prisma.tag.findUnique.mockResolvedValue({
        id: 'tag-1',
        status: TagStatus.ACTIVE,
      });
      prisma.tag.update.mockResolvedValue({
        id: 'tag-1',
        status: TagStatus.INACTIVE,
      });

      const result = await service.delete('tag-1', 'admin-1');
      expect(result).toEqual({ message: 'Tag deactivated successfully' });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TAG_DEACTIVATED',
          entityId: 'tag-1',
        }),
      );
    });
  });
});
