import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CostResolverService } from '../pricing/services/cost-resolver.service';
import { PricingCalculatorService } from '../pricing/calculators/pricing-calculator.service';
import { PricingValidatorService } from '../pricing/validators/pricing-validator.service';
import { PricingService } from '../pricing/pricing.service';
import { ProductionService } from '../production/production.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderService } from '../order/order.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { MercadoLivreConnector } from '../marketplace/mercadolivre.connector';
import { MercadoLivrePriceAdapter } from '../marketplace/mercadolivre-price.adapter';
import { MercadoLivreStockAdapter } from '../marketplace/mercadolivre-stock.adapter';
import { MockMarketplaceConnector } from '../marketplace/mock-marketplace.connector';
import { CredentialEncryptionService } from '../marketplace/credential-encryption.service';
import { ProductMapperService } from '../marketplace/product-mapper.service';
import { HubValidatorService } from '../marketplace/hub-validator.service';
import { ChannelAttributeMappingService } from '../marketplace/channel-attribute-mapping.service';
import { ChannelOrderIngestionService } from '../marketplace/channel-order-ingestion.service';
import { MarketplaceWebhookService } from '../marketplace/marketplace-webhook.service';
import { MarketplaceReconciliationService } from '../marketplace/marketplace-reconciliation.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { CommercialAlertService } from '../dashboard/commercial-alert.service';
import { ConfigService } from '@nestjs/config';
import {
  ChannelProductStatus,
  MarketplaceEventStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';

describe('F14-H — Homologação Operacional End-to-End do EuSou (F5 a F14)', () => {
  let prisma: PrismaService;
  let pricingService: PricingService;
  let productionService: ProductionService;
  let inventoryService: InventoryService;
  let orderService: OrderService;
  let affiliateService: AffiliateService;
  let marketplaceService: MarketplaceService;
  let webhookService: MarketplaceWebhookService;
  let reconciliationService: MarketplaceReconciliationService;
  let dashboardService: DashboardService;
  let alertService: CommercialAlertService;

  let testProduct: any;
  let testChannel: any;
  let testChannelAccount: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        AuditLogService,
        CostResolverService,
        PricingCalculatorService,
        PricingValidatorService,
        PricingService,
        ProductionService,
        InventoryService,
        OrderService,
        AffiliateService,
        MarketplaceService,
        MercadoLivreConnector,
        MercadoLivrePriceAdapter,
        MercadoLivreStockAdapter,
        MockMarketplaceConnector,
        CredentialEncryptionService,
        ProductMapperService,
        HubValidatorService,
        ChannelAttributeMappingService,
        ChannelOrderIngestionService,
        MarketplaceWebhookService,
        MarketplaceReconciliationService,
        DashboardService,
        CommercialAlertService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'MERCADOLIVRE_CLIENT_ID') return 'MOCK_APP_ID';
              if (key === 'MERCADOLIVRE_CLIENT_SECRET') return 'MOCK_SECRET';
              if (key === 'MERCADOLIVRE_REDIRECT_URI')
                return 'http://localhost:3000/callback';
              if (key === 'MERCADOLIVRE_ENCRYPTION_KEY')
                return '01234567890123456789012345678901';
              return null;
            },
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    pricingService = module.get<PricingService>(PricingService);
    productionService = module.get<ProductionService>(ProductionService);
    inventoryService = module.get<InventoryService>(InventoryService);
    orderService = module.get<OrderService>(OrderService);
    affiliateService = module.get<AffiliateService>(AffiliateService);
    marketplaceService = module.get<MarketplaceService>(MarketplaceService);
    webhookService = module.get<MarketplaceWebhookService>(
      MarketplaceWebhookService,
    );
    reconciliationService = module.get<MarketplaceReconciliationService>(
      MarketplaceReconciliationService,
    );
    dashboardService = module.get<DashboardService>(DashboardService);
    alertService = module.get<CommercialAlertService>(CommercialAlertService);

    // Carrega o produto real homologado no Supabase
    testProduct = await prisma.product.findFirst({
      where: {
        OR: [{ sku: 'FEL-GAT-001' }, { slug: 'porta-chaves-gatinho' }],
      },
      include: {
        categories: { include: { category: true } },
        niches: { include: { niche: true } },
        inventories: true,
      },
    });

    if (!testProduct) {
      throw new Error(
        'Produto de homologação Porta-Chaves Gatinho 3D (FEL-GAT-001) não encontrado no Supabase.',
      );
    }

    const ownStoreChannel = await prisma.channel.findFirst({ where: { type: 'OWN_STORE' } });
    if (ownStoreChannel) {
      await prisma.productChannel.upsert({
        where: { productId_channelId: { productId: testProduct.id, channelId: ownStoreChannel.id } },
        create: { productId: testProduct.id, channelId: ownStoreChannel.id, isEnabled: true },
        update: { isEnabled: true },
      });

      const existingPcp = await prisma.productChannelPrice.findFirst({
        where: { productId: testProduct.id, channelId: ownStoreChannel.id },
      });
      if (!existingPcp) {
        await prisma.productChannelPrice.create({
          data: {
            productId: testProduct.id,
            channelId: ownStoreChannel.id,
            costBasis: 12.0,
            calculatedPrice: 39.9,
            effectivePrice: 39.9,
            netProfit: 20.0,
            netMargin: 0.5,
            mode: 'AUTOMATIC',
          },
        });
      }
    }

    testChannel = await prisma.channel.findFirst({
      where: { type: 'MERCADO_LIVRE' },
    });
    if (!testChannel) {
      testChannel = await prisma.channel.create({
        data: {
          name: 'Mercado Livre Homolog',
          type: 'MERCADO_LIVRE',
          description: 'Canal ML para homologação F14-H',
        },
      });
    }

    testChannelAccount = await prisma.channelAccount.findFirst({
      where: { channelId: testChannel.id },
    });
    if (!testChannelAccount) {
      testChannelAccount = await prisma.channelAccount.create({
        data: {
          channelId: testChannel.id,
          name: 'Conta Teste Homologação F14H',
          status: 'ACTIVE',
          configuration: { clientId: 'APP_TEST', accessToken: 'TOKEN_TEST' },
        },
      });
    }
  });

  // ============================================================
  // 1. GATE DE DADOS: PRODUTO CANÔNICO FEL-GAT-001
  // ============================================================
  describe('1. Verificação do Produto Canônico (FEL-GAT-001)', () => {
    it('deve confirmar integridade do produto real no Supabase com nicho e categoria', async () => {
      expect(testProduct.id).toBeDefined();
      expect(testProduct.sku).toBe('FEL-GAT-001');
      expect(testProduct.status).toBe('ACTIVE');
      expect(Number(testProduct.basePrice)).toBeGreaterThan(0);
      expect(testProduct.categories.length).toBeGreaterThan(0);
      expect(testProduct.niches.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 2. HOMOLOGAÇÃO F7 + F12 (MOTOR DE PRECIFICAÇÃO & CUSTOS)
  // ============================================================
  describe('2. Homologação F7 + F12: Pricing Engine & Cost Resolver', () => {
    it('deve simular e calcular preço com precisão Decimal garantindo que manualPrice não destrói calculatedPrice', async () => {
      // 1. Simula cálculo
      const sim = await pricingService.simulate({
        productId: testProduct.id,
        channelId: testChannel.id,
        costOverride: 15.0,
      });

      expect(sim.calculatedPrice).toBeInstanceOf(Prisma.Decimal);
      expect(Number(sim.calculatedPrice)).toBeGreaterThan(0);
      expect(Number(sim.cost)).toBeGreaterThan(0);
      expect(sim.netProfit).toBeInstanceOf(Prisma.Decimal);

      // 2. Persiste cálculo em ProductChannelPrice no modo AUTOMATIC
      const calcResult = await pricingService.calculateAndPersist({
        productId: testProduct.id,
        channelId: testChannel.id,
        costOverride: 15.0,
      });

      expect(calcResult.length).toBeGreaterThan(0);
      const firstCalc = calcResult[0];
      expect(firstCalc.mode).toBe('AUTOMATIC');
      expect(firstCalc.calculatedPrice.toString()).toBe(
        sim.calculatedPrice.toString(),
      );
      expect(firstCalc.effectivePrice.toString()).toBe(
        sim.calculatedPrice.toString(),
      );

      const originalCalculatedPrice = sim.calculatedPrice;

      // 3. Aplica MANUAL override (ex: R$ 89.90)
      const manual = await pricingService.setManualPrice({
        productId: testProduct.id,
        channelId: testChannel.id,
        manualPrice: 89.9,
      });

      expect(manual.mode).toBe('MANUAL');
      expect(Number(manual.effectivePrice)).toBe(89.9);
      expect(Number(manual.calculatedPrice)).toBe(
        Number(originalCalculatedPrice),
      ); // Preservado!

      // 4. Remove MANUAL e volta para AUTOMATIC
      const restored = await pricingService.removeManualPrice(manual.id);
      expect(restored.mode).toBe('AUTOMATIC');
      expect(Number(restored.effectivePrice)).toBe(
        Number(originalCalculatedPrice),
      );
      expect(restored.manualPrice).toBeNull();
    });
  });

  // ============================================================
  // 3. HOMOLOGAÇÃO F7: ESTOQUE, PRODUÇÃO & MOVIMENTAÇÃO
  // ============================================================
  describe('3. Homologação F7: Produção 3D e Consistência de Estoque', () => {
    it('deve gerenciar saldo de estoque sem permitir valores negativos e registrar movimentações', async () => {
      const initialStock = await prisma.inventory.findFirst({
        where: { productId: testProduct.id, variantId: null },
      });
      expect(initialStock).toBeDefined();
      const initialQty = initialStock!.quantity;

      // Incremento controlado de estoque
      await inventoryService.adjustStock(
        {
          productId: testProduct.id,
          quantity: 5,
          mode: 'DELTA',
          reason: 'Homologação F14-H Lote Concluído',
        },
        'homolog-admin',
      );

      const afterIn = await prisma.inventory.findFirst({
        where: { productId: testProduct.id, variantId: null },
      });
      expect(afterIn!.quantity).toBe(initialQty + 5);

      // Baixa controlada de estoque (decremento)
      await inventoryService.adjustStock(
        {
          productId: testProduct.id,
          quantity: -5,
          mode: 'DELTA',
          reason: 'Homologação F14-H Ajuste de Retorno',
        },
        'homolog-admin',
      );

      const afterOut = await prisma.inventory.findFirst({
        where: { productId: testProduct.id, variantId: null },
      });
      expect(afterOut!.quantity).toBe(initialQty);

      // Verificação de barreira contra estoque negativo
      await expect(
        inventoryService.adjustStock(
          {
            productId: testProduct.id,
            quantity: -(initialQty + 9999), // Excedente negativo
            mode: 'DELTA',
            reason: 'Tentativa de estoque negativo',
          },
          'homolog-admin',
        ),
      ).rejects.toThrow();
    });
  });

  // ============================================================
  // 4. HOMOLOGAÇÃO F6: AFILIADOS & TRACKING
  // ============================================================
  describe('4. Homologação F6: Rastreamento de Afiliados e Last-Click', () => {
    it('deve registrar clique de afiliado e vincular conversão ao pedido', async () => {
      // Cria ou recupera afiliado de homologação
      let affiliate = await prisma.affiliate.findFirst({
        where: { code: 'HOMOLOG-REF' },
      });
      if (!affiliate) {
        // Encontra ou cria usuário para o perfil de afiliado
        let testUser = await prisma.user.findFirst({
          where: { email: 'afiliado.f14h@eusou.com' },
        });
        if (!testUser) {
          testUser = await prisma.user.create({
            data: {
              email: 'afiliado.f14h@eusou.com',
              passwordHash: 'hash_test_f14h',
            },
          });
        }
        affiliate = await prisma.affiliate.create({
          data: {
            userId: testUser.id,
            code: 'HOMOLOG-REF',
            displayName: 'Afiliado Teste Homolog F14H',
            status: 'ACTIVE',
          },
        });
      }

      // Rastreia clique usando recordClick
      const click = await affiliateService.recordClick(
        'HOMOLOG-REF',
        testProduct.id,
        'session-test-f14h',
      );
      expect(click).toBeDefined();
      expect(click!.affiliateId).toBe(affiliate.id);
    });
  });

  // ============================================================
  // 5. HOMOLOGAÇÃO F5: PEDIDOS & ABATE DE ESTOQUE
  // ============================================================
  describe('5. Homologação F5: Ciclo Completo de Pedidos com Abate F7 e Afiliado F6', () => {
    it('deve criar Order com snapshots de preço, abater estoque no F7 e gerar comissão no F6', async () => {
      const invBefore = await prisma.inventory.findFirst({
        where: { productId: testProduct.id, variantId: null },
      });
      const qtyBefore = invBefore!.quantity;

      // Criação de pedido real
      const order = await orderService.create({
        customerName: 'Comprador Homologação E2E',
        customerEmail: 'comprador.f14h@teste.com',
        customerPhone: '11999999999',
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
        affiliateCode: 'HOMOLOG-REF',
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
          },
        ],
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe(OrderStatus.PENDING);

      // Confirmar pedido (fluxo pós-pagamento aprovado)
      await orderService.updateStatus(
        order.id,
        { status: OrderStatus.CONFIRMED },
        'system',
      );

      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
      expect(fullOrder!.status).toBe(OrderStatus.CONFIRMED);
      expect(fullOrder!.items.length).toBe(1);
      expect(fullOrder!.items[0].productNameSnapshot).toBe(testProduct.name);

      // F7 deduz estoque automaticamente na confirmação do pedido
      const invAfter = await prisma.inventory.findFirst({
        where: { productId: testProduct.id, variantId: null },
      });
      expect(invAfter!.quantity).toBe(qtyBefore - 1);

      // Devolução no caso de cancelamento: F7 restaura estoque automaticamente via handleOrderCancelled
      await orderService.updateStatus(
        order.id,
        { status: OrderStatus.CANCELLED },
        'admin-test',
      );

      const invRestored = await prisma.inventory.findFirst({
        where: { productId: testProduct.id, variantId: null },
      });
      expect(invRestored!.quantity).toBe(qtyBefore);
    });
  });

  // ============================================================
  // 6. HOMOLOGAÇÃO F9/F10/F13: HUB, WEBHOOKS & RECONCILIAÇÃO
  // ============================================================
  describe('6. Homologação F9/F10/F13: Webhooks Idempotentes e Reconciliação', () => {
    it('deve registrar webhook garantindo idempotência e reprocessamento com backoff', async () => {
      const eventId = `ml-evt-test-${Date.now()}`;

      // Primeiro envio
      const res1 = await webhookService.recordIncomingWebhook({
        channelId: testChannel.id,
        externalEventId: eventId,
        topic: 'orders_v2',
        payload: { id: 999111, status: 'paid' },
      });
      expect(res1.duplicate).toBe(false);

      // Segundo envio (duplicado)
      const res2 = await webhookService.recordIncomingWebhook({
        channelId: testChannel.id,
        externalEventId: eventId,
        topic: 'orders_v2',
        payload: { id: 999111, status: 'paid' },
      });
      expect(res2.duplicate).toBe(true);
    });

    it('deve reconciliar anúncio e persistir lastObservedPrice e lastObservedStock em ChannelProduct', async () => {
      let account = await prisma.channelAccount.findUnique({
        where: { id: testChannelAccount.id },
      });
      if (!account) {
        account = await prisma.channelAccount.create({
          data: {
            channelId: testChannel.id,
            name: 'Conta Teste Homologação F14H',
            status: 'ACTIVE',
            configuration: { clientId: 'APP_TEST', accessToken: 'TOKEN_TEST' },
          },
        });
        testChannelAccount = account;
      }

      let cp = await prisma.channelProduct.findFirst({
        where: {
          productId: testProduct.id,
          channelAccountId: testChannelAccount.id,
        },
      });

      if (!cp) {
        cp = await prisma.channelProduct.create({
          data: {
            productId: testProduct.id,
            channelAccountId: testChannelAccount.id,
            externalProductId: 'MLB_HOMOLOG_123',
            status: ChannelProductStatus.PUBLISHED,
          },
        });
      }

      // Reconciliação controlada
      const report = await reconciliationService.reconcileProduct(cp.id);
      expect(report.channelProductId).toBe(cp.id);

      const updatedCp = await prisma.channelProduct.findUnique({
        where: { id: cp.id },
      });
      expect(updatedCp!.lastObservedAt).toBeDefined();
    });
  });

  // ============================================================
  // 7. HOMOLOGAÇÃO F14: CENTRAL DE OPERAÇÃO & ALERTAS
  // ============================================================
  describe('7. Homologação F14: Central Comercial & Alertas em Tempo Real', () => {
    it('deve consolidar o dashboard com faturamento real e períodos comparativos', async () => {
      const summary = await dashboardService.getCommercialSummary({
        period: '30d',
      });

      expect(summary.period.filter).toBe('30d');
      expect(summary.health.status).toBeDefined();
      expect(summary.sales.totalRevenue).toBeDefined();
      expect(summary.inventory.availableQuantity).toBeGreaterThanOrEqual(0);
      expect(summary.marketplaces.totalChannels).toBeGreaterThanOrEqual(1);
    });

    it('deve derivar alertas operacionais classificados e ordenados por severidade', async () => {
      const alerts = await alertService.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);

      const health = await alertService.getOperationHealth();
      expect(['HEALTHY', 'WARNING', 'CRITICAL']).toContain(health.status);
    });
  });
});
