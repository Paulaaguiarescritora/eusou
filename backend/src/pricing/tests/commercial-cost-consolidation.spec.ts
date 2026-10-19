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

describe('Consolidação de Custo Comercial: F7 → Custo Comercial → F12', () => {
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

  const mockPricingProfile = {
    id: 'profile-std',
    name: 'Perfil Padrão Varejo',
    isDefault: true,
    isActive: true,
    defaultTargetMargin: new Prisma.Decimal('0.20'),
    taxRate: new Prisma.Decimal('0.04'),
    packagingCost: new Prisma.Decimal('1.00'),
    roundingRule: 'ENDS_90',
    channelRules: [
      {
        id: 'rule-ml',
        channelId: 'chan-ml-1',
        commissionPercent: new Prisma.Decimal('0.14'),
        fixedCost: new Prisma.Decimal('0'),
        fixedCostPercent: new Prisma.Decimal('0'),
        otherPercent: new Prisma.Decimal('0'),
        otherFixedCost: new Prisma.Decimal('0'),
        orderFixedCost: new Prisma.Decimal('0'),
        paymentFeePercent: new Prisma.Decimal('0'),
        isActive: true,
        tiers: [],
      },
    ],
  };

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
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([mockChannelOwnStore, mockChannelML]),
      },
      pricingProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(mockPricingProfile),
        findMany: jest.fn(),
      },
      productionProfile: {
        findFirst: jest.fn(),
      },
      productChannel: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { productId: 'FEL-GAT-001', channelId: mockChannelOwnStore.id, isEnabled: true },
          { productId: 'FEL-GAT-001', channelId: mockChannelML.id, isEnabled: true },
        ]),
      },
      productChannelPrice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
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
  // CENÁRIO 1: Produto com F7 → custo comercial vem do F7
  // =========================================================================
  it('1. Produto com F7 e costSource COST_FROM_F7: custo comercial vem do F7', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-f7',
      costSource: 'COST_FROM_F7',
      manualCost: null,
      basePrice: new Prisma.Decimal('50.00'),
    });
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 2.12,
      isPartial: false,
    });

    const res = await costResolver.resolveCost('prod-f7');
    expect(res.source).toBe('PRODUCTION');
    expect(Number(res.cost)).toBe(2.12);
    expect(res.isPartial).toBe(false);
  });

  // =========================================================================
  // CENÁRIO 2: Produto com custo manual → custo comercial vem do manual
  // =========================================================================
  it('2. Produto com costSource MANUAL e manualCost R$ 3,98: custo comercial vem do manual', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-manual',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      basePrice: new Prisma.Decimal('50.00'),
    });
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 2.12,
      isPartial: false,
    });

    const res = await costResolver.resolveCost('prod-manual');
    expect(res.source).toBe('MANUAL');
    expect(Number(res.cost)).toBe(3.98);
    // Não deve consultar cálculo F7 para custo comercial
    expect(productionService.calculateEstimatedCost).not.toHaveBeenCalled();
  });

  // =========================================================================
  // CENÁRIO 3: Recálculo do F7 não altera o custo manual comercial
  // =========================================================================
  it('3. Recálculo do F7 não altera o custo comercial quando configurado como MANUAL', async () => {
    const productData = {
      id: 'prod-manual',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
    };
    prisma.product.findUnique.mockResolvedValue(productData);

    // F7 agora mudou/recalculou para 2.45
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 2.45,
      isPartial: false,
    });

    const res = await costResolver.resolveCost('prod-manual');
    expect(res.source).toBe('MANUAL');
    expect(Number(res.cost)).toBe(3.98);
  });

  // =========================================================================
  // CENÁRIO 4: Trocar manual → F7 restaura o custo F7 comercial
  // =========================================================================
  it('4. Trocar manual → F7 restaura o custo F7 comercial imediatamente', async () => {
    // Inicialmente MANUAL
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-switch',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
    });
    let res = await costResolver.resolveCost('prod-switch');
    expect(res.source).toBe('MANUAL');
    expect(Number(res.cost)).toBe(3.98);

    // Administrador altera para COST_FROM_F7
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-switch',
      costSource: 'COST_FROM_F7',
      manualCost: new Prisma.Decimal('3.98'), // mantido no banco como histórico ou inativo
    });
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 2.12,
      isPartial: false,
    });

    res = await costResolver.resolveCost('prod-switch');
    expect(res.source).toBe('PRODUCTION');
    expect(Number(res.cost)).toBe(2.12);
  });

  // =========================================================================
  // CENÁRIO 5: F12 usa o custo comercial, e não diretamente o F7
  // =========================================================================
  it('5. F12 consome o preço de atacado (R$ 7,27) gerando preços correspondentes', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-f12',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
      basePrice: null,
    });
    prisma.channel.findUnique.mockResolvedValue(mockChannelOwnStore);

    const sim = await pricingService.simulate({
      productId: 'prod-f12',
      channelId: mockChannelOwnStore.id,
    });

    expect(Number(sim.cost)).toBe(7.27);
    // Varejo / Loja Própria: 7.27 / (1 - 0.50 - 0.04) = 7.27 / 0.46 = 15.80 -> ENDS_90 = 15.90
    expect(Number(sim.calculatedPrice)).toBe(15.90);
  });

  // =========================================================================
  // CENÁRIO 6: Produto sem F7 e sem custo manual fica sem precificação válida ("Aguardando custo")
  // =========================================================================
  it('6. Produto sem F7 e sem custo manual fica sem precificação válida ("Aguardando custo")', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-sem-custo',
      costSource: 'COST_FROM_F7',
      manualCost: null,
      basePrice: new Prisma.Decimal('39.90'), // basePrice existe mas não é custo
      productChannels: [
        { channelId: mockChannelOwnStore.id, isEnabled: true, channel: mockChannelOwnStore },
      ],
      productChannelPrices: [],
      media: [],
      niches: [],
      categories: [],
      tags: [],
    });
    prisma.productionProfile.findFirst.mockResolvedValue(null);

    const summary = await productService.getPricingSummary('prod-sem-custo');
    expect(summary.hasValidCost).toBe(false);
    expect(summary.cost).toBeNull();
    expect(summary.statusLabel).toBe('Aguardando custo');
    expect(summary.ownStorePrice).toBeNull();
  });

  // =========================================================================
  // CENÁRIO 7: Product.basePrice não é usado como custo
  // =========================================================================
  it('7. Product.basePrice nunca é usado como custo pelo CostResolver', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-legado',
      costSource: 'COST_FROM_F7',
      manualCost: null,
      basePrice: new Prisma.Decimal('29.90'),
    });
    prisma.productionProfile.findFirst.mockResolvedValue(null);

    const res = await costResolver.resolveCost('prod-legado');
    expect(res.source).toBe('NONE');
    expect(Number(res.cost)).toBe(0);
    expect(res.warnings).toContain(
      'Nenhuma fonte de custo de produção F7 encontrada para o produto/variante. Precificação comercial retida.',
    );
  });

  // =========================================================================
  // CENÁRIO 8: Loja Própria usa preço do F12 gerado a partir do custo comercial
  // =========================================================================
  it('8. Loja Própria usa preço do F12 gerado a partir do custo comercial', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-own',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
    });
    prisma.channel.findUnique.mockResolvedValue(mockChannelOwnStore);

    const sim = await pricingService.simulate({
      productId: 'prod-own',
      channelId: mockChannelOwnStore.id,
    });

    expect(Number(sim.cost)).toBe(7.27);
    // Loja Própria recebe o preço de varejo puro do F12: R$ 15.90
    expect(Number(sim.calculatedPrice)).toBe(15.90);
    expect(Number(sim.commissionAmount)).toBe(0);
  });

  // =========================================================================
  // CENÁRIO 9: Mercado Livre usa preço do F12 gerado a partir do custo comercial
  // =========================================================================
  it('9. Mercado Livre usa preço do F12 gerado a partir do custo comercial', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-ml',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
    });
    prisma.channel.findUnique.mockResolvedValue(mockChannelML);

    const sim = await pricingService.simulate({
      productId: 'prod-ml',
      channelId: mockChannelML.id,
    });

    expect(Number(sim.cost)).toBe(7.27);
    // Mercado Livre: (7.27 + 6.25) / 0.62 = 21.806 -> ENDS_90 = 21.90
    expect(Number(sim.calculatedPrice)).toBe(21.90);
    expect(Number(sim.commissionAmount)).toBeGreaterThan(0);
  });

  // =========================================================================
  // CENÁRIO 10: FEL-GAT-001 integridade e ciclo de transição completo
  // =========================================================================
  it('10. FEL-GAT-001 permanece íntegro e passa pelo ciclo de transição (F7 R$ 2,12 -> MANUAL R$ 3,98 -> F7 R$ 2,12)', async () => {
    // Passo A: Custo F7 ativo R$ 2,12
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-fel-gat-001',
      sku: 'FEL-GAT-001',
      name: 'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
      costSource: 'COST_FROM_F7',
      manualCost: null,
      wholesalePrice: new Prisma.Decimal('7.27'),
      basePrice: null,
    });
    prisma.channel.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === mockChannelOwnStore.id) return mockChannelOwnStore;
      if (where.id === mockChannelML.id) return mockChannelML;
      return null;
    });
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-fel-gat' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 2.12,
      isPartial: false,
    });

    let f7Resolved = await costResolver.resolveCost('prod-fel-gat-001');
    expect(f7Resolved.source).toBe('PRODUCTION');
    expect(Number(f7Resolved.cost)).toBe(2.12);

    let simOwnF7 = await pricingService.simulate({
      productId: 'prod-fel-gat-001',
      channelId: mockChannelOwnStore.id,
    });
    // Atacado 7.27 -> Varejo 15.90 (Loja Própria)
    expect(Number(simOwnF7.calculatedPrice)).toBe(15.90);

    let simMLF7 = await pricingService.simulate({
      productId: 'prod-fel-gat-001',
      channelId: mockChannelML.id,
    });
    // Atacado 7.27 -> ML 21.90 (Mercado Livre)
    expect(Number(simMLF7.calculatedPrice)).toBe(21.90);

    // Passo B: Administradora define Custo Comercial Manual de R$ 3,98
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-fel-gat-001',
      sku: 'FEL-GAT-001',
      name: 'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
      basePrice: null,
    });

    let manualResolved = await costResolver.resolveCost('prod-fel-gat-001');
    expect(manualResolved.source).toBe('MANUAL');
    expect(Number(manualResolved.cost)).toBe(3.98);

    let simOwnManual = await pricingService.simulate({
      productId: 'prod-fel-gat-001',
      channelId: mockChannelOwnStore.id,
    });
    // Alteração de custo técnico não altera varejo (mantém 15.90)
    expect(Number(simOwnManual.calculatedPrice)).toBe(15.90);

    let simMLManual = await pricingService.simulate({
      productId: 'prod-fel-gat-001',
      channelId: mockChannelML.id,
    });
    // Alteração de custo técnico não altera ML (mantém 21.90)
    expect(Number(simMLManual.calculatedPrice)).toBe(21.90);

    // Passo C: Retorno para F7
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-fel-gat-001',
      sku: 'FEL-GAT-001',
      name: 'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
      costSource: 'COST_FROM_F7',
      manualCost: new Prisma.Decimal('3.98'),
      wholesalePrice: new Prisma.Decimal('7.27'),
      basePrice: null,
    });

    let restoredResolved = await costResolver.resolveCost('prod-fel-gat-001');
    expect(restoredResolved.source).toBe('PRODUCTION');
    expect(Number(restoredResolved.cost)).toBe(2.12);

    let simOwnRestored = await pricingService.simulate({
      productId: 'prod-fel-gat-001',
      channelId: mockChannelOwnStore.id,
    });
    expect(Number(simOwnRestored.calculatedPrice)).toBe(15.90);

    let simMLRestored = await pricingService.simulate({
      productId: 'prod-fel-gat-001',
      channelId: mockChannelML.id,
    });
    expect(Number(simMLRestored.calculatedPrice)).toBe(21.90);
  });
});
