import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { OrderService } from './order/order.service';
import { PricingService } from './pricing/pricing.service';
import { PublicStoreService } from './public-store/public-store.service';
import { PrismaService } from './prisma.service';
import { AuditLogService } from './audit-log.service';
import { AffiliateService } from './affiliate/affiliate.service';
import { InventoryService } from './inventory/inventory.service';
import { PricingModule } from './pricing/pricing.module';

describe('Consolidação Arquitetural: Loja Pública, Order e Preço por Nicho', () => {
  let prisma: PrismaService;
  let orderService: OrderService;
  let pricingService: PricingService;
  let publicStoreService: PublicStoreService;

  // IDs para os testes
  let testNicheId: string;
  let testChannelId: string;
  let testProductId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PricingModule],
      providers: [
        PrismaService,
        AuditLogService,
        {
          provide: AffiliateService,
          useValue: {
            handleOrderCreated: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: InventoryService,
          useValue: {
            adjustStock: jest.fn().mockResolvedValue(undefined),
            reserveStockForOrder: jest.fn().mockResolvedValue(undefined),
            releaseStockForOrder: jest.fn().mockResolvedValue(undefined),
            handleOrderConfirmed: jest.fn().mockResolvedValue(undefined),
            handleOrderCancelled: jest.fn().mockResolvedValue(undefined),
          },
        },
        OrderService,
        PublicStoreService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    orderService = module.get<OrderService>(OrderService);
    pricingService = module.get<PricingService>(PricingService);
    publicStoreService = module.get<PublicStoreService>(PublicStoreService);

    // 1. Obter ou criar Nicho e Tema
    const existingNiche = await prisma.niche.findFirst({
      where: { slug: 'pet-shop' },
    });
    if (existingNiche) {
      testNicheId = existingNiche.id;
    } else {
      const createdNiche = await prisma.niche.create({
        data: {
          name: 'Pet Shop Teste',
          slug: 'pet-shop-teste-' + Date.now(),
          brandName: 'Felinodelia',
        },
      });
      testNicheId = createdNiche.id;
    }

    // 2. Obter Canal Loja Própria
    let channel = await prisma.channel.findFirst({
      where: { type: 'OWN_STORE' },
    });
    if (!channel) {
      channel = await prisma.channel.create({
        data: {
          name: 'Loja Própria',
          type: 'OWN_STORE',
        },
      });
    }
    testChannelId = channel.id;

    // 3. Obter ou criar Produto mestre central
    let product = await prisma.product.findFirst({
      where: { status: 'ACTIVE' },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: 'Comedouro Elevado de Teste',
          slug: 'comedouro-teste-' + Date.now(),
          sku: 'COM-TEST-' + Date.now(),
          basePrice: '45.00',
          status: 'ACTIVE',
        },
      });
    }
    testProductId = product.id;

    // Garante que o produto de teste está habilitado no canal
    await prisma.productChannel.upsert({
      where: {
        productId_channelId: {
          productId: testProductId,
          channelId: testChannelId,
        },
      },
      create: {
        productId: testProductId,
        channelId: testChannelId,
        isEnabled: true,
      },
      update: {
        isEnabled: true,
      },
    });

    // Garante preço comercial no canal para o produto de teste
    const existingPcp = await prisma.productChannelPrice.findFirst({
      where: {
        productId: testProductId,
        channelId: testChannelId,
        variantId: null,
        nicheId: null,
      },
    });
    if (existingPcp) {
      await prisma.productChannelPrice.update({
        where: { id: existingPcp.id },
        data: {
          effectivePrice: new Prisma.Decimal('45.00'),
          mode: 'MANUAL',
          manualPrice: new Prisma.Decimal('45.00'),
        },
      });
    } else {
      await prisma.productChannelPrice.create({
        data: {
          productId: testProductId,
          channelId: testChannelId,
          costBasis: new Prisma.Decimal('20.00'),
          calculatedPrice: new Prisma.Decimal('45.00'),
          effectivePrice: new Prisma.Decimal('45.00'),
          netProfit: new Prisma.Decimal('10.00'),
          netMargin: new Prisma.Decimal('0.22'),
          mode: 'MANUAL',
          manualPrice: new Prisma.Decimal('45.00'),
        },
      });
    }
  });

  describe('A) Loja Pública: Identidade Contextualizada', () => {
    it('deve obter o contexto público do Nicho sem forçar branding fixo', async () => {
      // Configurar identidade pública no nicho
      await prisma.niche.update({
        where: { id: testNicheId },
        data: {
          brandName: 'Felinodelia Oficial',
          logoUrl: 'https://cdn.felinodelia.com/logo.png',
        },
      });

      const context = await publicStoreService.getStoreContext(testNicheId);

      expect(context).toBeDefined();
      expect(context.brandName).toBe('Felinodelia Oficial');
      expect(context.nicheId).toBe(testNicheId);
      expect(context.logoUrl).toBe('https://cdn.felinodelia.com/logo.png');
    });

    it('não deve quebrar quando chamado sem identificador (fallback gracioso para nicho ativo)', async () => {
      const context = await publicStoreService.getStoreContext();
      expect(context).toBeDefined();
      expect(context.nicheId).toBeDefined();
    });
  });

  describe('B) Order: Rastreabilidade da Origem Comercial', () => {
    it('deve criar um pedido preservando nicheId, channelId, originDomain e utmSource', async () => {
      const order = await orderService.create({
        customerName: 'Cliente Rastreabilidade Teste',
        customerEmail: `teste_${Date.now()}@exemplo.com`,
        customerPhone: '11999998888',
        street: 'Rua Comercial',
        number: '100',
        neighborhood: 'Bairro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
        nicheId: testNicheId,
        channelId: testChannelId,
        originDomain: 'loja.felinodelia.com.br',
        utmSource: 'instagram_ads',
        items: [
          {
            productId: testProductId,
            quantity: 1,
          },
        ],
      });

      expect(order).toBeDefined();
      expect(order.nicheId).toBe(testNicheId);
      expect(order.channelId).toBe(testChannelId);
      expect(order.originDomain).toBe('loja.felinodelia.com.br');
      expect(order.utmSource).toBe('instagram_ads');

      // Limpeza segura
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    });

    it('deve criar um pedido sem dados de origem (retrocompatibilidade perfeita)', async () => {
      const order = await orderService.create({
        customerName: 'Cliente Legado Teste',
        customerEmail: `legado_${Date.now()}@exemplo.com`,
        customerPhone: '11999997777',
        street: 'Rua Legada',
        number: '200',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
        items: [
          {
            productId: testProductId,
            quantity: 1,
          },
        ],
      });

      expect(order).toBeDefined();
      expect(order.nicheId).toBeNull();
      // Na Consolidação Comercial (P1), canal omitido resolve automaticamente para OWN_STORE
      expect([null, testChannelId]).toContain(order.channelId);
      expect(order.originDomain).toBeNull();
      expect(order.utmSource).toBeNull();

      // Limpeza segura
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    });
  });

  describe('C) Pricing: Preço Contextual por Nicho e Resolução Hierárquica', () => {
    let secondNicheId: string;

    beforeAll(async () => {
      // Criar segundo nicho temporário para provar preços diferentes do mesmo produto
      const secondNiche = await prisma.niche.create({
        data: {
          name: 'Decoração Casa Teste',
          slug: 'decoracao-teste-' + Date.now(),
        },
      });
      secondNicheId = secondNiche.id;
    });

    afterAll(async () => {
      // Limpeza de preços de teste
      await prisma.productChannelPrice.deleteMany({
        where: { productId: testProductId, channelId: testChannelId },
      });
      await prisma.niche.delete({ where: { id: secondNicheId } });
    });

    it('deve suportar preço global de canal (sem nicho)', async () => {
      // 1. Cadastrar preço global no canal (nicheId null) = R$ 50,00
      await pricingService.setManualPrice(
        {
          productId: testProductId,
          channelId: testChannelId,
          manualPrice: 50.0,
        },
        'test-actor',
      );

      // Resolução sem nicho deve retornar R$ 50,00
      const price = await pricingService.getEffectivePrice(
        testProductId,
        testChannelId,
        null,
        null,
      );
      expect(Number(price)).toBe(50.0);
    });

    it('deve permitir que o mesmo Product tenha preços diferentes por Nicho no mesmo Canal sem duplicar Product', async () => {
      // 2. Definir preço específico para Nicho Pet Shop = R$ 42.00
      await pricingService.setManualPrice(
        {
          productId: testProductId,
          channelId: testChannelId,
          nicheId: testNicheId,
          manualPrice: 42.0,
        },
        'test-actor',
      );

      // 3. Definir preço específico para Nicho Decoração = R$ 58.00
      await pricingService.setManualPrice(
        {
          productId: testProductId,
          channelId: testChannelId,
          nicheId: secondNicheId,
          manualPrice: 58.0,
        },
        'test-actor',
      );

      // Consultar preço no contexto Pet Shop
      const pricePetShop = await pricingService.getEffectivePrice(
        testProductId,
        testChannelId,
        null,
        testNicheId,
      );
      expect(Number(pricePetShop)).toBe(42.0);

      // Consultar preço no contexto Decoração
      const priceDecoracao = await pricingService.getEffectivePrice(
        testProductId,
        testChannelId,
        null,
        secondNicheId,
      );
      expect(Number(priceDecoracao)).toBe(58.0);

      // Fallback: consultar canal sem nicho deve retornar o preço global R$ 50.00
      const priceGlobal = await pricingService.getEffectivePrice(
        testProductId,
        testChannelId,
        null,
        null,
      );
      expect(Number(priceGlobal)).toBe(50.0);

      // Garantir que o Produto continua sendo UM ÚNICO registro
      const productCount = await prisma.product.count({
        where: { id: testProductId },
      });
      expect(productCount).toBe(1);
    });
  });
});
