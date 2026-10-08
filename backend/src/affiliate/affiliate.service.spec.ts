import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateService } from './affiliate.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConflictException } from '@nestjs/common';
import { AffiliateStatus, ConversionStatus } from '@prisma/client';

describe('AffiliateService', () => {
  let service: AffiliateService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      role: { findUnique: jest.fn(), create: jest.fn() },
      userRole: { create: jest.fn() },
      affiliate: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      affiliateLink: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      affiliateClick: {
        create: jest.fn(),
        count: jest.fn(),
      },
      affiliateConversion: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      commissionRule: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      collection: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
    };

    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
  });

  describe('create affiliate', () => {
    it('should create an affiliate and default referral link', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        affiliate: null,
        roles: [],
      });
      prisma.affiliate.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'AFFILIATE' });

      const createdAffiliate = {
        id: 'aff-1',
        userId: 'user-1',
        code: 'MARIA27',
        displayName: 'Maria Santos',
        status: AffiliateStatus.ACTIVE,
      };
      prisma.affiliate.create.mockResolvedValue(createdAffiliate);
      prisma.affiliateLink.create.mockResolvedValue({ id: 'link-1' });

      const result = await service.create(
        { userId: 'user-1', code: 'MARIA27', displayName: 'Maria Santos' },
        'admin-1',
      );

      expect(result.code).toBe('MARIA27');
      expect(prisma.affiliate.create).toHaveBeenCalled();
      expect(prisma.affiliateLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            affiliateId: 'aff-1',
            code: 'MARIA27',
          }),
        }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AFFILIATE_CREATED' }),
      );
    });

    it('should throw ConflictException if user already has affiliate profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        affiliate: { id: 'existing' },
        roles: [],
      });

      await expect(
        service.create({
          userId: 'user-1',
          code: 'MARIA27',
          displayName: 'Maria',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('click tracking & attribution', () => {
    it('should record a click for an active affiliate link', async () => {
      prisma.affiliateLink.findUnique.mockResolvedValue({
        id: 'link-1',
        affiliateId: 'aff-1',
        isActive: true,
        affiliate: { status: AffiliateStatus.ACTIVE },
      });
      prisma.affiliateClick.create.mockResolvedValue({ id: 'click-1' });

      await service.recordClick('MARIA27', 'prod-1', 'sess-123');
      expect(prisma.affiliateClick.create).toHaveBeenCalledWith({
        data: {
          affiliateId: 'aff-1',
          affiliateLinkId: 'link-1',
          productId: 'prod-1',
          sessionId: 'sess-123',
        },
      });
    });

    it('should not record a click if affiliate is suspended or inactive', async () => {
      prisma.affiliateLink.findUnique.mockResolvedValue({
        id: 'link-1',
        affiliateId: 'aff-1',
        isActive: true,
        affiliate: { status: AffiliateStatus.SUSPENDED },
      });

      const res = await service.recordClick('MARIA27');
      expect(res).toBeNull();
      expect(prisma.affiliateClick.create).not.toHaveBeenCalled();
    });
  });

  describe('commission priority calculation', () => {
    it('should prioritize Product+Affiliate rule over Global rule', async () => {
      const rules = [
        {
          id: 'rule-prod-aff',
          affiliateId: 'aff-1',
          productId: 'prod-1',
          percentage: 25,
          priority: 50,
          isActive: true,
        },
        {
          id: 'rule-aff',
          affiliateId: 'aff-1',
          productId: null,
          percentage: 15,
          priority: 20,
          isActive: true,
        },
        {
          id: 'rule-global',
          affiliateId: null,
          productId: null,
          percentage: 10,
          priority: 10,
          isActive: true,
        },
      ];
      prisma.commissionRule.findMany.mockResolvedValue(rules);

      const commission = await service.calculateCommission('aff-1', 100, [
        'prod-1',
      ]);
      expect(commission).toBe(25); // 25% applied
    });

    it('should fallback to Global rule when no affiliate specific rule exists', async () => {
      const rules = [
        {
          id: 'rule-global',
          affiliateId: null,
          productId: null,
          percentage: 12,
          priority: 10,
          isActive: true,
        },
      ];
      prisma.commissionRule.findMany.mockResolvedValue(rules);

      const commission = await service.calculateCommission('aff-1', 200, [
        'prod-x',
      ]);
      expect(commission).toBe(24); // 12% of 200
    });
  });

  describe('order conversion handling', () => {
    it('should create an affiliate conversion on order creation and prevent duplicates', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-1',
        code: 'MARIA27',
        status: AffiliateStatus.ACTIVE,
      });
      prisma.affiliateConversion.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        subtotal: '100.00',
        status: 'CONFIRMED',
        items: [{ productId: 'p1' }],
      });
      prisma.commissionRule.findMany.mockResolvedValue([
        {
          affiliateId: null,
          productId: null,
          percentage: 10,
          priority: 10,
          isActive: true,
        },
      ]);
      prisma.affiliateConversion.create.mockResolvedValue({
        id: 'conv-1',
        affiliateId: 'aff-1',
        amount: '100.00',
        commissionAmount: '10.00',
        status: ConversionStatus.APPROVED,
      });

      const conversion = await service.handleOrderCreated('order-1', 'MARIA27');
      expect(conversion?.commissionAmount).toBe('10.00');
      expect(prisma.affiliateConversion.create).toHaveBeenCalled();
    });

    it('should update conversion status to CANCELLED when order is cancelled', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.APPROVED,
      });

      await service.handleOrderStatusChanged('order-1', 'CANCELLED');
      expect(prisma.affiliateConversion.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { status: ConversionStatus.CANCELLED },
      });
    });
  });

  describe('affiliate collections', () => {
    it('should create a custom affiliate collection', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-1',
        code: 'MARIA27',
        status: AffiliateStatus.ACTIVE,
      });
      prisma.collection.create.mockResolvedValue({
        id: 'col-1',
        name: 'Meus Favoritos',
        ownerAffiliateId: 'aff-1',
      });

      const col = await service.createAffiliateCollection('aff-1', {
        name: 'Meus Favoritos',
      });
      expect(col.ownerAffiliateId).toBe('aff-1');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AFFILIATE_COLLECTION_CREATED' }),
      );
    });
  });
});
