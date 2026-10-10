import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { CommercialAlertService } from './commercial-alert.service';
import { DashboardController } from './dashboard.controller';
import { PrismaService } from '../prisma.service';
import {
  ChannelAccountStatus,
  ChannelProductStatus,
  MarketplaceEventStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';

describe('F14 — Central de Operação Comercial (Dashboard & Alertas)', () => {
  let dashboardService: DashboardService;
  let alertService: CommercialAlertService;
  let controller: DashboardController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      order: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      channelAccount: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      channelProduct: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      channel: {
        findMany: jest.fn(),
      },
      channelOrder: {
        findMany: jest.fn(),
      },
      marketplaceEvent: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      inventory: {
        findMany: jest.fn(),
      },
      product: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      productionJob: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      affiliate: {
        count: jest.fn(),
      },
      affiliateClick: {
        count: jest.fn(),
      },
      affiliateConversion: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        CommercialAlertService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    dashboardService = module.get<DashboardService>(DashboardService);
    alertService = module.get<CommercialAlertService>(CommercialAlertService);
    controller = module.get<DashboardController>(DashboardController);
  });

  describe('1. CommercialAlertService — Alertas Operacionais Derivados', () => {
    it('deve gerar alerta crítico quando conta de marketplace estiver com ERRO ou DESCONECTADA', async () => {
      prisma.channelAccount.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Conta ML Filial SP',
          status: ChannelAccountStatus.ERROR,
          updatedAt: new Date(),
          channel: { name: 'Mercado Livre' },
        },
        {
          id: 'acc-2',
          name: 'Conta Shopee Matriz',
          status: ChannelAccountStatus.DISCONNECTED,
          updatedAt: new Date(),
          channel: { name: 'Shopee' },
        },
      ]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.inventory.findMany.mockResolvedValue([]);
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      const alerts = await alertService.getAlerts();

      expect(alerts.length).toBe(2);
      expect(alerts[0].severity).toBe('CRITICAL');
      expect(alerts[0].type).toBe('CHANNEL_ACCOUNT_ERROR');
      expect(alerts[1].severity).toBe('CRITICAL');
      expect(alerts[1].type).toBe('CHANNEL_ACCOUNT_DISCONNECTED');
    });

    it('deve gerar alerta crítico para evento de webhook falho e estoque esgotado', async () => {
      prisma.channelAccount.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          topic: 'orders_v2',
          lastError: 'Timeout connecting to carrier',
          receivedAt: new Date(),
          channel: { name: 'Mercado Livre' },
        },
      ]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.inventory.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          quantity: 0,
          reservedQuantity: 0,
          minimumQuantity: 5,
          updatedAt: new Date(),
          product: { name: 'Porta-Chaves Gatinho 3D' },
        },
      ]);
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      const alerts = await alertService.getAlerts();

      expect(alerts.some((a) => a.type === 'WEBHOOK_EVENT_FAILED')).toBe(true);
      expect(alerts.some((a) => a.type === 'STOCK_OUT')).toBe(true);
    });

    it('deve calcular status de saúde operacional (CRITICAL, WARNING, HEALTHY)', async () => {
      prisma.channelAccount.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.inventory.findMany.mockResolvedValue([]);
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      // Sem alertas = HEALTHY
      const healthHealthy = await alertService.getOperationHealth();
      expect(healthHealthy.status).toBe('HEALTHY');
      expect(healthHealthy.label).toBe('Operação Saudável');

      // Com aviso = WARNING
      prisma.inventory.findMany.mockResolvedValueOnce([
        {
          id: 'inv-low',
          quantity: 3,
          reservedQuantity: 0,
          minimumQuantity: 5,
          updatedAt: new Date(),
          product: { name: 'Produto X' },
        },
      ]);
      const healthWarning = await alertService.getOperationHealth();
      expect(healthWarning.status).toBe('WARNING');
      expect(healthWarning.counts.warning).toBe(1);
    });
  });

  describe('2. DashboardService — Agregações Comerciais & Comparações', () => {
    it('deve consolidar vendas, períodos e faturamento com Prisma.Decimal', async () => {
      const orderSample = {
        id: 'ord-1',
        customerName: 'Cliente Teste',
        total: new Prisma.Decimal('150.00'),
        status: OrderStatus.CONFIRMED,
        createdAt: new Date(),
        items: [{ quantity: 2 }],
        channelOrder: null,
        affiliateCode: null,
      };

      prisma.order.findMany.mockResolvedValue([orderSample]);
      prisma.channelAccount.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'ML Principal',
          status: ChannelAccountStatus.ACTIVE,
          channel: { name: 'Mercado Livre', type: 'MERCADO_LIVRE' },
          _count: { channelProducts: 10, channelOrders: 5 },
        },
      ]);
      prisma.channelProduct.count.mockResolvedValue(10);
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([
        {
          id: 'ch-1',
          name: 'Mercado Livre',
          _count: { accounts: 1, channelOrders: 5 },
        },
      ]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(50);
      prisma.product.findMany.mockResolvedValue([]);
      prisma.inventory.findMany.mockResolvedValue([]);
      prisma.productionJob.findMany.mockResolvedValue([]);
      prisma.productionJob.count.mockResolvedValue(0);
      prisma.affiliate.count.mockResolvedValue(2);
      prisma.affiliateClick.count.mockResolvedValue(20);
      prisma.affiliateConversion.findMany.mockResolvedValue([]);

      const summary = await dashboardService.getCommercialSummary({ period: '30d' });

      expect(summary.sales.totalRevenue).toBe('150.00');
      expect(summary.sales.orderCount).toBe(1);
      expect(summary.sales.averageTicket).toBe('150.00');
      expect(summary.sales.originBreakdown.ownStore).toBe('150.00');
      expect(summary.health.status).toBe('HEALTHY');
      expect(summary.marketplaces.activeAccounts).toBe(1);
    });

    it('deve comparar corretamente com período anterior quando houver histórico', async () => {
      // Período atual: 200.00; Período anterior: 100.00 -> crescimento +100.0%
      prisma.order.findMany
        .mockResolvedValueOnce([{ total: new Prisma.Decimal('200.00'), items: [] }]) // current
        .mockResolvedValueOnce([{ total: new Prisma.Decimal('100.00'), items: [] }]) // previous
        .mockResolvedValueOnce([]) // today
        .mockResolvedValueOnce([]) // 7d
        .mockResolvedValueOnce([]) // 30d
        .mockResolvedValueOnce([]); // recentOrders

      prisma.channelAccount.findMany.mockResolvedValue([]);
      prisma.channelProduct.count.mockResolvedValue(0);
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.product.findMany.mockResolvedValue([]);
      prisma.inventory.findMany.mockResolvedValue([]);
      prisma.productionJob.findMany.mockResolvedValue([]);
      prisma.productionJob.count.mockResolvedValue(0);
      prisma.affiliate.count.mockResolvedValue(0);
      prisma.affiliateClick.count.mockResolvedValue(0);
      prisma.affiliateConversion.findMany.mockResolvedValue([]);

      const summary = await dashboardService.getCommercialSummary({ period: '7d' });

      expect(summary.sales.totalRevenue).toBe('200.00');
      expect(summary.sales.previousRevenue).toBe('100.00');
      expect(summary.sales.growthPercent).toBe(100.0);
    });
  });

  describe('3. DashboardController — Rotas & Delegações', () => {
    it('deve responder via controller aos métodos summary, alerts e health', async () => {
      jest.spyOn(dashboardService, 'getCommercialSummary').mockResolvedValue({ status: 'ok' } as any);
      jest.spyOn(alertService, 'getAlerts').mockResolvedValue([{ id: 'a1' }] as any);
      jest.spyOn(alertService, 'getOperationHealth').mockResolvedValue({ status: 'HEALTHY' } as any);

      const resSummary = await controller.getCommercialSummary('7d');
      expect(resSummary).toEqual({ status: 'ok' });

      const resAlerts = await controller.getAlerts();
      expect(resAlerts).toHaveLength(1);

      const resHealth = await controller.getOperationHealth();
      expect(resHealth.status).toBe('HEALTHY');
    });
  });
});
