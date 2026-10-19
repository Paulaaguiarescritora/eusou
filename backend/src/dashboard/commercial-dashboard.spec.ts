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
      const now = Date.now();
      prisma.channelAccount.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Conta ML Filial SP',
          status: ChannelAccountStatus.ERROR,
          updatedAt: new Date(now + 1000),
          channel: { name: 'Mercado Livre' },
        },
        {
          id: 'acc-2',
          name: 'Conta Shopee Matriz',
          status: ChannelAccountStatus.DISCONNECTED,
          updatedAt: new Date(now),
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
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockImplementation((args: any) => {
        if (args?.where?.status?.not === 'ARCHIVED') {
          return Promise.resolve([
            {
              id: 'prod-1',
              name: 'Porta-Chaves Gatinho 3D',
              variants: [],
              inventories: [
                {
                  id: 'inv-1',
                  quantity: 0,
                  reservedQuantity: 0,
                  minimumQuantity: 5,
                  updatedAt: new Date(),
                },
              ],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const alerts = await alertService.getAlerts();

      expect(alerts.some((a) => a.type === 'WEBHOOK_EVENT_FAILED')).toBe(true);
      expect(alerts.some((a) => a.type === 'STOCK_OUT')).toBe(true);
    });

    it('deve calcular status de saúde operacional (CRITICAL, WARNING, HEALTHY)', async () => {
      prisma.channelAccount.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      // Sem alertas = HEALTHY
      const healthHealthy = await alertService.getOperationHealth();
      expect(healthHealthy.status).toBe('HEALTHY');
      expect(healthHealthy.label).toBe('Operação Saudável');

      // Com aviso = WARNING
      prisma.product.findMany.mockImplementationOnce((args: any) => {
        return Promise.resolve([
          {
            id: 'prod-x',
            name: 'Produto X',
            variants: [],
            inventories: [
              {
                id: 'inv-low',
                quantity: 3,
                reservedQuantity: 0,
                minimumQuantity: 5,
                updatedAt: new Date(),
              },
            ],
          },
        ]);
      });
      const healthWarning = await alertService.getOperationHealth();
      expect(healthWarning.status).toBe('WARNING');
      expect(healthWarning.counts.warning).toBe(1);
    });

    it('deve controlar estoque exclusivamente por variantes ativas e ignorar estoque do produto-pai', async () => {
      prisma.channelAccount.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.channelProduct.findMany.mockResolvedValue([]);

      // Gatinho com 5 variantes e estoque pai legado (7 un, 2 reservadas)
      const gatinhoProduct = {
        id: 'gat-1',
        name: 'Porta Chaves Gatinho',
        sku: 'FEL-GAT-001',
        variants: [
          {
            id: 'var-ver',
            name: 'Vermelho',
            sku: 'FEL-GAT-001-VER',
            isActive: true,
            inventories: [{ id: 'inv-ver', quantity: 1, reservedQuantity: 0, minimumQuantity: 2, updatedAt: new Date() }],
          },
          {
            id: 'var-pre',
            name: 'Preto',
            sku: 'FEL-GAT-001-PRE',
            isActive: true,
            inventories: [{ id: 'inv-pre', quantity: 0, reservedQuantity: 0, minimumQuantity: 2, updatedAt: new Date() }],
          },
          {
            id: 'var-ros',
            name: 'Rosa',
            sku: 'FEL-GAT-001-ROS',
            isActive: true,
            inventories: [{ id: 'inv-ros', quantity: 1, reservedQuantity: 0, minimumQuantity: 2, updatedAt: new Date() }],
          },
          {
            id: 'var-bco',
            name: 'Branco',
            sku: 'FEL-GAT-001-BCO',
            isActive: true,
            inventories: [{ id: 'inv-bco', quantity: 0, reservedQuantity: 0, minimumQuantity: 2, updatedAt: new Date() }],
          },
          {
            id: 'var-azu',
            name: 'Azul',
            sku: 'FEL-GAT-001-AZU',
            isActive: true,
            inventories: [{ id: 'inv-azu', quantity: 1, reservedQuantity: 0, minimumQuantity: 0, updatedAt: new Date() }],
          },
        ],
        inventories: [
          // Estoque do produto-pai: NÃO deve ser considerado nem gerar alerta!
          { id: 'inv-parent-gat', quantity: 7, reservedQuantity: 2, minimumQuantity: 5, updatedAt: new Date() },
        ],
      };

      prisma.product.findMany.mockImplementation((args: any) => {
        if (args?.where?.status?.not === 'ARCHIVED') {
          return Promise.resolve([gatinhoProduct]);
        }
        return Promise.resolve([]);
      });

      const alerts = await alertService.getAlerts();

      // Alertas de variantes esgotadas (Preto, Branco) e baixas (Vermelho, Rosa)
      const stockAlerts = alerts.filter((a) => a.type === 'STOCK_OUT' || a.type === 'STOCK_LOW');
      expect(stockAlerts.length).toBe(4);

      // NENHUM alerta com o nome genérico do produto-pai sem variante
      expect(stockAlerts.some((a) => a.title === 'Estoque Esgotado: Porta Chaves Gatinho')).toBe(false);
      expect(stockAlerts.some((a) => a.title === 'Estoque Baixo: Porta Chaves Gatinho')).toBe(false);

      // Alertas contêm os nomes das variantes específicas
      expect(stockAlerts.some((a) => a.title.includes('Preto') && a.severity === 'CRITICAL')).toBe(true);
      expect(stockAlerts.some((a) => a.title.includes('Branco') && a.severity === 'CRITICAL')).toBe(true);
      expect(stockAlerts.some((a) => a.title.includes('Vermelho') && a.severity === 'WARNING')).toBe(true);
      expect(stockAlerts.some((a) => a.title.includes('Rosa') && a.severity === 'WARNING')).toBe(true);
    });

    it('deve usar estoque próprio do produto quando não houver variantes', async () => {
      prisma.channelAccount.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.channelProduct.findMany.mockResolvedValue([]);

      const bolinhaSemVariantes = {
        id: 'bol-1',
        name: 'Bolinha de Purga',
        sku: 'FEL-BOL-001',
        variants: [], // sem variantes
        inventories: [
          { id: 'inv-bol', quantity: 0, reservedQuantity: 0, minimumQuantity: 5, updatedAt: new Date() },
        ],
      };

      prisma.product.findMany.mockImplementation((args: any) => {
        if (args?.where?.status?.not === 'ARCHIVED') {
          return Promise.resolve([bolinhaSemVariantes]);
        }
        return Promise.resolve([]);
      });

      const alerts = await alertService.getAlerts();
      const stockAlerts = alerts.filter((a) => a.type === 'STOCK_OUT');

      expect(stockAlerts.length).toBe(1);
      expect(stockAlerts[0].title).toBe('Estoque Esgotado: Bolinha de Purga');
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

    it('deve consolidar estoque somando apenas variantes ativas quando houver variantes e usar estoque do produto quando não houver', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.channelAccount.findMany.mockResolvedValue([]);
      prisma.channelProduct.count.mockResolvedValue(0);
      prisma.channelProduct.findMany.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([]);
      prisma.channelOrder.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.findMany.mockResolvedValue([]);
      prisma.marketplaceEvent.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(2);
      prisma.productionJob.findMany.mockResolvedValue([]);
      prisma.productionJob.count.mockResolvedValue(0);
      prisma.affiliate.count.mockResolvedValue(0);
      prisma.affiliateClick.count.mockResolvedValue(0);
      prisma.affiliateConversion.findMany.mockResolvedValue([]);

      const gatinhoComVariantes = {
        id: 'gat-1',
        name: 'Porta Chaves Gatinho',
        sku: 'FEL-GAT-001',
        variants: [
          { id: 'v1', name: 'Vermelho', sku: 'GAT-VER', isActive: true, inventories: [{ quantity: 1, reservedQuantity: 0, minimumQuantity: 2 }] },
          { id: 'v2', name: 'Preto', sku: 'GAT-PRE', isActive: true, inventories: [{ quantity: 0, reservedQuantity: 0, minimumQuantity: 2 }] },
          { id: 'v3', name: 'Rosa', sku: 'GAT-ROS', isActive: true, inventories: [{ quantity: 1, reservedQuantity: 0, minimumQuantity: 2 }] },
          { id: 'v4', name: 'Branco', sku: 'GAT-BCO', isActive: true, inventories: [{ quantity: 0, reservedQuantity: 0, minimumQuantity: 2 }] },
          { id: 'v5', name: 'Azul', sku: 'GAT-AZU', isActive: true, inventories: [{ quantity: 1, reservedQuantity: 0, minimumQuantity: 0 }] },
        ],
        inventories: [
          // Estoque legado do pai: 7 un, 2 reservadas -> DEVE SER IGNORADO
          { quantity: 7, reservedQuantity: 2, minimumQuantity: 5 },
        ],
      };

      const bolinhaSemVariantes = {
        id: 'bol-1',
        name: 'Bolinha de Purga',
        sku: 'FEL-BOL-001',
        variants: [], // sem variantes
        inventories: [
          { quantity: 10, reservedQuantity: 1, minimumQuantity: 2 },
        ],
      };

      prisma.product.findMany.mockImplementation((args: any) => {
        if (args?.where?.status?.not === 'ARCHIVED') {
          return Promise.resolve([gatinhoComVariantes, bolinhaSemVariantes]);
        }
        return Promise.resolve([]);
      });

      const summary = await dashboardService.getCommercialSummary({ period: '30d' });

      // Gatinho: 1 + 0 + 1 + 0 + 1 = 3 disp, 0 res.
      // Bolinha: 10 - 1 = 9 disp, 1 res.
      // Total disp = 12, Total res = 1.
      expect(summary.inventory.availableQuantity).toBe(12);
      expect(summary.inventory.reservedQuantity).toBe(1);
      expect(summary.inventory.criticalCount).toBe(2); // Preto e Branco
      expect(summary.inventory.lowCount).toBe(2); // Vermelho e Rosa

      // criticalItems identifica variantes e não inclui pai
      expect(summary.inventory.criticalItems.length).toBe(4);
      expect(summary.inventory.criticalItems.some((i: any) => i.productName.includes('Preto') && i.status === 'ESGOTADO')).toBe(true);
      expect(summary.inventory.criticalItems.some((i: any) => i.productName.includes('Branco') && i.status === 'ESGOTADO')).toBe(true);
      expect(summary.inventory.criticalItems.some((i: any) => i.productName.includes('Vermelho') && i.status === 'BAIXO')).toBe(true);
      expect(summary.inventory.criticalItems.some((i: any) => i.productName.includes('Rosa') && i.status === 'BAIXO')).toBe(true);
      expect(summary.inventory.criticalItems.some((i: any) => i.productName === 'Porta Chaves Gatinho')).toBe(false);
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
