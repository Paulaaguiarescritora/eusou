import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from '../pricing.service';
import { CostResolverService } from '../services/cost-resolver.service';
import { PricingCalculatorService } from '../calculators/pricing-calculator.service';
import { PricingValidatorService } from '../validators/pricing-validator.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { Prisma } from '@prisma/client';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: any;
  let auditLog: any;
  let costResolver: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
      },
      channel: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      pricingProfile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      pricingChannelRule: {
        create: jest.fn(),
        update: jest.fn(),
      },
      pricingRuleTier: {
        create: jest.fn(),
      },
      productChannelPrice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    costResolver = {
      resolveCost: jest.fn().mockResolvedValue({
        source: 'PRODUCTION',
        cost: new Prisma.Decimal('3.07'),
        isPartial: false,
        warnings: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        PricingCalculatorService,
        PricingValidatorService,
        { provide: CostResolverService, useValue: costResolver },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  it('simulate should return calculation output without persisting anything to DB', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Gato' });
    prisma.channel.findUnique.mockResolvedValue({
      id: 'chan-1',
      name: 'Mercado Livre',
    });
    prisma.pricingProfile.findFirst.mockResolvedValue({
      id: 'prof-1',
      name: 'Padrão',
      defaultTargetMargin: new Prisma.Decimal('0.20'),
      taxRate: new Prisma.Decimal('0.04'),
      packagingCost: new Prisma.Decimal('1.00'),
      roundingRule: 'ENDS_90',
      channelRules: [
        {
          channelId: 'chan-1',
          isActive: true,
          commissionPercent: new Prisma.Decimal('0.14'),
          fixedCost: new Prisma.Decimal('0.00'),
          tiers: [
            {
              id: 't2',
              name: '12.50 a 28.99',
              minPrice: new Prisma.Decimal('12.50'),
              maxPrice: new Prisma.Decimal('28.99'),
              fixedCost: new Prisma.Decimal('6.25'),
              isActive: true,
            },
          ],
        },
      ],
    });

    const res = await service.simulate({
      productId: 'prod-1',
      channelId: 'chan-1',
    });

    expect(res.status).toBe('OK');
    expect(res.calculatedPrice.toString()).toBe('16.9');
    expect(res.effectivePrice.toString()).toBe('16.9');
    expect(prisma.productChannelPrice.upsert).not.toHaveBeenCalled();
    expect(prisma.productChannelPrice.create).not.toHaveBeenCalled();
  });

  it('calculateAndPersist should persist ProductChannelPrice and log audit', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Gato' });
    prisma.channel.findUnique.mockResolvedValue({
      id: 'chan-1',
      name: 'Mercado Livre',
    });
    prisma.pricingProfile.findFirst.mockResolvedValue({
      id: 'prof-1',
      defaultTargetMargin: new Prisma.Decimal('0.20'),
      taxRate: new Prisma.Decimal('0.04'),
      packagingCost: new Prisma.Decimal('1.00'),
      roundingRule: 'ENDS_90',
      channelRules: [],
    });
    prisma.productChannelPrice.findFirst.mockResolvedValue(null);
    prisma.productChannelPrice.create.mockResolvedValue({
      id: 'pcp-1',
      productId: 'prod-1',
      channelId: 'chan-1',
      effectivePrice: new Prisma.Decimal('16.90'),
    });

    const results = await service.calculateAndPersist(
      {
        productId: 'prod-1',
        channelId: 'chan-1',
      },
      'admin-1',
    );

    expect(results.length).toBe(1);
    expect(prisma.productChannelPrice.create).toHaveBeenCalled();
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRICE_CALCULATED',
      }),
    );
  });

  it('setManualPrice should override effectivePrice with manualPrice and preserve calculatedPrice', async () => {
    prisma.productChannelPrice.findFirst.mockResolvedValue({
      id: 'pcp-1',
      productId: 'prod-1',
      channelId: 'chan-1',
      calculatedPrice: new Prisma.Decimal('16.90'),
      effectivePrice: new Prisma.Decimal('16.90'),
      mode: 'AUTOMATIC',
    });
    prisma.productChannelPrice.update.mockResolvedValue({
      id: 'pcp-1',
      calculatedPrice: new Prisma.Decimal('16.90'),
      manualPrice: new Prisma.Decimal('21.90'),
      effectivePrice: new Prisma.Decimal('21.90'),
      mode: 'MANUAL',
    });

    const res = await service.setManualPrice(
      {
        productId: 'prod-1',
        channelId: 'chan-1',
        manualPrice: 21.9,
      },
      'admin-1',
    );

    expect(res.mode).toBe('MANUAL');
    expect(res.effectivePrice.toString()).toBe('21.9');
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRICE_MANUAL_SET',
      }),
    );
  });

  it('removeManualPrice should restore effectivePrice to calculatedPrice', async () => {
    prisma.productChannelPrice.findUnique.mockResolvedValue({
      id: 'pcp-1',
      calculatedPrice: new Prisma.Decimal('16.90'),
      manualPrice: new Prisma.Decimal('21.90'),
      effectivePrice: new Prisma.Decimal('21.90'),
      mode: 'MANUAL',
    });
    prisma.productChannelPrice.update.mockResolvedValue({
      id: 'pcp-1',
      calculatedPrice: new Prisma.Decimal('16.90'),
      manualPrice: null,
      effectivePrice: new Prisma.Decimal('16.90'),
      mode: 'AUTOMATIC',
    });

    const res = await service.removeManualPrice('pcp-1', 'admin-1');

    expect(res.mode).toBe('AUTOMATIC');
    expect(res.effectivePrice.toString()).toBe('16.9');
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRICE_MANUAL_REMOVED',
      }),
    );
  });
});
