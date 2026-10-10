import { Test, TestingModule } from '@nestjs/testing';
import { HubValidatorService } from './hub-validator.service';
import { ChannelAttributeMappingService } from './channel-attribute-mapping.service';
import { ChannelOrderIngestionService } from './channel-order-ingestion.service';
import { MarketplaceWebhookService } from './marketplace-webhook.service';
import { MarketplaceReconciliationService } from './marketplace-reconciliation.service';
import { MockMarketplaceConnector } from './mock-marketplace.connector';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { PricingService } from '../pricing/pricing.service';
import { Prisma, OrderStatus, MarketplaceEventStatus } from '@prisma/client';

describe('Marketplace Hub Core (F13A)', () => {
  let hubValidator: HubValidatorService;
  let attributeMappingService: ChannelAttributeMappingService;
  let orderIngestionService: ChannelOrderIngestionService;
  let webhookService: MarketplaceWebhookService;
  let reconciliationService: MarketplaceReconciliationService;
  let prisma: any;
  let auditLog: any;
  let pricingService: any;
  let mockConnector: any;
  let mlConnector: any;

  beforeEach(async () => {
    prisma = {
      channel: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      channelAccount: {
        findUnique: jest.fn(),
      },
      channelProduct: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      channelAttributeMapping: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      attributeDefinition: {
        findUnique: jest.fn(),
      },
      channelOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      inventory: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      marketplaceEvent: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    auditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    pricingService = {
      getEffectivePrice: jest.fn(),
    };

    mockConnector = {
      channelType: 'OTHER',
      syncProduct: jest.fn().mockResolvedValue({
        success: true,
        rawResponse: { price: 59.9, available_quantity: 15, status: 'active' },
      }),
    };

    mlConnector = {
      channelType: 'MERCADO_LIVRE',
      syncProduct: jest.fn().mockResolvedValue({
        success: true,
        rawResponse: { price: 59.9, available_quantity: 15, status: 'active' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubValidatorService,
        ChannelAttributeMappingService,
        ChannelOrderIngestionService,
        MarketplaceWebhookService,
        MarketplaceReconciliationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: PricingService, useValue: pricingService },
        { provide: MockMarketplaceConnector, useValue: mockConnector },
        { provide: MercadoLivreConnector, useValue: mlConnector },
      ],
    }).compile();

    hubValidator = module.get<HubValidatorService>(HubValidatorService);
    attributeMappingService = module.get<ChannelAttributeMappingService>(
      ChannelAttributeMappingService,
    );
    orderIngestionService = module.get<ChannelOrderIngestionService>(
      ChannelOrderIngestionService,
    );
    webhookService = module.get<MarketplaceWebhookService>(MarketplaceWebhookService);
    reconciliationService = module.get<MarketplaceReconciliationService>(
      MarketplaceReconciliationService,
    );
  });

  // ============================================================
  // 1. HubValidatorService
  // ============================================================
  describe('HubValidatorService', () => {
    it('deve aprovar produto com todos os dados consistentes', () => {
      const product = {
        id: 'prod-1',
        name: 'Camiseta Algodão Egípcio Premium',
        sku: 'TSHIRT-01',
        status: 'ACTIVE',
        media: [{ url: 'https://cdn.eusou.com.br/img1.jpg' }],
      };

      const result = hubValidator.validateForPublication(product, {
        externalCategoryId: 'MLB3530',
        resolvedPrice: 89.9,
        availableStock: 25,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.info.length).toBeGreaterThan(0);
    });

    it('deve reprovar produto inativo, sem categoria e com preço zerado', () => {
      const product = {
        id: 'prod-2',
        name: 'Camisa',
        sku: 'TSHIRT-02',
        status: 'DRAFT',
        media: [],
      };

      const result = hubValidator.validateForPublication(product, {
        resolvedPrice: 0,
        availableStock: -1,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'PRODUCT_NOT_ACTIVE')).toBe(true);
      expect(result.errors.some((e) => e.code === 'CATEGORY_MAPPING_MISSING')).toBe(true);
      expect(result.errors.some((e) => e.code === 'PRICE_INVALID')).toBe(true);
      expect(result.errors.some((e) => e.code === 'IMAGES_REQUIRED')).toBe(true);
      expect(result.errors.some((e) => e.code === 'STOCK_NEGATIVE')).toBe(true);
    });
  });

  // ============================================================
  // 2. ChannelAttributeMappingService
  // ============================================================
  describe('ChannelAttributeMappingService', () => {
    it('deve cadastrar e resolver atributos mapeados corretamente', async () => {
      prisma.channel.findUnique.mockResolvedValue({ id: 'ch-1' });
      prisma.attributeDefinition.findUnique.mockResolvedValue({ id: 'attr-def-cor' });
      prisma.channelAttributeMapping.findFirst.mockResolvedValue(null);
      prisma.channelAttributeMapping.create.mockResolvedValue({
        id: 'map-1',
        channelId: 'ch-1',
        attributeDefinitionId: 'attr-def-cor',
        externalAttributeId: 'COLOR',
        isRequired: true,
      });

      const mapping = await attributeMappingService.upsertMapping({
        channelId: 'ch-1',
        attributeDefinitionId: 'attr-def-cor',
        externalAttributeId: 'COLOR',
        isRequired: true,
      });

      expect(mapping.externalAttributeId).toBe('COLOR');

      // Teste de resolução
      prisma.channelAttributeMapping.findMany.mockResolvedValue([
        {
          attributeDefinitionId: 'attr-def-cor',
          externalAttributeId: 'COLOR',
          valueMapping: { 'Preto Fosco': 'BLACK' },
        },
      ]);

      const resolved = await attributeMappingService.resolveMappedAttributes(
        'ch-1',
        {
          attributeValues: [
            { attributeDefinitionId: 'attr-def-cor', value: 'Preto Fosco' },
          ],
        },
      );

      expect(resolved['COLOR']).toBe('BLACK');
    });
  });

  // ============================================================
  // 3. ChannelOrderIngestionService (F13A + F5 + F7)
  // ============================================================
  describe('ChannelOrderIngestionService', () => {
    it('deve ingerir pedido de marketplace, criar Order interna e abater estoque', async () => {
      prisma.channelOrder.findUnique.mockResolvedValue(null);
      prisma.channel.findUnique.mockResolvedValue({ id: 'ch-1', name: 'Mercado Livre' });
      prisma.channelAccount.findUnique.mockResolvedValue({ id: 'acc-1' });
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Camiseta',
        sku: 'TSHIRT-01',
      });
      prisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 20,
        reservedQuantity: 0,
      });

      prisma.order.create.mockResolvedValue({
        id: 'order-internal-100',
        total: new Prisma.Decimal('99.90'),
        status: OrderStatus.CONFIRMED,
      });

      prisma.channelOrder.create.mockResolvedValue({
        id: 'co-1',
        channelId: 'ch-1',
        channelAccountId: 'acc-1',
        orderId: 'order-internal-100',
        externalOrderId: 'MLB-ORD-777',
        externalStatus: 'paid',
        externalTotal: new Prisma.Decimal('99.90'),
      });

      const res = await orderIngestionService.ingestOrder({
        channelId: 'ch-1',
        channelAccountId: 'acc-1',
        externalOrderId: 'MLB-ORD-777',
        externalStatus: 'paid',
        externalTotal: 99.9,
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            unitPrice: 49.95,
            title: 'Camiseta',
          },
        ],
      });

      expect(res.alreadyExists).toBe(false);
      expect(res.channelOrder.orderId).toBe('order-internal-100');
      // Abate de estoque verificado: 20 - 2 = 18
      expect(prisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quantity: 18 },
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            quantity: 2,
            type: 'OUT',
          }),
        }),
      );
    });

    it('deve ser idempotente quando o mesmo pedido já tiver sido ingerido', async () => {
      prisma.channelOrder.findUnique.mockResolvedValue({
        id: 'co-1',
        channelId: 'ch-1',
        externalOrderId: 'MLB-ORD-777',
        orderId: 'order-internal-100',
        rawPayload: {},
      });
      prisma.channelOrder.update.mockResolvedValue({
        id: 'co-1',
        orderId: 'order-internal-100',
        externalStatus: 'shipped',
      });

      const res = await orderIngestionService.ingestOrder({
        channelId: 'ch-1',
        channelAccountId: 'acc-1',
        externalOrderId: 'MLB-ORD-777',
        externalStatus: 'shipped',
        externalTotal: 99.9,
      });

      expect(res.alreadyExists).toBe(true);
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.inventory.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 4. MarketplaceWebhookService (Idempotência e Resposta Rápida)
  // ============================================================
  describe('MarketplaceWebhookService', () => {
    it('deve gravar evento recebido imediatamente para responder rápido', async () => {
      prisma.marketplaceEvent.findUnique.mockResolvedValue(null);
      prisma.marketplaceEvent.create.mockResolvedValue({
        id: 'evt-1',
        channelId: 'ch-1',
        externalEventId: 'evt-ml-999',
        topic: 'orders_v2',
        status: MarketplaceEventStatus.RECEIVED,
      });

      const res = await webhookService.recordIncomingWebhook({
        channelId: 'ch-1',
        externalEventId: 'evt-ml-999',
        topic: 'orders_v2',
        payload: { id: 'order-123' },
      });

      expect(res.duplicate).toBe(false);
      expect(res.event.id).toBe('evt-1');
    });

    it('deve sinalizar duplicidade quando evento já existir', async () => {
      prisma.marketplaceEvent.findUnique.mockResolvedValue({
        id: 'evt-1',
        externalEventId: 'evt-ml-999',
      });

      const res = await webhookService.recordIncomingWebhook({
        channelId: 'ch-1',
        externalEventId: 'evt-ml-999',
        topic: 'orders_v2',
        payload: {},
      });

      expect(res.duplicate).toBe(true);
      expect(prisma.marketplaceEvent.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 5. MarketplaceReconciliationService
  // ============================================================
  describe('MarketplaceReconciliationService', () => {
    it('deve reconciliar sem discrepâncias quando valores locais e remotos batem', async () => {
      prisma.channelProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        productId: 'prod-1',
        externalProductId: 'MLB123',
        status: 'PUBLISHED',
        channelAccount: {
          channelId: 'ch-1',
          configuration: {},
          channel: { type: 'OTHER', name: 'Mock Channel' },
        },
        product: {
          inventories: [{ quantity: 15, reservedQuantity: 0 }],
        },
      });

      pricingService.getEffectivePrice.mockResolvedValue(new Prisma.Decimal('59.90'));

      const report = await reconciliationService.reconcileProduct('cp-1');

      expect(report.hasDiscrepancy).toBe(false);
      expect(report.discrepancies.price).toBeUndefined();
      expect(report.discrepancies.stock).toBeUndefined();
    });

    it('deve acusar discrepância quando preço remoto divergir do preço efetivo F12', async () => {
      prisma.channelProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        productId: 'prod-1',
        externalProductId: 'MLB123',
        status: 'PUBLISHED',
        channelAccount: {
          channelId: 'ch-1',
          configuration: {},
          channel: { type: 'OTHER', name: 'Mock Channel' },
        },
        product: {
          inventories: [{ quantity: 15, reservedQuantity: 0 }],
        },
      });

      // Preço local é 89.90, mas mockConnector retorna 59.90
      pricingService.getEffectivePrice.mockResolvedValue(new Prisma.Decimal('89.90'));

      const report = await reconciliationService.reconcileProduct('cp-1');

      expect(report.hasDiscrepancy).toBe(true);
      expect(report.discrepancies.price).toBeDefined();
      expect(report.discrepancies.price?.localEffectivePrice).toBe(89.9);
      expect(report.discrepancies.price?.remotePrice).toBe(59.9);
    });

    it('deve persistir lastObservedPrice e lastObservedStock em ChannelProduct durante a reconciliação (F13B)', async () => {
      prisma.channelProduct.findUnique.mockResolvedValue({
        id: 'cp-obs-1',
        productId: 'prod-1',
        externalProductId: 'MLB123',
        status: 'PUBLISHED',
        channelAccount: {
          channelId: 'ch-1',
          configuration: {},
          channel: { type: 'OTHER', name: 'Mock Channel' },
        },
        product: {
          inventories: [{ quantity: 10, reservedQuantity: 0 }],
        },
      });

      pricingService.getEffectivePrice.mockResolvedValue(new Prisma.Decimal('59.90'));

      await reconciliationService.reconcileProduct('cp-obs-1');

      expect(prisma.channelProduct.update).toHaveBeenCalledWith({
        where: { id: 'cp-obs-1' },
        data: expect.objectContaining({
          lastObservedStock: 15,
          lastObservedStatus: 'ACTIVE',
          lastObservedAt: expect.any(Date),
        }),
      });
    });
  });

  // ============================================================
  // 6. F13B Webhook Retries & Missed Feeds Recovery
  // ============================================================
  describe('F13B Webhook Retries & Feeds Recovery', () => {
    it('deve processar eventos pendentes de retry com sucesso', async () => {
      prisma.marketplaceEvent.findMany.mockResolvedValue([
        {
          id: 'evt-retry-1',
          channelId: 'ch-1',
          topic: 'orders_v2',
          payload: { resource: '/orders/999' },
          attempts: 1,
        },
      ]);
      prisma.marketplaceEvent.findUnique.mockResolvedValue({
        id: 'evt-retry-1',
        channelId: 'ch-1',
        topic: 'orders_v2',
        payload: { resource: '/orders/999' },
        attempts: 1,
        channel: {
          accounts: [{ id: 'acc-1' }],
        },
      });
      prisma.channel.findUnique.mockResolvedValue({
        id: 'ch-1',
        name: 'Mock Channel',
      });
      prisma.channelOrder.findUnique.mockResolvedValue({
        id: 'co-1',
        orderId: 'ord-1',
        rawPayload: {},
      });
      prisma.channelOrder.update.mockResolvedValue({
        id: 'co-1',
        orderId: 'ord-1',
      });

      const result = await webhookService.processPendingRetries(10);
      expect(result.processedCount).toBe(1);
      expect(result.eventIds).toContain('evt-retry-1');
      expect(prisma.marketplaceEvent.update).toHaveBeenCalledWith({
        where: { id: 'evt-retry-1' },
        data: expect.objectContaining({
          status: 'PROCESSED',
          processedAt: expect.any(Date),
        }),
      });
    });

    it('deve recuperar feeds perdidos de conta Mercado Livre com fallback gracioso', async () => {
      prisma.channelAccount.findUnique.mockResolvedValue({
        id: 'acc-ml-1',
        channelId: 'ch-ml',
        configuration: { clientId: 'APP_123', accessToken: 'TEST_TOKEN' },
        channel: { type: 'MERCADO_LIVRE' },
      });

      const res = await webhookService.recoverMissedFeeds('ch-ml', 'acc-ml-1');
      expect(res.recoveredCount).toBeDefined();
      expect(res.accountId).toBe('acc-ml-1');
    });
  });
});

