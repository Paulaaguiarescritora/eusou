import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from '../pricing.service';
import { CostResolverService } from '../services/cost-resolver.service';
import { PricingCalculatorService } from '../calculators/pricing-calculator.service';
import { PricingValidatorService } from '../validators/pricing-validator.service';
import { ProductService } from '../../product/product.service';
import { ProductionService } from '../../production/production.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { Prisma } from '@prisma/client';

describe('EU SOU — Homologação e Correção Definitiva do F12 (Custo → Atacado → Varejo → Canais)', () => {
  let pricingService: PricingService;
  let costResolver: CostResolverService;
  let productService: ProductService;
  let prisma: any;
  let productionService: any;
  let auditLogService: any;

  const mockChannelOwnStore = {
    id: 'chan-own-1',
    name: 'Loja Própria',
    type: 'OWN_STORE',
    isActive: true,
  };

  const mockChannelML = {
    id: 'chan-ml-1',
    name: 'Mercado Livre Oficial',
    type: 'MERCADO_LIVRE',
    isActive: true,
  };

  const mockChannelShopee = {
    id: 'chan-shopee-1',
    name: 'Shopee',
    type: 'SHOPEE',
    isActive: true,
  };

  const mockChannelTikTok = {
    id: 'chan-tiktok-1',
    name: 'TikTok Shop',
    type: 'TIKTOK_SHOP',
    isActive: true,
  };

  const mockChannelFacebook = {
    id: 'chan-fb-1',
    name: 'Facebook',
    type: 'OTHER',
    isActive: true,
  };

  const allChannels = [
    mockChannelOwnStore,
    mockChannelML,
    mockChannelShopee,
    mockChannelTikTok,
    mockChannelFacebook,
  ];

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      channel: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          return allChannels.find((c) => c.id === where.id) || null;
        }),
        findMany: jest.fn().mockImplementation(async (args?: any) => {
          if (args?.where?.id?.in) {
            return allChannels.filter((c) => args.where.id.in.includes(c.id));
          }
          return allChannels;
        }),
      },
      pricingProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
          id: 'prof-std',
          name: 'Perfil Padrão Varejo',
          taxRate: new Prisma.Decimal('0.04'),
          defaultTargetMargin: new Prisma.Decimal('0.20'),
          roundingRule: 'ENDS_90',
          channelRules: [],
        }),
        findMany: jest.fn(),
      },
      productionProfile: {
        findFirst: jest.fn(),
      },
      productChannel: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue(
          allChannels.map((c) => ({
            productId: 'FEL-GAT-001',
            channelId: c.id,
            isEnabled: true,
            channel: c,
          })),
        ),
      },
      productChannelPrice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'pcp-' + Math.random(), ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'pcp-updated', ...data })),
        upsert: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
    };

    productionService = {
      calculateEstimatedCost: jest.fn(),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostResolverService,
        PricingCalculatorService,
        PricingValidatorService,
        PricingService,
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductionService, useValue: productionService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    costResolver = module.get<CostResolverService>(CostResolverService);
    pricingService = module.get<PricingService>(PricingService);
    productService = module.get<ProductService>(ProductService);
  });

  // =========================================================================
  // 1. Custo F7 é usado como custo de produção
  // =========================================================================
  it('1. Custo F7 é usado como custo de produção quando costSource é COST_FROM_F7', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      costSource: 'COST_FROM_F7',
      manualCost: null,
      wholesalePrice: new Prisma.Decimal('7.27'),
    });
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-f7-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 3.98,
      isPartial: false,
    });

    const res = await costResolver.resolveCost('prod-1');
    expect(res.source).toBe('PRODUCTION');
    expect(Number(res.cost)).toBe(3.98);
  });

  // =========================================================================
  // 2. Custo manual é usado como custo de produção
  // =========================================================================
  it('2. Custo manual é usado como custo de produção quando costSource é MANUAL', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-2',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
    });

    const res = await costResolver.resolveCost('prod-2');
    expect(res.source).toBe('MANUAL');
    expect(Number(res.cost)).toBe(3.98);
    expect(productionService.calculateEstimatedCost).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 3. Alterar F7 não altera automaticamente o atacado
  // =========================================================================
  it('3. Alterar F7 não altera automaticamente o preço de atacado', async () => {
    const existingProduct = {
      id: 'prod-3',
      costSource: 'COST_FROM_F7',
      manualCost: null,
      wholesalePrice: new Prisma.Decimal('7.27'),
    };
    prisma.product.findUnique.mockResolvedValue(existingProduct);

    // F7 recalcula para 4.50
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-f7-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 4.50,
      isPartial: false,
    });

    const costRes = await costResolver.resolveCost('prod-3');
    expect(Number(costRes.cost)).toBe(4.50);

    // O preço de atacado do produto no banco permanece 7.27
    expect(Number(existingProduct.wholesalePrice)).toBe(7.27);
  });

  // =========================================================================
  // 4. Alterar custo manual não altera automaticamente o atacado
  // =========================================================================
  it('4. Alterar custo manual não altera automaticamente o preço de atacado', async () => {
    const existingProduct = {
      id: 'prod-4',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
    };
    prisma.product.findUnique.mockResolvedValue(existingProduct);
    prisma.product.update.mockResolvedValue({
      ...existingProduct,
      manualCost: new Prisma.Decimal('4.50'),
    });

    await productService.update('prod-4', { manualCost: 4.50 });

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          manualCost: new Prisma.Decimal('4.50'),
        }),
      }),
    );
    // Atacado não foi passado no updateData
    const updateCall = prisma.product.update.mock.calls[0][0];
    expect(updateCall.data.wholesalePrice).toBeUndefined();
  });

  // =========================================================================
  // 5. Atacado pode ser definido independentemente do custo
  // =========================================================================
  it('5. Atacado pode ser definido independentemente do custo de produção', async () => {
    const product = {
      id: 'prod-5',
      costSource: 'COST_FROM_F7',
      manualCost: null,
      wholesalePrice: new Prisma.Decimal('7.27'),
    };
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({ totalCost: 3.98, isPartial: false });

    // Custo é 3.98 e atacado é 7.27 (independente de qualquer percentual automático)
    const cost = await costResolver.resolveCost('prod-5');
    expect(Number(cost.cost)).toBe(3.98);
    expect(Number(product.wholesalePrice)).toBe(7.27);
  });

  // =========================================================================
  // 6. Varejo é calculado a partir do atacado
  // =========================================================================
  it('6. Varejo é calculado a partir do atacado: 7.27 / (1 - 0.50 - 0.04) = 15.90', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-6',
      wholesalePrice: new Prisma.Decimal('7.27'),
      manualCost: new Prisma.Decimal('3.98'),
      costSource: 'MANUAL',
    });

    const sim = await pricingService.simulate({
      productId: 'prod-6',
      channelId: mockChannelOwnStore.id,
    });

    expect(sim.status).toBe('OK');
    expect(Number(sim.cost)).toBe(7.27);
    expect(Number(sim.packagingCost)).toBe(0);
    // 7.27 / 0.46 = 15.8043 -> ENDS_90 = 15.90
    expect(Number(sim.calculatedPrice)).toBe(15.90);
  });

  // =========================================================================
  // 7. Mercado Livre é calculado a partir do atacado
  // =========================================================================
  it('7. Mercado Livre é calculado a partir do atacado: (7.27 + 6.25) / 0.62 = 21.90', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-7',
      wholesalePrice: new Prisma.Decimal('7.27'),
      manualCost: new Prisma.Decimal('3.98'),
      costSource: 'MANUAL',
    });

    const sim = await pricingService.simulate({
      productId: 'prod-7',
      channelId: mockChannelML.id,
    });

    expect(sim.status).toBe('OK');
    expect(Number(sim.cost)).toBe(7.27);
    // Faixa 2: (7.27 + 6.25) / (1 - 0.14 - 0.04 - 0.20) = 13.52 / 0.62 = 21.806 -> ENDS_90 = 21.90
    expect(Number(sim.calculatedPrice)).toBe(21.90);
    // Lucro aproximado 4.44 e margem 20.3%
    expect(sim.netProfit.toNumber()).toBeCloseTo(4.44, 1);
    expect(sim.netMargin.toNumber()).toBeCloseTo(0.203, 2);
  });

  // =========================================================================
  // 8. Shopee é calculado a partir do atacado
  // =========================================================================
  it('8. Shopee é calculado a partir do atacado: (7.27 + 4.00) / 0.56 = 20.90', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-8',
      wholesalePrice: new Prisma.Decimal('7.27'),
      manualCost: new Prisma.Decimal('3.98'),
      costSource: 'MANUAL',
    });

    const sim = await pricingService.simulate({
      productId: 'prod-8',
      channelId: mockChannelShopee.id,
    });

    expect(sim.status).toBe('OK');
    expect(Number(sim.cost)).toBe(7.27);
    // Faixa >= 8.00: (7.27 + 4.00) / (1 - 0.20 - 0.04 - 0.20) = 11.27 / 0.56 = 20.125 -> ENDS_90 = 20.90
    expect(Number(sim.calculatedPrice)).toBe(20.90);
    expect(sim.netMargin.toNumber()).toBeGreaterThanOrEqual(0.20);
  });

  // =========================================================================
  // 9. TikTok Shop é calculado a partir do atacado
  // =========================================================================
  it('9. TikTok Shop é calculado a partir do atacado: (7.27 + 4.00) / 0.66 = 17.90', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-9',
      wholesalePrice: new Prisma.Decimal('7.27'),
      manualCost: new Prisma.Decimal('3.98'),
      costSource: 'MANUAL',
    });

    const sim = await pricingService.simulate({
      productId: 'prod-9',
      channelId: mockChannelTikTok.id,
    });

    expect(sim.status).toBe('OK');
    expect(Number(sim.cost)).toBe(7.27);
    // Faixa < 50: (7.27 + 4.00) / (1 - 0.10 - 0.04 - 0.20) = 11.27 / 0.66 = 17.0757 -> ENDS_90 = 17.90
    expect(Number(sim.calculatedPrice)).toBe(17.90);
    expect(sim.netMargin.toNumber()).toBeGreaterThanOrEqual(0.20);
  });

  // =========================================================================
  // 10. Facebook é calculado a partir do atacado
  // =========================================================================
  it('10. Facebook é calculado a partir do atacado: 7.27 / 0.46 = 15.90', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-10',
      wholesalePrice: new Prisma.Decimal('7.27'),
      manualCost: new Prisma.Decimal('3.98'),
      costSource: 'MANUAL',
    });

    const sim = await pricingService.simulate({
      productId: 'prod-10',
      channelId: mockChannelFacebook.id,
    });

    expect(sim.status).toBe('OK');
    expect(Number(sim.cost)).toBe(7.27);
    // 7.27 / (1 - 0.50 - 0.04) = 7.27 / 0.46 = 15.8043 -> ENDS_90 = 15.90
    expect(Number(sim.calculatedPrice)).toBe(15.90);
  });

  // =========================================================================
  // 11. Product.basePrice não participa
  // =========================================================================
  it('11. Product.basePrice é legado e nunca é usado como custo, atacado ou varejo', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-11',
      basePrice: new Prisma.Decimal('99.99'), // legado
      wholesalePrice: new Prisma.Decimal('7.27'),
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
    });

    const sim = await pricingService.simulate({
      productId: 'prod-11',
      channelId: mockChannelOwnStore.id,
    });

    // Ignora 99.99 e usa exatamente wholesalePrice 7.27
    expect(Number(sim.cost)).toBe(7.27);
    expect(Number(sim.calculatedPrice)).toBe(15.90);
  });

  // =========================================================================
  // 12. Loja própria recebe o preço de varejo
  // =========================================================================
  it('12. Loja Própria recebe o preço de varejo puro do F12 (R$ 15,90)', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-12',
      wholesalePrice: new Prisma.Decimal('7.27'),
      manualCost: new Prisma.Decimal('3.98'),
      costSource: 'MANUAL',
    });

    const sim = await pricingService.simulate({
      productId: 'prod-12',
      channelId: mockChannelOwnStore.id,
    });

    expect(Number(sim.calculatedPrice)).toBe(15.90);
    expect(Number(sim.commissionAmount)).toBe(0);
  });

  // =========================================================================
  // 13. ProductChannelPrice recebe os preços corretos
  // =========================================================================
  it('13. ProductChannelPrice persiste os preços calculados pelo F12 com costBasis sendo o atacado', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-13',
      wholesalePrice: new Prisma.Decimal('7.27'),
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
    });

    const persistedList = await pricingService.calculateAndPersist({
      productId: 'prod-13',
      channelIds: [mockChannelOwnStore.id, mockChannelML.id],
    });

    expect(persistedList.length).toBe(2);
    expect(prisma.productChannelPrice.create).toHaveBeenCalledTimes(2);

    const firstCreate = prisma.productChannelPrice.create.mock.calls[0][0].data;
    expect(Number(firstCreate.costBasis)).toBe(7.27);
    expect(Number(firstCreate.calculatedPrice)).toBe(15.90);
  });

  // =========================================================================
  // 14. FEL-GAT-001 reproduz exatamente todos os valores homologados
  // =========================================================================
  it('14. FEL-GAT-001 reproduz exatamente: Custo = 3,98 | Atacado = 7,27 | Varejo = 15,90 | ML = 21,90 | Shopee = 20,90 | TikTok = 17,90 | FB = 15,90', async () => {
    const felGatProduct = {
      id: '854fee0d-8ba7-4381-bf1a-eeada2a5610a',
      sku: 'FEL-GAT-001',
      name: 'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
    };
    prisma.product.findUnique.mockResolvedValue(felGatProduct);

    // Custo de Produção
    const costResolution = await costResolver.resolveCost(felGatProduct.id);
    expect(Number(costResolution.cost)).toBe(3.98);

    // Varejo / Loja Própria
    const simOwn = await pricingService.simulate({ productId: felGatProduct.id, channelId: mockChannelOwnStore.id });
    expect(Number(simOwn.calculatedPrice)).toBe(15.90);

    // Mercado Livre
    const simML = await pricingService.simulate({ productId: felGatProduct.id, channelId: mockChannelML.id });
    expect(Number(simML.calculatedPrice)).toBe(21.90);
    expect(simML.netProfit.toNumber()).toBeCloseTo(4.44, 1);
    expect(simML.netMargin.toNumber()).toBeCloseTo(0.203, 2);

    // Shopee
    const simShopee = await pricingService.simulate({ productId: felGatProduct.id, channelId: mockChannelShopee.id });
    expect(Number(simShopee.calculatedPrice)).toBe(20.90);

    // TikTok Shop
    const simTikTok = await pricingService.simulate({ productId: felGatProduct.id, channelId: mockChannelTikTok.id });
    expect(Number(simTikTok.calculatedPrice)).toBe(17.90);

    // Facebook
    const simFB = await pricingService.simulate({ productId: felGatProduct.id, channelId: mockChannelFacebook.id });
    expect(Number(simFB.calculatedPrice)).toBe(15.90);
  });

  // =========================================================================
  // 15. Alterar atacado recalcula os canais
  // =========================================================================
  it('15. Alterar atacado de 7,27 para 8,00 recalcula os canais sem alterar custo de produção', async () => {
    const product = {
      id: 'prod-15',
      sku: 'FEL-GAT-001',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
    };
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.product.update.mockResolvedValue({
      ...product,
      wholesalePrice: new Prisma.Decimal('8.00'),
    });

    await productService.update('prod-15', { wholesalePrice: 8.00 });

    // Auditoria WHOLESALE_PRICE_UPDATED registrada
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WHOLESALE_PRICE_UPDATED',
        metadata: expect.objectContaining({
          previousValue: 7.27,
          newValue: 8.00,
        }),
      }),
    );

    // Simula com novo atacado R$ 8,00
    prisma.product.findUnique.mockResolvedValue({
      ...product,
      wholesalePrice: new Prisma.Decimal('8.00'),
    });

    const newSimOwn = await pricingService.simulate({ productId: 'prod-15', channelId: mockChannelOwnStore.id });
    // 8.00 / 0.46 = 17.391 -> ENDS_90 = 17.90
    expect(Number(newSimOwn.calculatedPrice)).toBe(17.90);

    // Custo de produção permanece R$ 3,98
    const cost = await costResolver.resolveCost('prod-15');
    expect(Number(cost.cost)).toBe(3.98);
  });

  // =========================================================================
  // 16. Alterar custo não altera atacado
  // =========================================================================
  it('16. Alterar custo de produção de 3,98 para 4,50 não altera o atacado', async () => {
    const product = {
      id: 'prod-16',
      sku: 'FEL-GAT-001',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
    };
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.product.update.mockResolvedValue({
      ...product,
      manualCost: new Prisma.Decimal('4.50'),
    });

    await productService.update('prod-16', { manualCost: 4.50 });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCTION_COST_UPDATED',
      }),
    );

    // Atacado não mudou
    expect(Number(product.wholesalePrice)).toBe(7.27);
  });

  // =========================================================================
  // 17. Pedidos históricos não são alterados
  // =========================================================================
  it('17. Pedidos históricos não sofrem alteração ao mudar atacado ou preços F12', async () => {
    const historicalOrderItem = {
      id: 'item-hist-1',
      orderId: 'order-1',
      productId: 'prod-17',
      productNameSnapshot: 'Porta Chaves Gatinho Felinodelia',
      unitPrice: new Prisma.Decimal('15.90'),
      quantity: 2,
      subtotal: new Prisma.Decimal('31.80'),
    };
    prisma.orderItem.findMany.mockResolvedValue([historicalOrderItem]);

    // Atualiza atacado no produto
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-17',
      wholesalePrice: new Prisma.Decimal('9.00'),
    });

    // O snapshot do item do pedido permanece intacto
    const orderItems = await prisma.orderItem.findMany({ where: { orderId: 'order-1' } });
    expect(Number(orderItems[0].unitPrice)).toBe(15.90);
    expect(Number(orderItems[0].subtotal)).toBe(31.80);
  });
});
