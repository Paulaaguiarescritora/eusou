import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from '../pricing.service';
import { CostResolverService } from '../services/cost-resolver.service';
import { PricingCalculatorService } from '../calculators/pricing-calculator.service';
import { PricingValidatorService } from '../validators/pricing-validator.service';
import { ProductService } from '../../product/product.service';
import { OrderService } from '../../order/order.service';
import { PublicStoreService } from '../../public-store/public-store.service';
import { ProductionService } from '../../production/production.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { AffiliateService } from '../../affiliate/affiliate.service';
import { InventoryService } from '../../inventory/inventory.service';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Integração de Precificação F7 → F12 → Loja Própria → Canais', () => {
  let pricingService: PricingService;
  let costResolver: CostResolverService;
  let productService: ProductService;
  let orderService: OrderService;
  let publicStoreService: PublicStoreService;
  let prisma: any;
  let productionService: any;
  let inventoryService: any;

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
        count: jest.fn(),
      },
      channel: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      pricingProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(mockPricingProfile),
        findMany: jest.fn(),
      },
      productChannel: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      productChannelPrice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productionProfile: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 10, reservedQuantity: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 10, reservedQuantity: 0 }),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      catalog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      collection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      stockMovement: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    productionService = {
      calculateEstimatedCost: jest.fn(),
    };

    inventoryService = {
      reserveStockForOrder: jest.fn().mockResolvedValue(undefined),
      releaseStockForOrder: jest.fn().mockResolvedValue(undefined),
      handleOrderConfirmed: jest.fn().mockResolvedValue(undefined),
      handleOrderCancelled: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        CostResolverService,
        PricingCalculatorService,
        PricingValidatorService,
        ProductService,
        OrderService,
        PublicStoreService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductionService, useValue: productionService },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: AffiliateService, useValue: { handleOrderCreated: jest.fn() } },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    pricingService = module.get<PricingService>(PricingService);
    costResolver = module.get<CostResolverService>(CostResolverService);
    productService = module.get<ProductService>(ProductService);
    orderService = module.get<OrderService>(OrderService);
    publicStoreService = module.get<PublicStoreService>(PublicStoreService);
  });

  // =========================================================================
  // CENÁRIO 1: Produto com custo F7 calcula preço OWN_STORE
  // =========================================================================
  it('1. Produto com custo F7 e atacado calcula preço de varejo da Loja Própria (OWN_STORE) sem taxas de marketplace', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-f7', name: 'Item F7', basePrice: null, wholesalePrice: new Prisma.Decimal('7.27') });
    prisma.channel.findUnique.mockResolvedValue(mockChannelOwnStore);
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({ totalCost: 3.98, isPartial: false });

    const sim = await pricingService.simulate({
      productId: 'prod-f7',
      channelId: 'chan-own-1',
    });

    expect(sim.status).toBe('OK');
    expect(Number(sim.cost)).toBe(7.27);
    // Varejo / Loja Própria: 7.27 / (1 - 0.50 - 0.04) = 7.27 / 0.46 = 15.80 -> ENDS_90 = 15.90
    expect(Number(sim.calculatedPrice)).toBe(15.90);
    expect(Number(sim.commissionAmount)).toBe(0); // Sem comissão de marketplace
  });

  // =========================================================================
  // CENÁRIO 2: Produto com custo F7 calcula preço de marketplace
  // =========================================================================
  it('2. Produto com custo F7 e atacado calcula preço de Marketplace (Mercado Livre) com comissão e taxas de canal', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-f7', name: 'Item F7', basePrice: null, wholesalePrice: new Prisma.Decimal('7.27') });
    prisma.channel.findUnique.mockResolvedValue(mockChannelML);
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({ totalCost: 3.98, isPartial: false });

    const sim = await pricingService.simulate({
      productId: 'prod-f7',
      channelId: 'chan-ml-1',
    });

    expect(sim.status).toBe('OK');
    expect(Number(sim.cost)).toBe(7.27);
    // Mercado Livre: (7.27 + 6.25) / 0.62 = 21.806 -> ENDS_90 = 21.90
    expect(Number(sim.calculatedPrice)).toBe(21.90);
    expect(Number(sim.commissionAmount)).toBeGreaterThan(0);
  });

  // =========================================================================
  // CENÁRIO 3: Product.basePrice nunca é utilizado como custo
  // =========================================================================
  it('3. Product.basePrice nunca é utilizado como custo pelo CostResolverService', async () => {
    prisma.productionProfile.findFirst.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-legado',
      name: 'Item com Preço Antigo',
      basePrice: new Prisma.Decimal('39.90'),
    });

    const costRes = await costResolver.resolveCost('prod-legado');
    expect(costRes.source).toBe('NONE');
    expect(costRes.cost.toString()).toBe('0');
    expect(costRes.warnings).toContain(
      'Nenhuma fonte de custo de produção F7 encontrada para o produto/variante. Precificação comercial retida.',
    );
  });

  // =========================================================================
  // CENÁRIO 4: Produto sem custo F7 não recebe preço fictício
  // =========================================================================
  it('4. Produto sem custo F7 não recebe preço comercial fictício no F12', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-sem-f7', name: 'Sem F7', basePrice: '39.90' });
    prisma.channel.findUnique.mockResolvedValue(mockChannelOwnStore);
    prisma.productionProfile.findFirst.mockResolvedValue(null);

    const sim = await pricingService.simulate({
      productId: 'prod-sem-f7',
      channelId: 'chan-own-1',
    });

    expect(sim.status).toBe('INVALID');
    expect(Number(sim.calculatedPrice)).toBe(0);
    expect(Number(sim.effectivePrice)).toBe(0);
    expect(sim.errors).toContain(
      'Produto sem custo de produção F7 válido. Precificação comercial retida.',
    );
  });

  // =========================================================================
  // CENÁRIO 5: Loja Própria utiliza ProductChannelPrice e não basePrice
  // =========================================================================
  it('5. Loja Própria utiliza ProductChannelPrice e rejeita fallback silencioso para basePrice', async () => {
    prisma.channel.findFirst.mockResolvedValue(mockChannelOwnStore);
    
    // Produto com basePrice legado R$ 39.90, mas sem ProductChannelPrice
    prisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      name: 'Porta Chaves Gatinho',
      slug: 'porta-chaves-gatinho',
      basePrice: new Prisma.Decimal('39.90'),
      status: 'ACTIVE',
      productChannelPrices: [],
    });

    const storeProduct = await publicStoreService.getProductBySlug('porta-chaves-gatinho');
    // Não deve assumir 39.90 silenciosamente
    expect(storeProduct.basePrice).toBeNull();
  });

  // =========================================================================
  // CENÁRIO 6: Checkout utiliza ProductChannelPrice
  // =========================================================================
  it('6. Checkout utiliza ProductChannelPrice para o canal da compra', async () => {
    prisma.channel.findFirst.mockResolvedValue(mockChannelOwnStore);
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      name: 'Produto F12',
      status: 'ACTIVE',
      basePrice: '99.00',
    });
    prisma.productChannel.findUnique.mockResolvedValue({ isEnabled: true });
    // Preço legítimo F12 no canal: R$ 45.90
    prisma.productChannelPrice.findFirst.mockResolvedValue({
      effectivePrice: new Prisma.Decimal('45.90'),
      mode: 'AUTOMATIC',
    });
    prisma.order.create.mockResolvedValue({
      id: 'order-1',
      total: '45.90',
      items: [{ productId: 'prod-1', unitPrice: '45.90', quantity: 1 }],
    });

    const order = await orderService.create({
      customerName: 'Cliente Teste',
      customerEmail: 'cliente@teste.com',
      customerPhone: '11999999999',
      street: 'Rua',
      number: '1',
      neighborhood: 'B',
      city: 'C',
      state: 'SP',
      zipCode: '01000-000',
      items: [{ productId: 'prod-1', quantity: 1 }],
    });

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: '45.90',
          items: {
            create: [
              expect.objectContaining({
                unitPrice: '45.90',
                subtotal: '45.90',
              }),
            ],
          },
        }),
      }),
    );
  });

  // =========================================================================
  // CENÁRIO 7: Produto sem preço válido não pode ser vendido
  // =========================================================================
  it('7. Produto sem preço válido em ProductChannelPrice é bloqueado no checkout com erro claro', async () => {
    prisma.channel.findFirst.mockResolvedValue(mockChannelOwnStore);
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-sem-f12',
      name: 'Produto Sem Preço',
      status: 'ACTIVE',
      basePrice: '39.90',
    });
    prisma.productChannel.findUnique.mockResolvedValue({ isEnabled: true });
    prisma.productChannelPrice.findFirst.mockResolvedValue(null);

    await expect(
      orderService.create({
        customerName: 'Cliente Teste',
        customerEmail: 'cliente@teste.com',
        customerPhone: '11999999999',
        street: 'Rua',
        number: '1',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '01000-000',
        items: [{ productId: 'prod-sem-f12', quantity: 1 }],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Produto indisponível para venda: preço não configurado no canal para "Produto Sem Preço".',
      ),
    );
  });

  // =========================================================================
  // CENÁRIO 8: Alteração de custo permite novo cálculo F12
  // =========================================================================
  it('8. Alteração de preço de atacado permite novo cálculo com novos preços no F12', async () => {
    prisma.channel.findUnique.mockResolvedValue(mockChannelOwnStore);
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({ totalCost: 3.98, isPartial: false });

    // Primeiro atacado: 7.27 -> Preço 15.90
    prisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-f7', name: 'Item F7', basePrice: null, wholesalePrice: new Prisma.Decimal('7.27') });
    const sim1 = await pricingService.simulate({ productId: 'prod-f7', channelId: 'chan-own-1' });
    expect(Number(sim1.calculatedPrice)).toBe(15.90);

    // Atacado atualizado para 8.00 -> Preço 8.00 / 0.46 = 17.39 -> ENDS_90 = 17.90
    prisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-f7', name: 'Item F7', basePrice: null, wholesalePrice: new Prisma.Decimal('8.00') });
    const sim2 = await pricingService.simulate({ productId: 'prod-f7', channelId: 'chan-own-1' });
    expect(Number(sim2.calculatedPrice)).toBe(17.90);
  });

  // =========================================================================
  // CENÁRIO 9: Somente canais habilitados recebem preços
  // =========================================================================
  it('9. Somente canais comercialmente habilitados em ProductChannel recebem cálculo F12', async () => {
    // Produto habilitado apenas na Loja Própria (não habilitado no Mercado Livre)
    prisma.productChannel.findMany.mockResolvedValue([
      { channelId: 'chan-own-1', isEnabled: true },
    ]);
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({ totalCost: 10.0, isPartial: false });
    prisma.channel.findMany.mockResolvedValue([mockChannelOwnStore]);
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Item 1', wholesalePrice: new Prisma.Decimal('7.27') });
    prisma.channel.findUnique.mockResolvedValue(mockChannelOwnStore);
    prisma.productChannelPrice.findFirst.mockResolvedValue(null);
    prisma.productChannelPrice.create.mockResolvedValue({
      id: 'pcp-own',
      productId: 'prod-1',
      channelId: 'chan-own-1',
      effectivePrice: new Prisma.Decimal('15.90'),
    });

    const results = await productService.recalculateEnabledChannelPrices('prod-1');
    expect(results.length).toBe(1);
    expect(results[0].channelId).toBe('chan-own-1');
  });

  // =========================================================================
  // CENÁRIO 10: Product.basePrice não interfere no cálculo
  // =========================================================================
  it('10. Product.basePrice diferente não altera o cálculo do F12 quando o custo F7 é o mesmo', async () => {
    prisma.channel.findUnique.mockResolvedValue(mockChannelOwnStore);
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({ totalCost: 15.0, isPartial: false });

    // Produto A tem basePrice = 39.90
    prisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-a', wholesalePrice: new Prisma.Decimal('7.27'), basePrice: new Prisma.Decimal('39.90') });
    const simA = await pricingService.simulate({ productId: 'prod-a', channelId: 'chan-own-1' });

    // Produto B tem basePrice = 999.00
    prisma.product.findUnique.mockResolvedValueOnce({ id: 'prod-b', wholesalePrice: new Prisma.Decimal('7.27'), basePrice: new Prisma.Decimal('999.00') });
    const simB = await pricingService.simulate({ productId: 'prod-b', channelId: 'chan-own-1' });

    // O preço calculado pelo F12 deve ser rigorosamente idêntico pois o atacado é 7.27
    expect(simA.calculatedPrice.toString()).toBe(simB.calculatedPrice.toString());
  });

  // =========================================================================
  // CENÁRIO 11: Produto sem custo aparece corretamente na administração
  // =========================================================================
  it('11. Produto sem custo F7 reporta status "Aguardando Ficha Técnica F7" no getPricingSummary', async () => {
    prisma.productionProfile.findFirst.mockResolvedValue(null);
    prisma.productChannel.findMany.mockResolvedValue([
      { channelId: 'chan-own-1', isEnabled: true, channel: mockChannelOwnStore },
      { channelId: 'chan-ml-1', isEnabled: true, channel: mockChannelML },
    ]);
    prisma.productChannelPrice.findMany.mockResolvedValue([]);

    const summary = await productService.getPricingSummary('prod-gat-sem-custo');

    expect(summary.hasValidCost).toBe(false);
    expect(summary.cost).toBeNull();
    expect(summary.statusLabel).toBe('Aguardando custo');
    expect(summary.ownStorePrice).toBeNull();
    expect(summary.channelPrices.every((c) => c.status === 'Aguardando custo')).toBe(true);
  });

  // =========================================================================
  // CENÁRIO 12: Preço antigo de Mercado Livre calculado com custo inválido é retido como não-válido
  // =========================================================================
  it('12. Preço persistido de Mercado Livre vinculado a custo inválido é retido e getEffectivePrice retorna null', async () => {
    // Simula produto sem ficha técnica F7
    prisma.productionProfile.findFirst.mockResolvedValue(null);
    
    // Registro existente no banco com R$ 66.90 e mode AUTOMATIC
    prisma.productChannelPrice.findFirst.mockResolvedValue({
      id: 'pcp-old-ml',
      productId: 'prod-fel-gat',
      channelId: 'chan-ml-1',
      mode: 'AUTOMATIC',
      costBasis: new Prisma.Decimal('39.90'),
      effectivePrice: new Prisma.Decimal('66.90'),
    });

    const effective = await pricingService.getEffectivePrice('prod-fel-gat', 'chan-ml-1');
    // Preço não deve ser considerado válido sem ficha F7 legítima
    expect(effective).toBeNull();
  });
});
