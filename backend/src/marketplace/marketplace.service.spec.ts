import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { MockMarketplaceConnector } from './mock-marketplace.connector';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { ProductMapperService } from './product-mapper.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import {
  ChannelType,
  ChannelAccountStatus,
  ChannelProductStatus,
} from '@prisma/client';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prisma: any;
  let mockConnector: MockMarketplaceConnector;
  let mapper: ProductMapperService;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      channel: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      channelAccount: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      channelProduct: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      channelCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      channelSyncLog: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };

    auditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const mlConnectorMock = {
      channelType: 'MERCADO_LIVRE',
      getAuthorizationUrl: jest
        .fn()
        .mockReturnValue('https://auth.mercadolivre.com.br/test'),
      exchangeCodeForTokens: jest.fn().mockResolvedValue({
        accessToken: 'ML-TOKEN',
        refreshToken: 'ML-REFRESH',
        userId: '12345',
        encryptedConfig: { encAccessToken: 'enc1' },
      }),
      testConnection: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Ping OK' }),
      publishProduct: jest.fn().mockResolvedValue({
        success: true,
        externalProductId: 'MLB123',
        externalUrl: 'https://ml.com/MLB123',
      }),
      updateProduct: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Updated' }),
      updatePrice: jest
        .fn()
        .mockResolvedValue({ success: true, rawResponse: { price: 39.9 } }),
      updateStock: jest.fn().mockResolvedValue({
        success: true,
        rawResponse: { available_quantity: 10 },
      }),
      unpublishProduct: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Paused' }),
      syncProduct: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Synced' }),
      disconnect: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        MockMarketplaceConnector,
        { provide: MercadoLivreConnector, useValue: mlConnectorMock },
        ProductMapperService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    mockConnector = module.get<MockMarketplaceConnector>(
      MockMarketplaceConnector,
    );
    mapper = module.get<ProductMapperService>(ProductMapperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mockConnector).toBeDefined();
    expect(mapper).toBeDefined();
  });

  describe('Canais (Channels)', () => {
    it('deve listar canais', async () => {
      prisma.channel.findMany.mockResolvedValue([
        { id: 'c1', name: 'Mercado Livre', type: ChannelType.MERCADO_LIVRE },
      ]);

      const res = await service.listChannels();
      expect(res).toHaveLength(1);
      expect(prisma.channel.findMany).toHaveBeenCalled();
    });

    it('deve criar um canal com sucesso', async () => {
      const dto = {
        name: 'Shopee Brasil',
        type: ChannelType.SHOPEE,
        description: 'Loja oficial Shopee',
      };
      prisma.channel.create.mockResolvedValue({
        id: 'c2',
        ...dto,
        isActive: true,
      });

      const res = await service.createChannel(dto, 'user-123');
      expect(res.name).toBe('Shopee Brasil');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CHANNEL_CREATED' }),
      );
    });
  });

  describe('Contas (ChannelAccounts)', () => {
    it('deve criar conta para um canal existente', async () => {
      prisma.channel.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Mercado Livre',
      });
      prisma.channelAccount.create.mockResolvedValue({
        id: 'acc1',
        channelId: 'c1',
        name: 'Conta ML Matriz',
        status: ChannelAccountStatus.PENDING,
      });

      const res = await service.createAccount({
        channelId: 'c1',
        name: 'Conta ML Matriz',
      });
      expect(res.id).toBe('acc1');
      expect(prisma.channelAccount.create).toHaveBeenCalled();
    });

    it('deve testar conexão com conector Mock com sucesso', async () => {
      prisma.channelAccount.findUnique.mockResolvedValue({
        id: 'acc1',
        channelId: 'c1',
        configuration: { apiKey: 'mock-key' },
      });
      prisma.channelAccount.update.mockResolvedValue({
        id: 'acc1',
        status: ChannelAccountStatus.ACTIVE,
      });
      prisma.channelSyncLog.create.mockResolvedValue({ id: 'log1' });

      const res = await service.testConnection('acc1');
      expect(res.success).toBe(true);
      expect(prisma.channelAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ChannelAccountStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe('Publicação e Mapeamento de Produto (ChannelProducts)', () => {
    it('deve mapear produto interno para payload externo', () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Chaveiro Gatinho 3D',
        description: 'Chaveiro impresso em PLA',
        sku: 'FEL-GAT-001',
        basePrice: 29.9,
        media: [{ url: 'https://cdn.example.com/gato.png' }],
        attributeValues: [
          { attributeDefinition: { name: 'Cor' }, value: 'Preto' },
        ],
      };

      const payload = mapper.mapToExternalPayload(mockProduct, {
        priceOverride: 35.0,
      });
      expect(payload.sku).toBe('FEL-GAT-001');
      expect(payload.price).toBe(35.0);
      expect(payload.images).toContain('https://cdn.example.com/gato.png');
      expect(payload.attributes['Cor']).toBe('Preto');
    });

    it('deve publicar produto com sucesso através do MockMarketplaceConnector', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Chaveiro Gatinho 3D',
        status: 'ACTIVE',
        sku: 'FEL-GAT-001',
        basePrice: 29.9,
        categories: [{ categoryId: 'cat-1', category: { name: 'Chaveiros' } }],
        attributeValues: [],
        media: [{ url: 'https://cdn.example.com/gato.png' }],
        inventories: [{ quantity: 20, reservedQuantity: 2 }],
      };

      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.channelCategory.findUnique.mockResolvedValue({
        channelId: 'c1',
        categoryId: 'cat-1',
        externalCategoryId: 'MLB1234',
        externalCategoryName: 'Chaveiros',
      });
      prisma.channelAccount.findUnique.mockResolvedValue({
        id: 'acc1',
        channelId: 'c1',
        name: 'Conta Mock',
        channel: { name: 'Mock Channel', type: ChannelType.OTHER },
        configuration: {},
      });
      prisma.channelProduct.upsert.mockResolvedValue({
        id: 'cp1',
        productId: 'prod-1',
        channelAccountId: 'acc1',
      });
      prisma.channelProduct.update.mockResolvedValue({
        id: 'cp1',
        status: ChannelProductStatus.PUBLISHED,
        externalProductId: 'MLB-123456789',
      });
      prisma.channelSyncLog.create.mockResolvedValue({ id: 'log1' });

      const res = await service.publishProduct({
        productId: 'prod-1',
        channelAccountId: 'acc1',
      });

      expect(res.result.success).toBe(true);
      expect(res.result.externalProductId).toMatch(/^MLB-/);
      expect(prisma.channelProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ChannelProductStatus.PUBLISHED,
          }),
        }),
      );
    });

    it('deve sincronizar preço no canal externo', async () => {
      prisma.channelProduct.findUnique.mockResolvedValue({
        id: 'cp1',
        externalProductId: 'MLB-987654321',
        priceOverride: 39.9,
        channelAccount: {
          configuration: {},
          channel: { type: ChannelType.OTHER },
        },
        product: { basePrice: 29.9 },
      });
      prisma.channelProduct.update.mockResolvedValue({ id: 'cp1' });
      prisma.channelSyncLog.create.mockResolvedValue({ id: 'log1' });

      const res = await service.syncPrice('cp1');
      expect(res.success).toBe(true);
      expect(res.rawResponse.price).toBe(39.9);
    });

    it('deve sincronizar estoque no canal externo', async () => {
      prisma.channelProduct.findUnique.mockResolvedValue({
        id: 'cp1',
        externalProductId: 'MLB-987654321',
        channelAccount: {
          configuration: {},
          channel: { type: ChannelType.OTHER },
        },
        product: { inventories: [{ quantity: 15, reservedQuantity: 5 }] },
      });
      prisma.channelProduct.update.mockResolvedValue({ id: 'cp1' });
      prisma.channelSyncLog.create.mockResolvedValue({ id: 'log1' });

      const res = await service.syncStock('cp1');
      expect(res.success).toBe(true);
      expect(res.rawResponse.available_quantity).toBe(10);
    });

    it('deve despublicar produto no canal', async () => {
      prisma.channelProduct.findUnique.mockResolvedValue({
        id: 'cp1',
        externalProductId: 'MLB-987654321',
        channelAccountId: 'acc1',
        productId: 'prod-1',
        channelAccount: {
          configuration: {},
          channel: { type: ChannelType.OTHER },
        },
      });
      prisma.channelProduct.update.mockResolvedValue({
        id: 'cp1',
        status: ChannelProductStatus.UNPUBLISHED,
      });
      prisma.channelSyncLog.create.mockResolvedValue({ id: 'log1' });

      const res = await service.unpublishProduct('cp1');
      expect(res.status).toBe(ChannelProductStatus.UNPUBLISHED);
    });
  });

  describe('Mapeamento de Categorias', () => {
    it('deve mapear categoria interna para ID externo', async () => {
      prisma.channelCategory.upsert.mockResolvedValue({
        id: 'cc1',
        channelId: 'c1',
        categoryId: 'cat-1',
        externalCategoryId: 'MLB1234',
        externalCategoryName: 'Decoração > Chaveiros',
      });

      const res = await service.mapCategory({
        channelId: 'c1',
        categoryId: 'cat-1',
        externalCategoryId: 'MLB1234',
        externalCategoryName: 'Decoração > Chaveiros',
      });

      expect(res.externalCategoryId).toBe('MLB1234');
      expect(prisma.channelCategory.upsert).toHaveBeenCalled();
    });
  });

  describe('Logs e Dashboard', () => {
    it('deve listar logs de sincronização', async () => {
      prisma.channelSyncLog.findMany.mockResolvedValue([
        { id: 'log1', operation: 'PUBLISH', status: 'SUCCESS' },
      ]);

      const logs = await service.listSyncLogs('acc1', 10);
      expect(logs).toHaveLength(1);
    });

    it('deve retornar métricas para o dashboard', async () => {
      prisma.channel.count.mockResolvedValue(5);
      prisma.channelAccount.count.mockResolvedValue(3);
      prisma.channelProduct.count.mockResolvedValue(12);
      prisma.channelSyncLog.count.mockResolvedValue(45);
      prisma.channelSyncLog.findMany.mockResolvedValue([]);

      const metrics = await service.getDashboardMetrics();
      expect(metrics.totalChannels).toBe(5);
      expect(metrics.activeAccounts).toBe(3);
      expect(metrics.publishedProducts).toBe(12);
      expect(metrics.totalLogs).toBe(45);
    });
  });
});
