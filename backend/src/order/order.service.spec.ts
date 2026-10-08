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

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      productVariant: { findUnique: jest.fn() },
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLog = { log: jest.fn() };

    const mockAffiliateService = {
      handleOrderCreated: jest.fn().mockResolvedValue(undefined),
      handleOrderStatusChanged: jest.fn().mockResolvedValue(undefined),
    };

    const mockInventoryService = {
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
        status: OrderStatus.CONFIRMED,
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
      expect(result.total).toBe('199.80');
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerEmail: 'paula@example.com',
            subtotal: '199.80',
            total: '199.80',
          }),
        }),
      );
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
