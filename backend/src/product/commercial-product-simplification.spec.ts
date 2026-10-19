import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { PricingService } from '../pricing/pricing.service';
import { CostResolverService } from '../pricing/services/cost-resolver.service';
import { Prisma, ProductStatus } from '@prisma/client';

describe('Simplificação do Cadastro Comercial de Produtos', () => {
  let service: ProductService;
  let prisma: any;
  let auditLog: any;
  let costResolver: any;
  let pricingService: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 0, reservedQuantity: 0 }),
      },
      productChannel: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productChannelPrice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    auditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    costResolver = {
      resolveCost: jest.fn().mockImplementation(async (productId: string) => {
        const prod = await prisma.product.findUnique({ where: { id: productId } });
        if (prod?.costSource === 'MANUAL' && prod?.manualCost) {
          return {
            source: 'MANUAL',
            cost: new Prisma.Decimal(prod.manualCost.toString()),
            isPartial: false,
            warnings: [],
          };
        }
        return {
          source: 'NONE',
          cost: new Prisma.Decimal(0),
          isPartial: true,
          warnings: ['Sem custo'],
        };
      }),
      getProductionCostOnly: jest.fn().mockResolvedValue(null),
    };

    pricingService = {
      calculateAndPersist: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: CostResolverService, useValue: costResolver },
        { provide: PricingService, useValue: pricingService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('1. Deve permitir criar Bolinha de Purga com custo MANUAL R$ 1,30, atacado pendente e estoque 0 sem exigir F7', async () => {
    const createdProduct = {
      id: 'prod-bolinha-1',
      name: 'Bolinha de Purga',
      slug: 'bolinha-de-purga',
      sku: 'FEL-BOL-001',
      brand: 'EuSou',
      status: ProductStatus.ACTIVE,
      basePrice: null,
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('1.30'),
      wholesalePrice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.product.create.mockResolvedValue(createdProduct);

    const result = await service.create({
      name: 'Bolinha de Purga',
      sku: 'FEL-BOL-001',
      status: ProductStatus.ACTIVE,
      brand: 'EuSou',
      costSource: 'MANUAL',
      manualCost: 1.30,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe('prod-bolinha-1');
    expect(result.costSource).toBe('MANUAL');
    expect(result.manualCost?.toString()).toBe('1.3');
    expect(result.wholesalePrice).toBeNull();

    // Inventory inicializado com zero para o produto base
    expect(prisma.inventory.create).toHaveBeenCalledWith({
      data: {
        productId: 'prod-bolinha-1',
        variantId: null,
        quantity: 0,
        reservedQuantity: 0,
        minimumQuantity: 5,
      },
    });
  });

  it('2. Dossiê comercial deve validar preço quando wholesalePrice estiver preenchido', () => {
    const prodWithWholesale = {
      name: 'Bolinha de Purga',
      sku: 'FEL-BOL-001',
      description: 'Bolinha de purga para felinos com material atóxico',
      basePrice: null,
      wholesalePrice: new Prisma.Decimal('2.50'),
      media: [{ id: 'm-1' }],
      categories: [{ categoryId: 'c-1' }],
      niches: [{ nicheId: 'n-1' }],
    };

    const dossier = service.calculateDossierCompleteness(prodWithWholesale);
    expect(dossier.percentage).toBe(100);
    expect(dossier.isReadyForCommercialUse).toBe(true);
    expect(dossier.missingFields).toEqual([]);
  });

  it('3. getPricingSummary deve refletir custo MANUAL e aguardar atacado se não informado', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-bolinha-1',
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('1.30'),
      wholesalePrice: null,
    });

    const summary = await service.getPricingSummary('prod-bolinha-1');

    expect(summary.costSource).toBe('MANUAL');
    expect(summary.manualCost).toBe(1.30);
    expect(summary.hasValidCost).toBe(true);
    expect(summary.hasValidWholesalePrice).toBe(false);
    expect(summary.statusLabel).toBe('Aguardando atacado');
  });

  it('4. findById deve calcular estoque físico disponível para produto base sem variantes', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-bolinha-1',
      name: 'Bolinha de Purga',
      variants: [],
      inventories: [
        { id: 'inv-1', quantity: 20, reservedQuantity: 2 },
      ],
    });

    const found = await service.findById('prod-bolinha-1') as any;

    expect(found.stock).toBe(20);
    expect(found.reservedStock).toBe(2);
    expect(found.availableStock).toBe(18);
  });

  describe('5. Cenários de status de custo e atacado na listagem findAll', () => {
    it('Cenário 1: Produto com custo manual + sem atacado deve indicar Aguardando atacado', async () => {
      prisma.product.findMany = jest.fn().mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Bolinha de Purga',
          costSource: 'MANUAL',
          manualCost: new Prisma.Decimal('1.30'),
          wholesalePrice: null,
          productChannelPrices: [],
          productionProfiles: [],
        },
      ]);
      prisma.product.count = jest.fn().mockResolvedValue(1);

      const res = await service.findAll({});
      expect(res.data[0].hasValidCost).toBe(true);
      expect(res.data[0].hasValidWholesalePrice).toBe(false);
      expect(res.data[0].statusCostLabel).toBe('Aguardando atacado');
    });

    it('Cenário 2: Produto com custo manual + atacado com preço F12 calculado', async () => {
      prisma.product.findMany = jest.fn().mockResolvedValue([
        {
          id: 'prod-2',
          name: 'Produto Manual com Atacado',
          costSource: 'MANUAL',
          manualCost: new Prisma.Decimal('5.00'),
          wholesalePrice: new Prisma.Decimal('10.00'),
          productChannelPrices: [
            { channel: { type: 'OWN_STORE' }, effectivePrice: new Prisma.Decimal('21.90') },
          ],
          productionProfiles: [],
        },
      ]);
      prisma.product.count = jest.fn().mockResolvedValue(1);

      const res = await service.findAll({});
      expect(res.data[0].hasValidCost).toBe(true);
      expect(res.data[0].hasValidWholesalePrice).toBe(true);
      expect(res.data[0].statusCostLabel).toBe('Calculado');
    });

    it('Cenário 3: Produto com F7 ativo apurado', async () => {
      prisma.product.findMany = jest.fn().mockResolvedValue([
        {
          id: 'prod-3',
          name: 'Porta Chaves Gatinho',
          costSource: 'COST_FROM_F7',
          manualCost: null,
          wholesalePrice: new Prisma.Decimal('7.27'),
          productChannelPrices: [
            { channel: { type: 'OWN_STORE' }, effectivePrice: new Prisma.Decimal('16.90') },
          ],
          productionProfiles: [{ id: 'prof-1', isActive: true }],
        },
      ]);
      prisma.product.count = jest.fn().mockResolvedValue(1);

      const res = await service.findAll({});
      expect(res.data[0].hasValidCost).toBe(true);
      expect(res.data[0].hasValidWholesalePrice).toBe(true);
      expect(res.data[0].statusCostLabel).toBe('Calculado');
    });

    it('Cenário 4: Produto sem custo (nem manual nem F7) deve indicar Aguardando custo', async () => {
      prisma.product.findMany = jest.fn().mockResolvedValue([
        {
          id: 'prod-4',
          name: 'Produto Sem Custo',
          costSource: 'COST_FROM_F7',
          manualCost: null,
          wholesalePrice: null,
          productChannelPrices: [],
          productionProfiles: [],
        },
      ]);
      prisma.product.count = jest.fn().mockResolvedValue(1);

      const res = await service.findAll({});
      expect(res.data[0].hasValidCost).toBe(false);
      expect(res.data[0].hasValidWholesalePrice).toBe(false);
      expect(res.data[0].statusCostLabel).toBe('Aguardando custo');
    });

    it('Cenário 5: Produto com custo manual + atacado mas sem preço OWN_STORE pré-persistido deve auto-sincronizar via F12', async () => {
      prisma.channel = {
        findFirst: jest.fn().mockResolvedValue({ id: 'chan-own', type: 'OWN_STORE', isActive: true }),
      };
      prisma.productChannel.findFirst = jest.fn().mockResolvedValue({ id: 'pc-1', productId: 'prod-5', channelId: 'chan-own', isEnabled: true });
      prisma.productChannel.create = jest.fn().mockResolvedValue({ id: 'pc-1' });
      prisma.productChannel.findMany = jest.fn().mockResolvedValue([{ channelId: 'chan-own' }]);
      prisma.product.findUnique = jest.fn().mockResolvedValue({
        id: 'prod-5',
        wholesalePrice: new Prisma.Decimal('6.07'),
        status: ProductStatus.ACTIVE,
      });

      pricingService.calculateAndPersist = jest.fn().mockResolvedValue([
        {
          channel: { type: 'OWN_STORE' },
          effectivePrice: new Prisma.Decimal('13.90'),
          calculationDetails: { channelType: 'OWN_STORE' },
        },
      ]);
      prisma.productChannelPrice.findMany = jest.fn().mockResolvedValue([
        {
          channel: { type: 'OWN_STORE' },
          effectivePrice: new Prisma.Decimal('13.90'),
        },
      ]);

      prisma.product.findMany = jest.fn().mockResolvedValue([
        {
          id: 'prod-5',
          name: 'Bolinha de Purga',
          status: ProductStatus.ACTIVE,
          costSource: 'MANUAL',
          manualCost: new Prisma.Decimal('3.54'),
          wholesalePrice: new Prisma.Decimal('6.07'),
          productChannelPrices: [],
          productionProfiles: [],
        },
      ]);
      prisma.product.count = jest.fn().mockResolvedValue(1);

      const res = await service.findAll({});
      expect(pricingService.calculateAndPersist).toHaveBeenCalled();
      expect(res.data[0].hasValidCost).toBe(true);
      expect(res.data[0].hasValidWholesalePrice).toBe(true);
      expect(res.data[0].statusCostLabel).toBe('Calculado');
      const ownPrice = res.data[0].productChannelPrices?.find(
        (p: any) => p.channel?.type === 'OWN_STORE'
      )?.effectivePrice;
      expect(ownPrice?.toString()).toBe('13.9');
    });
  });
});
