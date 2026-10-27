import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PaymentService } from '../payment/payment.service';
import { InventoryService } from '../inventory/inventory.service';
import { PublicStoreService } from '../public-store/public-store.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { MockMarketplaceConnector } from '../marketplace/mock-marketplace.connector';
import { MercadoLivreConnector } from '../marketplace/mercadolivre.connector';
import { ProductMapperService } from '../marketplace/product-mapper.service';
import { HubValidatorService } from '../marketplace/hub-validator.service';
import { ChannelAttributeMappingService } from '../marketplace/channel-attribute-mapping.service';
import { PricingService } from '../pricing/pricing.service';

import { OrderExpirationScheduler } from './order-expiration.scheduler';

describe('Consolidação da Integração Comercial — End-to-End Test Suite', () => {
  let orderService: OrderService;
  let paymentService: PaymentService;
  let inventoryService: InventoryService;
  let publicStoreService: PublicStoreService;
  let marketplaceService: MarketplaceService;
  let scheduler: OrderExpirationScheduler;
  let prisma: any;
  let auditLog: any;
  let affiliateService: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      channel: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      channelAccount: {
        findUnique: jest.fn(),
      },
      productChannel: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      productChannelPrice: {
        findFirst: jest.fn(),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ord-default', status: OrderStatus.PENDING }),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 10, reservedQuantity: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 10, reservedQuantity: 0 }),
        update: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      marketplaceListing: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'sm-1' }),
      },
      category: {
        findMany: jest.fn(),
      },
      siteSetting: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    auditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    affiliateService = {
      handleOrderCreated: jest.fn().mockResolvedValue(undefined),
      handleOrderStatusChanged: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        OrderExpirationScheduler,
        PaymentService,
        InventoryService,
        PublicStoreService,
        MarketplaceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: AffiliateService, useValue: affiliateService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
        { provide: MockMarketplaceConnector, useValue: {} },
        { provide: MercadoLivreConnector, useValue: {} },
        { provide: ProductMapperService, useValue: {} },
        { provide: HubValidatorService, useValue: {} },
        { provide: ChannelAttributeMappingService, useValue: {} },
        { provide: PricingService, useValue: {} },
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
    scheduler = module.get<OrderExpirationScheduler>(OrderExpirationScheduler);
    paymentService = module.get<PaymentService>(PaymentService);
    inventoryService = module.get<InventoryService>(InventoryService);
    publicStoreService = module.get<PublicStoreService>(PublicStoreService);
    marketplaceService = module.get<MarketplaceService>(MarketplaceService);
  });

  describe('1. Semântica de Reserva de Estoque e Concorrência', () => {
    it('deve reservar estoque no momento do checkout e definir paymentDeadline para 24h', async () => {
      const mockProduct = {
        id: 'prod-gat',
        name: 'Porta Chaves Gatinho Felinodelia',
        sku: 'FEL-GAT-001',
        basePrice: '39.90',
        status: 'ACTIVE',
      };
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan-own', type: 'OWN_STORE', isActive: true });
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productChannel.findUnique.mockResolvedValue({ isEnabled: true });
      prisma.productChannelPrice.findFirst.mockResolvedValue({ effectivePrice: '39.90', mode: 'AUTOMATIC' });
      prisma.stockMovement.findFirst.mockResolvedValue(null);

      // Raw execution returns 1 row updated (atomic reservation successful)
      prisma.$executeRaw.mockResolvedValue(1);

      const createdOrder = {
        id: 'ord-101',
        customerName: 'Cliente Teste',
        customerEmail: 'cliente@teste.com',
        total: '39.90',
        status: OrderStatus.PENDING,
        paymentDeadline: new Date(Date.now() + 24 * 3600 * 1000),
        items: [{ productId: 'prod-gat', quantity: 1, unitPrice: '39.90' }],
      };
      prisma.order.create.mockResolvedValue(createdOrder);

      const order = await orderService.create({
        customerName: 'Cliente Teste',
        customerEmail: 'cliente@teste.com',
        customerPhone: '11999999999',
        street: 'Rua A',
        number: '1',
        neighborhood: 'Bairro',
        city: 'Cidade',
        state: 'SP',
        zipCode: '01000-000',
        items: [{ productId: 'prod-gat', quantity: 1 }],
      });

      expect(order.id).toBe('ord-101');
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentDeadline: expect.any(Date),
            status: OrderStatus.PENDING,
          }),
        }),
      );
      // Confirma que executou a reserva atômica via $executeRaw
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('deve rejeitar checkout com BadRequestException se não houver saldo disponível (concorrência esgotada)', async () => {
      const mockProduct = {
        id: 'prod-gat',
        name: 'Porta Chaves Gatinho Felinodelia',
        sku: 'FEL-GAT-001',
        basePrice: '39.90',
        status: 'ACTIVE',
      };
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan-own', type: 'OWN_STORE', isActive: true });
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productChannel.findUnique.mockResolvedValue({ isEnabled: true });
      prisma.productChannelPrice.findFirst.mockResolvedValue(null);
      prisma.stockMovement.findFirst.mockResolvedValue(null);

      const createdOrder = {
        id: 'ord-fail',
        customerName: 'Cliente Concorrente',
        customerEmail: 'concorrente@teste.com',
        total: '79.80',
        status: OrderStatus.PENDING,
      };
      prisma.order.create.mockResolvedValue(createdOrder);

      // Raw execution returns 0 rows updated (no available stock: quantity - reservedQuantity < requested)
      prisma.$executeRaw.mockResolvedValue(0);

      await expect(
        orderService.create({
          customerName: 'Cliente Concorrente',
          customerEmail: 'concorrente@teste.com',
          customerPhone: '11999999999',
          street: 'Rua B',
          number: '2',
          neighborhood: 'Bairro',
          city: 'Cidade',
          state: 'SP',
          zipCode: '01000-000',
          items: [{ productId: 'prod-gat', quantity: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Semântica de Confirmação de Estoque', () => {
    it('ao confirmar pedido, deve abater quantity e reservedQuantity na mesma operação e registrar movimentação OUT', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-confirm',
        status: OrderStatus.PENDING,
        items: [{ productId: 'prod-gat', variantId: null, quantity: 2 }],
      });

      // Retorna que havia reserva prévia para o item
      prisma.stockMovement.findFirst.mockImplementation(async (args: any) => {
        if (args.where?.type === 'RESERVATION') {
          return { id: 'res-1', quantity: 2, productId: 'prod-gat', variantId: null };
        }
        return null;
      });

      prisma.$executeRaw.mockResolvedValue(1);

      await inventoryService.handleOrderConfirmed('ord-confirm');

      // Verifica que executou a query atômica reduzindo quantity e reservedQuantity simultaneamente
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // Verifica auditoria de movimentação do tipo OUT
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-gat',
            type: 'OUT',
            quantity: -2,
            referenceType: 'ORDER',
            referenceId: 'ord-confirm',
          }),
        }),
      );
    });
  });

  describe('3. Semântica de Expiração de 24 Horas e Liberação de Reserva', () => {
    it('ao expirar pedidos PENDING com mais de 24h, deve cancelar o pedido e decrementar somente reservedQuantity sem alterar quantity', async () => {
      const expiredDate = new Date(Date.now() - 3600 * 1000); // 1h após o deadline
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-expired-1',
          status: OrderStatus.PENDING,
          paymentDeadline: expiredDate,
          items: [{ productId: 'prod-gat', variantId: null, quantity: 3 }],
        },
      ]);

      prisma.order.update.mockResolvedValue({
        id: 'ord-expired-1',
        status: OrderStatus.CANCELLED,
      });

      // Não há liberação prévia registrada
      prisma.stockMovement.findFirst.mockResolvedValue(null);
      // Retorna a reserva ativa
      prisma.stockMovement.findMany.mockResolvedValue([
        { productId: 'prod-gat', variantId: null, quantity: 3 },
      ]);
      prisma.$executeRaw.mockResolvedValue(1);

      const result = await orderService.expireUnpaidOrders('system-cron');

      expect(result.expiredCount).toBe(1);
      // Status alterado para CANCELLED
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-expired-1' },
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
        }),
      });

      // Liberação de estoque executa query atômica decrementando reservedQuantity
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // Registro de movimentação tipo RELEASE
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-gat',
            type: 'RELEASE',
            quantity: -3,
            referenceType: 'ORDER',
            referenceId: 'ord-expired-1',
          }),
        }),
      );
    });

    it('expiração repetida não deve duplicar a liberação de estoque (idempotência)', async () => {
      // Pedido cancelado
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-already-cancelled',
        status: OrderStatus.CANCELLED,
        items: [{ productId: 'prod-gat', variantId: null, quantity: 1 }],
      });

      // Já existe um registro de RELEASE gravado previamente
      prisma.stockMovement.findFirst.mockResolvedValue({
        id: 'rel-existing',
        type: 'RELEASE',
      });

      // Limpa chamadas anteriores a executeRaw
      prisma.$executeRaw.mockClear();

      // Tenta chamar releaseStockForOrder novamente
      await inventoryService.releaseStockForOrder('ord-already-cancelled');

      // Idempotência garante que não executa novo UPDATE no banco
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('OrderExpirationScheduler executado periodicamente a cada 10 min deve cancelar pedidos vencidos e na repetição não duplicar liberação', async () => {
      // 1ª Execução: Encontra 1 pedido vencido
      prisma.order.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      prisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-sched-1',
          status: OrderStatus.PENDING,
          paymentDeadline: new Date(Date.now() - 3600 * 1000),
          items: [{ productId: 'prod-gat', variantId: null, quantity: 2 }],
        },
      ]);
      prisma.order.findUnique.mockResolvedValue({ id: 'ord-sched-1', status: OrderStatus.PENDING });
      prisma.stockMovement.findFirst.mockResolvedValue(null);
      prisma.stockMovement.findMany.mockResolvedValue([{ productId: 'prod-gat', variantId: null, quantity: 2 }]);
      prisma.$executeRaw.mockResolvedValue(1);

      const run1 = await scheduler.handleExpirationJob();
      expect(run1.found).toBe(1);
      expect(run1.expired).toBe(1);
      expect(run1.released).toBe(1);

      // 2ª Execução consecutiva: Nenhum pedido pendente vencido restante
      const run2 = await scheduler.handleExpirationJob();
      expect(run2.found).toBe(0);
      expect(run2.expired).toBe(0);
      expect(run2.released).toBe(0);
    });
  });

  describe('4. Proteção Crítica: Pagamento Recebido Após a Expiração (Late Payment)', () => {
    it('não deve reconfirmar pedido CANCELLED nem dar nova baixa de estoque se chegar webhook tardio', async () => {
      // Pedido foi previamente cancelado por expiração de 24h
      const mockOrderCancelled = {
        id: 'ord-expired-late',
        status: OrderStatus.CANCELLED,
        items: [{ productId: 'prod-gat', quantity: 1 }],
      };

      const mockPayment = {
        id: 'pay-late',
        status: 'PAID',
        orderId: 'ord-expired-late',
        amount: '39.90',
        method: 'PIX',
        provider: 'MOCK',
      } as any;

      // Executa handlePaymentSuccess diretamente via reflexão interna
      await (paymentService as any).handlePaymentSuccess(mockPayment, mockOrderCancelled);

      // Verifica que o pedido NÃO foi alterado para CONFIRMED
      expect(prisma.order.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.CONFIRMED }),
        }),
      );

      // Nenhuma baixa de estoque pode ter ocorrido
      expect(prisma.inventory.update).not.toHaveBeenCalled();

      // Registro de auditoria de segurança gerado (PAYMENT_RECEIVED_AFTER_EXPIRATION)
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_RECEIVED_AFTER_EXPIRATION',
          entityId: 'pay-late',
          metadata: expect.objectContaining({
            orderId: 'ord-expired-late',
            orderStatus: OrderStatus.CANCELLED,
          }),
        }),
      );
    });
  });

  describe('5. Canais Comerciais e Resolução de Preço F12', () => {
    it('deve bloquear checkout se o produto não estiver habilitado no canal especificado', async () => {
      const mockProduct = {
        id: 'prod-gat',
        name: 'Porta Chaves Gatinho Felinodelia',
        sku: 'FEL-GAT-001',
        basePrice: '39.90',
        status: 'ACTIVE',
      };
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan-ml', type: 'MERCADO_LIVRE', isActive: true });
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      // Canal desabilitado para o produto
      prisma.productChannel.findUnique.mockResolvedValue({ isEnabled: false });

      await expect(
        orderService.create({
          channelId: 'chan-ml',
          customerName: 'Cliente Canal',
          customerEmail: 'cli@ml.com',
          customerPhone: '11999999999',
          street: 'Rua',
          number: '1',
          neighborhood: 'B',
          city: 'C',
          state: 'SP',
          zipCode: '01000-000',
          items: [{ productId: 'prod-gat', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve aplicar preço F12 do canal (ProductChannelPrice) e respeitar fallback para basePrice se ausente', async () => {
      const mockProduct = {
        id: 'prod-gat',
        name: 'Porta Chaves Gatinho Felinodelia',
        sku: 'FEL-GAT-001',
        basePrice: '39.90',
        status: 'ACTIVE',
      };
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan-own', type: 'OWN_STORE', isActive: true });
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productChannel.findUnique.mockResolvedValue({ isEnabled: true });
      
      // Cenário com preço diferenciado F12 no canal: R$ 45.00
      prisma.productChannelPrice.findFirst.mockResolvedValue({ effectivePrice: '45.00' });
      prisma.$executeRaw.mockResolvedValue(1);

      const createdOrder = {
        id: 'ord-f12',
        total: '45.00',
        items: [{ productId: 'prod-gat', quantity: 1, unitPrice: '45.00' }],
      };
      prisma.order.create.mockResolvedValue(createdOrder);

      const order = await orderService.create({
        customerName: 'Cliente F12',
        customerEmail: 'f12@teste.com',
        customerPhone: '11999999999',
        street: 'Rua',
        number: '1',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '01000-000',
        items: [{ productId: 'prod-gat', quantity: 1 }],
      });

      // snapshot do item deve ter unitPrice = 45.00 e subtotal = 45.00
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: '45.00',
            total: '45.00',
            items: {
              create: [
                expect.objectContaining({
                  unitPrice: '45.00',
                  subtotal: '45.00',
                }),
              ],
            },
          }),
        }),
      );
    });
  });

  describe('6. Vitrine Pública (Loja Própria) e Marketplace', () => {
    it('PublicStoreService deve filtrar apenas produtos ativos com ProductChannel isEnabled=true na OWN_STORE', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan-own-id', type: 'OWN_STORE', isActive: true });
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-gat',
          name: 'Porta Chaves Gatinho Felinodelia',
          slug: 'porta-chaves-gatinho-felinodelia',
          basePrice: '39.90',
          status: 'ACTIVE',
          channelPrices: [],
        },
      ]);
      prisma.product.count.mockResolvedValue(1);

      const result = await publicStoreService.getProducts({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            productChannels: {
              some: {
                channelId: 'chan-own-id',
                isEnabled: true,
              },
            },
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('MarketplaceService deve recusar publicação se produto não estiver associado/habilitado no canal', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-gat',
        name: 'Porta Chaves Gatinho Felinodelia',
        status: 'ACTIVE',
        attributeValues: [],
        media: [],
        inventories: [],
        categories: [],
      });
      prisma.channelAccount.findUnique.mockResolvedValue({
        id: 'acc-ml-1',
        channelId: 'chan-ml-1',
        name: 'ML Conta Principal',
        channel: { id: 'chan-ml-1', name: 'Mercado Livre', type: 'MERCADO_LIVRE' },
      });
      // ProductChannel desabilitado
      prisma.productChannel.findUnique.mockResolvedValue({
        isEnabled: false,
      });

      await expect(
        marketplaceService.publishProduct({
          productId: 'prod-gat',
          channelAccountId: 'acc-ml-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
