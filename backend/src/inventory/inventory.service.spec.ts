import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { BadRequestException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      inventory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('adjustStock', () => {
    it('should adjust stock positively with movement record', async () => {
      prisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        variantId: null,
        quantity: 10,
        reservedQuantity: 0,
        minimumQuantity: 2,
      });

      prisma.inventory.update.mockResolvedValue({
        id: 'inv-1',
        quantity: 15,
        reservedQuantity: 0,
      });

      prisma.stockMovement.create.mockResolvedValue({
        id: 'mov-1',
        quantity: 5,
        type: StockMovementType.ADJUSTMENT,
      });

      const res = await service.adjustStock({
        productId: 'prod-1',
        quantity: 5,
        reason: 'Contagem física',
      });

      expect(res.inventory.quantity).toBe(15);
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            quantity: 5,
            reason: 'Contagem física',
            type: StockMovementType.ADJUSTMENT,
          }),
        }),
      );
    });

    it('should throw error when stock would become negative', async () => {
      prisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        variantId: null,
        quantity: 2,
        reservedQuantity: 0,
        minimumQuantity: 2,
      });

      await expect(
        service.adjustStock({
          productId: 'prod-1',
          quantity: -5,
          reason: 'Ajuste de perda',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleOrderConfirmed and handleOrderCancelled', () => {
    it('should deduct stock on order confirmation', async () => {
      prisma.stockMovement.findFirst.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        items: [
          {
            productId: 'prod-1',
            variantId: null,
            quantity: 2,
            productNameSnapshot: 'Vela Aromática',
          },
        ],
      });
      prisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantity: 10,
        reservedQuantity: 0,
      });

      await service.handleOrderConfirmed('order-1');

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 8 },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          type: StockMovementType.OUT,
          quantity: -2,
        }),
      });
    });

    it('should return stock on order cancellation', async () => {
      // First check: no return movement yet
      prisma.stockMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          productId: 'prod-1',
          variantId: null,
          quantity: -2,
          type: StockMovementType.OUT,
        },
      ]);
      prisma.stockMovement.findFirst.mockResolvedValue(null); // not returned yet
      prisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantity: 8,
      });

      await service.handleOrderCancelled('order-1');

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 10 },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          type: StockMovementType.IN,
          quantity: 2,
        }),
      });
    });
  });

  describe('handleProductionCompleted', () => {
    it('should increase stock when production finishes', async () => {
      prisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantity: 5,
      });
      prisma.inventory.update.mockResolvedValue({
        id: 'inv-1',
        quantity: 15,
      });

      await service.handleProductionCompleted('prod-1', null, 10, 'job-1');

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 15 },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          type: StockMovementType.IN,
          quantity: 10,
          referenceType: 'PRODUCTION',
          referenceId: 'job-1',
        }),
      });
    });
  });
});
