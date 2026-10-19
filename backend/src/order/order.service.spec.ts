import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { AffiliateService } from '../affiliate/affiliate.service';
import { InventoryService } from '../inventory/inventory.service';

describe('OrderService', () => {
  let service: OrderService;
  let prisma: any;
  let auditLog: any;
  let mockInventoryService: any;

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      productVariant: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      inventory: { findFirst: jest.fn().mockResolvedValue({ quantity: 10, reservedQuantity: 0 }) },
      channel: { findFirst: jest.fn().mockResolvedValue({ id: 'channel-own', type: 'OWN_STORE', isActive: true }) },
      productChannel: { findUnique: jest.fn().mockResolvedValue({ isEnabled: true }) },
      productChannelPrice: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (args?.where?.productId === 'prod-gat') {
            return Promise.resolve({ effectivePrice: '39.90', mode: 'AUTOMATIC' });
          }
          return Promise.resolve({ effectivePrice: '99.90', mode: 'AUTOMATIC' });
        }),
      },
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    auditLog = { log: jest.fn() };

    const mockAffiliateService = {
      handleOrderCreated: jest.fn().mockResolvedValue(undefined),
      handleOrderStatusChanged: jest.fn().mockResolvedValue(undefined),
    };

    mockInventoryService = {
      reserveStockForOrder: jest.fn().mockResolvedValue(undefined),
      releaseStockForOrder: jest.fn().mockResolvedValue(undefined),
      handleOrderConfirmed: jest.fn().mockResolvedValue(undefined),
      handleOrderCancelled: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: AffiliateService, useValue: mockAffiliateService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  describe('create order', () => {
    it('should create order with snapshots, calculate total securely and confirm via mock payment', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Perfume Sensual',
        sku: 'PERF-01',
        basePrice: '99.90',
        status: 'ACTIVE',
      };
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const createdOrder = {
        id: 'order-1',
        customerName: 'Paula Aguiar',
        customerEmail: 'paula@example.com',
        customerPhone: '11999999999',
        status: OrderStatus.PENDING,
        subtotal: '199.80',
        shippingAmount: '0.00',
        total: '199.80',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productNameSnapshot: 'Perfume Sensual',
            skuSnapshot: 'PERF-01',
            quantity: 2,
            unitPrice: '99.90',
            subtotal: '199.80',
          },
        ],
      };
      prisma.order.create.mockResolvedValue(createdOrder);

      const result = await service.create({
        customerName: 'Paula Aguiar',
        customerEmail: 'paula@example.com',
        customerPhone: '11999999999',
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
        items: [{ productId: 'prod-1', quantity: 2 }],
      });

      expect(result.id).toBe('order-1');
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.total).toBe('199.80');
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerEmail: 'paula@example.com',
            status: OrderStatus.PENDING,
            subtotal: '199.80',
            total: '199.80',
          }),
        }),
      );
      expect(mockInventoryService.handleOrderConfirmed).not.toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORDER_CREATED',
          entityId: 'order-1',
        }),
      );
    });

    it('should throw BadRequestException if product is inactive', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-draft',
        name: 'Inativo',
        status: 'DRAFT',
      });

      await expect(
        service.create({
          customerName: 'Paula',
          customerEmail: 'p@test.com',
          customerPhone: '11',
          street: 'R',
          number: '1',
          neighborhood: 'N',
          city: 'C',
          state: 'SP',
          zipCode: '00',
          items: [{ productId: 'prod-draft', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on negative/zero quantity', async () => {
      await expect(
        service.create({
          customerName: 'Paula',
          customerEmail: 'p@test.com',
          customerPhone: '11',
          street: 'R',
          number: '1',
          neighborhood: 'N',
          city: 'C',
          state: 'SP',
          zipCode: '00',
          items: [{ productId: 'prod-1', quantity: 0 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create order with specific variant (Rosa), preserving variantId, variant SKU and variant name in snapshot', async () => {
      const mockProduct = {
        id: 'prod-gat',
        name: 'Porta Chaves Gatinho Felinodelia',
        sku: 'FEL-GAT-001',
        basePrice: '39.90',
        status: 'ACTIVE',
      };
      const mockVariantRosa = {
        id: 'var-rosa',
        productId: 'prod-gat',
        name: 'Rosa',
        sku: 'FEL-GAT-001-ROS',
        price: '39.90',
        isActive: true,
      };

      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productVariant.findUnique.mockResolvedValue(mockVariantRosa);

      const createdOrder = {
        id: 'order-gat-1',
        customerName: 'Cliente Homologação',
        customerEmail: 'cliente@teste.com',
        customerPhone: '11999999999',
        status: OrderStatus.PENDING,
        subtotal: '39.90',
        shippingAmount: '0.00',
        total: '39.90',
        items: [
          {
            id: 'item-1',
            productId: 'prod-gat',
            variantId: 'var-rosa',
            productNameSnapshot: 'Porta Chaves Gatinho Felinodelia - Rosa',
            skuSnapshot: 'FEL-GAT-001-ROS',
            quantity: 1,
            unitPrice: '39.90',
            subtotal: '39.90',
          },
        ],
      };
      prisma.order.create.mockResolvedValue(createdOrder);

      const result = await service.create({
        customerName: 'Cliente Homologação',
        customerEmail: 'cliente@teste.com',
        customerPhone: '11999999999',
        street: 'Rua Exemplo',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
        items: [{ productId: 'prod-gat', variantId: 'var-rosa', quantity: 1 }],
      });

      expect(result.id).toBe('order-gat-1');
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [
                expect.objectContaining({
                  productId: 'prod-gat',
                  variantId: 'var-rosa',
                  productNameSnapshot: 'Porta Chaves Gatinho Felinodelia - Rosa',
                  skuSnapshot: 'FEL-GAT-001-ROS',
                  quantity: 1,
                  unitPrice: '39.90',
                  subtotal: '39.90',
                }),
              ],
            },
          }),
        }),
      );
    });

    it('deve impedir criação de pedido se o produto não possuir ProductChannelPrice configurado no canal', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-sem-preco',
        name: 'Produto Sem Preço F12',
        basePrice: '50.00',
        status: 'ACTIVE',
      });
      prisma.productChannelPrice.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await expect(
        service.create({
          customerName: 'Cliente Teste',
          customerEmail: 'teste@example.com',
          customerPhone: '11999999999',
          street: 'Rua das Flores',
          number: '123',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01001-000',
          items: [{ productId: 'prod-sem-preco', quantity: 1 }],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Produto indisponível para venda: preço não configurado no canal para "Produto Sem Preço F12".',
        ),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status and log audit event', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CONFIRMED,
      });
      prisma.order.update.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PROCESSING,
      });

      const updated = await service.updateStatus(
        'order-1',
        { status: OrderStatus.PROCESSING },
        'admin-1',
      );
      expect(updated.status).toBe(OrderStatus.PROCESSING);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORDER_STATUS_CHANGED',
          entityId: 'order-1',
        }),
      );
    });

    it('should disallow invalid status transition from CANCELLED to PENDING', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
      });

      await expect(
        service.updateStatus('order-1', { status: OrderStatus.PENDING }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
