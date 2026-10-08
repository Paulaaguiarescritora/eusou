import { Test, TestingModule } from '@nestjs/testing';
import { ProductionService } from './production.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { InventoryService } from '../inventory/inventory.service';
import { BadRequestException } from '@nestjs/common';
import { PrinterStatus, ProductionJobStatus } from '@prisma/client';

describe('ProductionService', () => {
  let service: ProductionService;
  let prisma: any;
  let inventoryService: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      printer: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      material: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      materialMovement: {
        create: jest.fn(),
      },
      productionProfile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      productionJob: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      energyCostConfig: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    inventoryService = {
      handleProductionCompleted: jest.fn().mockResolvedValue(undefined),
    };

    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
  });

  describe('createPrinter and updatePrinter', () => {
    it('should create printer with AVAILABLE status', async () => {
      prisma.printer.create.mockResolvedValue({
        id: 'p-1',
        name: 'Bambu Lab X1C',
        model: 'X1-Carbon',
        status: PrinterStatus.AVAILABLE,
      });

      const printer = await service.createPrinter({
        name: 'Bambu Lab X1C',
        model: 'X1-Carbon',
      });

      expect(printer.name).toBe('Bambu Lab X1C');
      expect(prisma.printer.create).toHaveBeenCalled();
    });

    it('should prevent setting printer to MAINTENANCE if it has an active PRINTING job', async () => {
      prisma.printer.findUnique.mockResolvedValue({
        id: 'p-1',
        name: 'Bambu Lab X1C',
        status: PrinterStatus.PRINTING,
      });

      prisma.productionJob.findFirst.mockResolvedValue({
        id: 'job-1',
        printerId: 'p-1',
        status: ProductionJobStatus.PRINTING,
      });

      await expect(
        service.updatePrinter('p-1', { status: PrinterStatus.MAINTENANCE }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createProductionJob and startJob', () => {
    it('should create job in QUEUED status', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Vaso Poligonal',
      });
      prisma.printer.findUnique.mockResolvedValue({
        id: 'p-1',
        status: PrinterStatus.AVAILABLE,
        machineCostPerHour: 5.0,
      });
      prisma.productionProfile.findFirst.mockResolvedValue(null);

      prisma.productionJob.create.mockResolvedValue({
        id: 'job-1',
        productId: 'prod-1',
        printerId: 'p-1',
        status: ProductionJobStatus.QUEUED,
        plannedQuantity: 2,
      });

      const job = await service.createProductionJob({
        productId: 'prod-1',
        printerId: 'p-1',
        plannedQuantity: 2,
      });

      expect(job.status).toBe(ProductionJobStatus.QUEUED);
    });

    it('should start job and set printer to PRINTING, rejecting conflicting simultaneous job', async () => {
      prisma.productionJob.findUnique.mockResolvedValue({
        id: 'job-1',
        printerId: 'p-1',
        status: ProductionJobStatus.QUEUED,
        printer: { id: 'p-1', name: 'Ender 3 V3' },
      });

      // Conflicting job exists
      prisma.productionJob.findFirst.mockResolvedValue({
        id: 'job-busy',
        printerId: 'p-1',
        status: ProductionJobStatus.PRINTING,
      });

      await expect(service.startJob('job-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeJob', () => {
    it('should complete job, free printer, consume materials and call inventoryService', async () => {
      prisma.productionJob.findUnique.mockResolvedValue({
        id: 'job-1',
        productId: 'prod-1',
        variantId: null,
        printerId: 'p-1',
        status: ProductionJobStatus.PRINTING,
        plannedQuantity: 5,
        estimatedCost: 20,
      });

      prisma.printer.update.mockResolvedValue({
        id: 'p-1',
        status: PrinterStatus.AVAILABLE,
      });

      const mockProfile = {
        id: 'prof-1',
        finishingCost: 0,
        packagingCost: 0,
        laborCost: 0,
        powerConsumptionWatts: 0,
        productionTimeMinutes: 0,
        materials: [
          {
            materialId: 'mat-1',
            quantity: 10, // 10g per unit
            material: {
              id: 'mat-1',
              name: 'PLA Preto',
              costPerUnit: 0.1,
              currentQuantity: 1000,
            },
          },
        ],
      };

      prisma.productionProfile.findFirst.mockResolvedValue(mockProfile);
      prisma.productionProfile.findUnique.mockResolvedValue(mockProfile);

      prisma.material.update.mockResolvedValue({});
      prisma.materialMovement.create.mockResolvedValue({});
      prisma.productionJob.update.mockResolvedValue({
        id: 'job-1',
        status: ProductionJobStatus.COMPLETED,
        producedQuantity: 5,
        rejectedQuantity: 0,
      });

      const res = await service.completeJob('job-1', {
        producedQuantity: 5,
        rejectedQuantity: 0,
      });

      expect(res.status).toBe(ProductionJobStatus.COMPLETED);
      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { status: PrinterStatus.AVAILABLE },
      });
      // 5 units * 10g = 50g consumed
      expect(prisma.material.update).toHaveBeenCalledWith({
        where: { id: 'mat-1' },
        data: { currentQuantity: 950 },
      });
      expect(inventoryService.handleProductionCompleted).toHaveBeenCalledWith(
        'prod-1',
        null,
        5,
        'job-1',
        prisma,
      );
    });
  });
});
