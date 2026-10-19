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

    it('should deduct ONLY variant stock (Rosa), leaving other variants untouched', async () => {
      prisma.stockMovement.findFirst.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-gat-rosa',
        items: [
          {
            productId: 'prod-gat',
            variantId: 'var-rosa',
            quantity: 1,
            productNameSnapshot: 'Porta Chaves Gatinho Felinodelia - Rosa',
          },
        ],
      });
      prisma.inventory.findFirst.mockImplementation((args: any) => {
        if (args.where.variantId === 'var-rosa') {
          return Promise.resolve({
            id: 'inv-var-rosa',
            productId: 'prod-gat',
            variantId: 'var-rosa',
            quantity: 5,
            reservedQuantity: 0,
          });
        }
        return Promise.resolve(null);
      });

      await service.handleOrderConfirmed('order-gat-rosa');

      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-var-rosa' },
        data: { quantity: 4 },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-gat',
          variantId: 'var-rosa',
          type: StockMovementType.OUT,
          quantity: -1,
        }),
      });
    });

    it('should throw BadRequestException and block when variant stock is insufficient', async () => {
      prisma.stockMovement.findFirst.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-insufficient',
        items: [
          {
            productId: 'prod-gat',
            variantId: 'var-rosa',
            quantity: 3,
            productNameSnapshot: 'Porta Chaves Gatinho Felinodelia - Rosa',
          },
        ],
      });
      prisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-var-rosa',
        productId: 'prod-gat',
        variantId: 'var-rosa',
        quantity: 2,
        reservedQuantity: 0,
      });

      await expect(
        service.handleOrderConfirmed('order-insufficient'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should be idempotent and not deduct stock twice for the same confirmed order', async () => {
      prisma.stockMovement.findFirst.mockResolvedValue({
        id: 'existing-out-movement',
        referenceId: 'order-already-processed',
        type: StockMovementType.OUT,
      });

      await service.handleOrderConfirmed('order-already-processed');

      expect(prisma.inventory.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
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

  describe('getInventory — Regra Operacional de Variantes e Produto-Pai', () => {
    it('1. produto com variantes não deve retornar variantId: null (oculta registro do pai e lista apenas variantes)', async () => {
      // Simula Bolinha de Purga / Gatinho com registro pai e 2 variantes
      prisma.inventory.findMany.mockResolvedValue([
        {
          id: 'inv-parent',
          productId: 'prod-bol',
          variantId: null,
          quantity: 0,
          reservedQuantity: 0,
          minimumQuantity: 5,
          product: {
            id: 'prod-bol',
            name: 'Bolinha de Purga',
            sku: 'FEL-BOL-001',
            status: 'ACTIVE',
            variants: [
              { id: 'var-azul', name: 'Azul', sku: 'FEL-BOL-001-az', isActive: true },
              { id: 'var-preta', name: 'Preta', sku: 'FEL-BOL-001-pt', isActive: true },
            ],
          },
          variant: null,
        },
        {
          id: 'inv-azul',
          productId: 'prod-bol',
          variantId: 'var-azul',
          quantity: 3,
          reservedQuantity: 0,
          minimumQuantity: 0,
          product: {
            id: 'prod-bol',
            name: 'Bolinha de Purga',
            sku: 'FEL-BOL-001',
            status: 'ACTIVE',
            variants: [
              { id: 'var-azul', name: 'Azul', sku: 'FEL-BOL-001-az', isActive: true },
              { id: 'var-preta', name: 'Preta', sku: 'FEL-BOL-001-pt', isActive: true },
            ],
          },
          variant: { id: 'var-azul', name: 'Azul', sku: 'FEL-BOL-001-az', isActive: true },
        },
        {
          id: 'inv-preta',
          productId: 'prod-bol',
          variantId: 'var-preta',
          quantity: 4,
          reservedQuantity: 0,
          minimumQuantity: 0,
          product: {
            id: 'prod-bol',
            name: 'Bolinha de Purga',
            sku: 'FEL-BOL-001',
            status: 'ACTIVE',
            variants: [
              { id: 'var-azul', name: 'Azul', sku: 'FEL-BOL-001-az', isActive: true },
              { id: 'var-preta', name: 'Preta', sku: 'FEL-BOL-001-pt', isActive: true },
            ],
          },
          variant: { id: 'var-preta', name: 'Preta', sku: 'FEL-BOL-001-pt', isActive: true },
        },
      ]);

      const result = await service.getInventory({});

      // Deve listar apenas as 2 variantes
      expect(result.data.length).toBe(2);
      expect(result.data.some((i: any) => i.variantId === null)).toBe(false);
      expect(result.data.some((i: any) => i.id === 'inv-parent')).toBe(false);
      expect(result.data.map((i: any) => i.variantId)).toEqual(['var-azul', 'var-preta']);
      expect(result.meta.total).toBe(2);
    });

    it('2. produto sem variantes continua retornando variantId: null (usa estoque próprio do produto)', async () => {
      // Produto simples sem variantes
      prisma.inventory.findMany.mockResolvedValue([
        {
          id: 'inv-simples',
          productId: 'prod-simples',
          variantId: null,
          quantity: 10,
          reservedQuantity: 2,
          minimumQuantity: 3,
          product: {
            id: 'prod-simples',
            name: 'Produto Simples Sem Variantes',
            sku: 'SIMP-001',
            status: 'ACTIVE',
            variants: [], // sem variantes
          },
          variant: null,
        },
      ]);

      const result = await service.getInventory({});

      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('inv-simples');
      expect(result.data[0].variantId).toBeNull();
      expect(result.data[0].quantity).toBe(10);
      expect(result.data[0].availableQuantity).toBe(8);
      expect(result.meta.total).toBe(1);
    });

    it('3. nenhuma alteração de estoque é feita durante a listagem (read-only)', async () => {
      prisma.inventory.findMany.mockResolvedValue([]);

      await service.getInventory({});

      expect(prisma.inventory.update).not.toHaveBeenCalled();
      expect(prisma.inventory.create).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });
});
