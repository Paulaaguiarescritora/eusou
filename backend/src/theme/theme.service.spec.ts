import { Test, TestingModule } from '@nestjs/testing';
import { ThemeService, THEME_PRESETS } from './theme.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ThemeStatus } from '@prisma/client';

describe('ThemeService', () => {
  let service: ThemeService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      theme: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
    };

    auditLog = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<ThemeService>(ThemeService);
  });

  describe('seedPresets', () => {
    it('should upsert all 5 presets', async () => {
      await service.seedPresets();
      expect(prisma.theme.upsert).toHaveBeenCalledTimes(THEME_PRESETS.length);
    });
  });

  describe('create', () => {
    it('should create custom theme', async () => {
      prisma.theme.findUnique.mockResolvedValue(null);
      const createdTheme = {
        id: 'theme-1',
        name: 'Meu Tema',
        slug: 'meu-tema',
        primaryColor: '#ff0000',
        status: ThemeStatus.ACTIVE,
      };
      prisma.theme.create.mockResolvedValue(createdTheme);

      const result = await service.create({
        name: 'Meu Tema',
        primaryColor: '#ff0000',
      });
      expect(result).toEqual(createdTheme);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'THEME_CREATED',
          entityId: 'theme-1',
        }),
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate an existing theme with non-preset status', async () => {
      const originalTheme = {
        id: 'theme-1',
        name: 'Tema Original',
        slug: 'tema-original',
        description: 'Desc',
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        font: 'Inter',
        buttonStyle: 'rounded',
        cardStyle: 'elevated',
        bannerStyle: 'full-width',
        productsPerRow: 4,
        showCategories: true,
        showHighlights: true,
        showNewProducts: true,
        showOffers: true,
        isPreset: true,
      };

      prisma.theme.findUnique
        .mockResolvedValueOnce(originalTheme) // findById
        .mockResolvedValueOnce(null); // slug availability check

      const duplicatedTheme = {
        ...originalTheme,
        id: 'theme-2',
        name: 'Tema Original (Cópia)',
        slug: 'tema-original-copia',
        isPreset: false,
      };
      prisma.theme.create.mockResolvedValue(duplicatedTheme);

      const result = await service.duplicate('theme-1', 'admin-1');
      expect(result.id).toBe('theme-2');
      expect(result.isPreset).toBe(false);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'THEME_DUPLICATED',
          entityId: 'theme-2',
        }),
      );
    });
  });
});
