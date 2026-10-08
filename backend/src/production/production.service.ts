import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  PrinterStatus,
  ProductionJobStatus,
  MaterialType,
  MaterialUnit,
  MaterialMovementType,
  ProductionMode,
} from '@prisma/client';

export interface CreatePrinterDto {
  name: string;
  model: string;
  location?: string;
  machineCostPerHour?: number;
  notes?: string;
}

export interface UpdatePrinterDto {
  name?: string;
  model?: string;
  status?: PrinterStatus;
  location?: string;
  machineCostPerHour?: number;
  notes?: string;
}

export interface CreateMaterialDto {
  name: string;
  type?: MaterialType;
  color?: string;
  unit?: MaterialUnit;
  costPerUnit: number;
  currentQuantity?: number;
  minimumQuantity?: number;
}

export interface UpdateMaterialDto {
  name?: string;
  type?: MaterialType;
  color?: string;
  unit?: MaterialUnit;
  costPerUnit?: number;
  minimumQuantity?: number;
  isActive?: boolean;
}

export interface AdjustMaterialDto {
  quantity: number; // delta or target
  mode?: 'DELTA' | 'SET';
  reason: string;
}

export interface CreateProductionProfileDto {
  productId?: string;
  variantId?: string;
  productionMode?: ProductionMode;
  productionTimeMinutes?: number;
  materialWeightGrams?: number;
  powerConsumptionWatts?: number;
  finishingTimeMinutes?: number;
  finishingCost?: number;
  packagingCost?: number;
  laborCost?: number;
  notes?: string;
  materials?: {
    materialId: string;
    quantity: number;
    unit?: MaterialUnit;
    notes?: string;
  }[];
}

export interface CreateProductionJobDto {
  productId: string;
  variantId?: string;
  printerId: string;
  plannedQuantity: number;
  notes?: string;
}

export interface CompleteProductionJobDto {
  producedQuantity: number;
  rejectedQuantity: number;
  notes?: string;
}

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly inventoryService: InventoryService,
  ) {}

  // ==========================================
  // PRINTERS
  // ==========================================

  async getPrinters() {
    return this.prisma.printer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { productionJobs: true } },
      },
    });
  }

  async getPrinterById(id: string) {
    const printer = await this.prisma.printer.findUnique({
      where: { id },
      include: {
        productionJobs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { product: true },
        },
      },
    });
    if (!printer) throw new NotFoundException('Impressora não encontrada');
    return printer;
  }

  async createPrinter(dto: CreatePrinterDto, userId?: string) {
    if (!dto.name || !dto.model) {
      throw new BadRequestException(
        'Nome e modelo da impressora são obrigatórios',
      );
    }

    const printer = await this.prisma.printer.create({
      data: {
        name: dto.name.trim(),
        model: dto.model.trim(),
        location: dto.location?.trim() || null,
        machineCostPerHour: dto.machineCostPerHour ?? 0,
        notes: dto.notes?.trim() || null,
        status: PrinterStatus.AVAILABLE,
      },
    });

    await this.auditLog.log({
      action: 'PRINTER_CREATED',
      entity: 'Printer',
      entityId: printer.id,
      userId: userId ?? null,
      metadata: { name: printer.name, model: printer.model },
    });

    return printer;
  }

  async updatePrinter(id: string, dto: UpdatePrinterDto, userId?: string) {
    const current = await this.getPrinterById(id);

    // If changing to MAINTENANCE or INACTIVE while PRINTING, verify jobs
    if (
      dto.status &&
      dto.status !== current.status &&
      (dto.status === PrinterStatus.MAINTENANCE ||
        dto.status === PrinterStatus.INACTIVE)
    ) {
      const activeJob = await this.prisma.productionJob.findFirst({
        where: { printerId: id, status: ProductionJobStatus.PRINTING },
      });
      if (activeJob) {
        throw new BadRequestException(
          `Não é possível alterar impressora para ${dto.status} pois ela possui um job ativo (#${activeJob.id.slice(0, 8)})`,
        );
      }
    }

    const updated = await this.prisma.printer.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        model: dto.model?.trim(),
        status: dto.status,
        location: dto.location?.trim(),
        machineCostPerHour: dto.machineCostPerHour,
        notes: dto.notes?.trim(),
      },
    });

    await this.auditLog.log({
      action:
        dto.status && dto.status !== current.status
          ? 'PRINTER_STATUS_CHANGED'
          : 'PRINTER_UPDATED',
      entity: 'Printer',
      entityId: updated.id,
      userId: userId ?? null,
      metadata: { oldStatus: current.status, newStatus: updated.status },
    });

    return updated;
  }

  // ==========================================
  // MATERIALS
  // ==========================================

  async getMaterials() {
    return this.prisma.material.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getMaterialById(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        materialMovements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!material) throw new NotFoundException('Material não encontrado');
    return material;
  }

  async createMaterial(dto: CreateMaterialDto, userId?: string) {
    if (!dto.name)
      throw new BadRequestException('Nome do material é obrigatório');
    if (dto.costPerUnit === undefined || dto.costPerUnit < 0) {
      throw new BadRequestException('Custo por unidade inválido');
    }

    const material = await this.prisma.material.create({
      data: {
        name: dto.name.trim(),
        type: dto.type || MaterialType.PLA,
        color: dto.color?.trim() || null,
        unit: dto.unit || MaterialUnit.GRAM,
        costPerUnit: dto.costPerUnit,
        currentQuantity: dto.currentQuantity ?? 0,
        minimumQuantity: dto.minimumQuantity ?? 0,
        isActive: true,
      },
    });

    if (Number(dto.currentQuantity) > 0) {
      await this.prisma.materialMovement.create({
        data: {
          materialId: material.id,
          type: MaterialMovementType.IN,
          quantity: dto.currentQuantity!,
          referenceType: 'MANUAL_ADJUSTMENT',
          reason: 'Saldo inicial cadastrado',
          createdBy: userId || null,
        },
      });
    }

    await this.auditLog.log({
      action: 'MATERIAL_CREATED',
      entity: 'Material',
      entityId: material.id,
      userId: userId ?? null,
      metadata: { name: material.name, type: material.type },
    });

    return material;
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto, userId?: string) {
    await this.getMaterialById(id);

    const updated = await this.prisma.material.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        color: dto.color?.trim(),
        unit: dto.unit,
        costPerUnit: dto.costPerUnit,
        minimumQuantity: dto.minimumQuantity,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.log({
      action: 'MATERIAL_UPDATED',
      entity: 'Material',
      entityId: updated.id,
      userId: userId ?? null,
      metadata: { name: updated.name },
    });

    return updated;
  }

  async adjustMaterialStock(
    id: string,
    dto: AdjustMaterialDto,
    userId?: string,
  ) {
    const material = await this.getMaterialById(id);
    if (!dto.reason?.trim()) {
      throw new BadRequestException(
        'Motivo do ajuste de material é obrigatório',
      );
    }

    const currentQty = Number(material.currentQuantity);
    let delta = 0;
    let newQty = currentQty;

    if (dto.mode === 'SET') {
      if (dto.quantity < 0)
        throw new BadRequestException('Quantidade não pode ser negativa');
      delta = dto.quantity - currentQty;
      newQty = dto.quantity;
    } else {
      delta = dto.quantity;
      newQty = currentQty + delta;
    }

    if (newQty < 0) {
      throw new BadRequestException(
        `Ajuste resultaria em estoque negativo de material (Saldo atual: ${currentQty})`,
      );
    }

    const movementType =
      delta >= 0 ? MaterialMovementType.IN : MaterialMovementType.OUT;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.material.update({
        where: { id },
        data: { currentQuantity: newQty },
      });

      const movement = await tx.materialMovement.create({
        data: {
          materialId: id,
          type: movementType,
          quantity: Math.abs(delta),
          referenceType: 'MANUAL_ADJUSTMENT',
          reason: dto.reason.trim(),
          createdBy: userId || null,
        },
      });

      await this.auditLog.log({
        action: 'MATERIAL_STOCK_ADJUSTED',
        entity: 'Material',
        entityId: id,
        userId: userId ?? null,
        metadata: {
          previousQuantity: currentQty,
          newQuantity: newQty,
          delta,
          reason: dto.reason,
          movementId: movement.id,
        },
      });

      return { material: updated, movement };
    });
  }

  // ==========================================
  // PRODUCTION PROFILES & COST ESTIMATION
  // ==========================================

  async getProductionProfiles() {
    return this.prisma.productionProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
        materials: { include: { material: true } },
      },
    });
  }

  async getProductionProfileById(id: string) {
    const profile = await this.prisma.productionProfile.findUnique({
      where: { id },
      include: {
        product: true,
        variant: true,
        materials: { include: { material: true } },
      },
    });
    if (!profile)
      throw new NotFoundException('Ficha de produção não encontrada');
    return profile;
  }

  async createProductionProfile(
    dto: CreateProductionProfileDto,
    userId?: string,
  ) {
    if (!dto.productId && !dto.variantId) {
      throw new BadRequestException(
        'A ficha deve pertencer a um produto ou variante',
      );
    }

    // Validate product and variant consistency
    if (dto.productId) {
      const p = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });
      if (!p) throw new NotFoundException('Produto não encontrado');
    }
    if (dto.variantId) {
      const v = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });
      if (!v) throw new NotFoundException('Variante não encontrada');
      if (dto.productId && v.productId !== dto.productId) {
        throw new BadRequestException(
          'A variante não pertence ao produto selecionado',
        );
      }
    }

    const profile = await this.prisma.productionProfile.create({
      data: {
        productId: dto.productId || null,
        variantId: dto.variantId || null,
        productionMode: dto.productionMode || ProductionMode.STOCK,
        productionTimeMinutes: dto.productionTimeMinutes ?? 0,
        materialWeightGrams: dto.materialWeightGrams ?? 0,
        powerConsumptionWatts: dto.powerConsumptionWatts ?? 0,
        finishingTimeMinutes: dto.finishingTimeMinutes ?? 0,
        finishingCost: dto.finishingCost ?? 0,
        packagingCost: dto.packagingCost ?? 0,
        laborCost: dto.laborCost ?? 0,
        notes: dto.notes?.trim() || null,
        isActive: true,
        materials: {
          create: (dto.materials || []).map((m) => ({
            materialId: m.materialId,
            quantity: m.quantity,
            unit: m.unit || MaterialUnit.GRAM,
            notes: m.notes?.trim() || null,
          })),
        },
      },
      include: {
        materials: { include: { material: true } },
      },
    });

    await this.auditLog.log({
      action: 'PRODUCTION_PROFILE_CREATED',
      entity: 'ProductionProfile',
      entityId: profile.id,
      userId: userId ?? null,
      metadata: { productId: profile.productId, variantId: profile.variantId },
    });

    return profile;
  }

  /**
   * Calculate detailed estimated cost breakdown for a profile or job
   */
  async calculateEstimatedCost(
    profileId: string,
    quantity: number = 1,
    printerId?: string,
  ): Promise<{
    materialCost: number;
    energyCost: number;
    machineCost: number;
    finishingCost: number;
    packagingCost: number;
    laborCost: number;
    totalCost: number;
    isPartial: boolean;
  }> {
    const profile = await this.getProductionProfileById(profileId);

    // 1. Material Cost
    let materialCost = 0;
    for (const pm of profile.materials) {
      const matUnitCost = Number(pm.material.costPerUnit);
      const qtyUsed = Number(pm.quantity);
      materialCost += matUnitCost * qtyUsed * quantity;
    }

    // 2. Energy Cost
    let energyCost = 0;
    const energyConfig = await this.prisma.energyCostConfig.findFirst({
      where: { isActive: true },
    });

    if (
      energyConfig &&
      profile.powerConsumptionWatts > 0 &&
      profile.productionTimeMinutes > 0
    ) {
      const hours = (profile.productionTimeMinutes / 60) * quantity;
      const kwh = (profile.powerConsumptionWatts / 1000) * hours;
      energyCost = kwh * Number(energyConfig.costPerKwh);
    }

    // 3. Machine Cost
    let machineCost = 0;
    if (printerId) {
      const printer = await this.prisma.printer.findUnique({
        where: { id: printerId },
      });
      if (printer && Number(printer.machineCostPerHour) > 0) {
        const hours = (profile.productionTimeMinutes / 60) * quantity;
        machineCost = hours * Number(printer.machineCostPerHour);
      }
    }

    // 4. Finishing, Packaging & Labor
    const finishingCost = Number(profile.finishingCost) * quantity;
    const packagingCost = Number(profile.packagingCost) * quantity;
    const laborCost = Number(profile.laborCost) * quantity;

    const totalCost =
      materialCost +
      energyCost +
      machineCost +
      finishingCost +
      packagingCost +
      laborCost;

    return {
      materialCost: Number(materialCost.toFixed(2)),
      energyCost: Number(energyCost.toFixed(2)),
      machineCost: Number(machineCost.toFixed(2)),
      finishingCost: Number(finishingCost.toFixed(2)),
      packagingCost: Number(packagingCost.toFixed(2)),
      laborCost: Number(laborCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      isPartial: !energyConfig || !printerId,
    };
  }

  // ==========================================
  // PRODUCTION JOBS & QUEUE
  // ==========================================

  async getProductionJobs(query: {
    status?: ProductionJobStatus;
    printerId?: string;
    productId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.printerId) where.printerId = query.printerId;
    if (query.productId) where.productId = query.productId;

    const [data, total] = await Promise.all([
      this.prisma.productionJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, sku: true } },
          printer: {
            select: { id: true, name: true, model: true, status: true },
          },
        },
      }),
      this.prisma.productionJob.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getProductionJobById(id: string) {
    const job = await this.prisma.productionJob.findUnique({
      where: { id },
      include: {
        product: true,
        variant: true,
        printer: true,
      },
    });
    if (!job) throw new NotFoundException('Ordem de produção não encontrada');
    return job;
  }

  async createProductionJob(dto: CreateProductionJobDto, userId?: string) {
    if (!dto.productId || !dto.printerId) {
      throw new BadRequestException('Produto e impressora são obrigatórios');
    }
    if (!dto.plannedQuantity || dto.plannedQuantity <= 0) {
      throw new BadRequestException(
        'Quantidade planejada deve ser maior que zero',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const printer = await this.prisma.printer.findUnique({
      where: { id: dto.printerId },
    });
    if (!printer) throw new NotFoundException('Impressora não encontrada');
    if (
      printer.status === PrinterStatus.INACTIVE ||
      printer.status === PrinterStatus.MAINTENANCE
    ) {
      throw new BadRequestException(
        `Impressora não está operacional (Status: ${printer.status})`,
      );
    }

    // Find active profile for cost estimate
    const profile = await this.prisma.productionProfile.findFirst({
      where: {
        productId: dto.productId,
        variantId: dto.variantId || null,
        isActive: true,
      },
      include: { materials: { include: { material: true } } },
    });

    let estimatedCost = 0;
    if (profile) {
      const costCalc = await this.calculateEstimatedCost(
        profile.id,
        dto.plannedQuantity,
        printer.id,
      );
      estimatedCost = costCalc.totalCost;
    }

    const job = await this.prisma.productionJob.create({
      data: {
        productId: dto.productId,
        variantId: dto.variantId || null,
        printerId: dto.printerId,
        plannedQuantity: dto.plannedQuantity,
        status: ProductionJobStatus.QUEUED,
        estimatedCost,
        notes: dto.notes?.trim() || null,
      },
      include: {
        product: true,
        variant: true,
        printer: true,
      },
    });

    await this.auditLog.log({
      action: 'PRODUCTION_JOB_CREATED',
      entity: 'ProductionJob',
      entityId: job.id,
      userId: userId ?? null,
      metadata: {
        productId: job.productId,
        printerId: job.printerId,
        plannedQuantity: job.plannedQuantity,
        estimatedCost,
      },
    });

    return job;
  }

  /**
   * Start job execution on printer (QUEUED or PAUSED -> PRINTING)
   */
  async startJob(id: string, userId?: string) {
    const job = await this.getProductionJobById(id);

    if (
      job.status !== ProductionJobStatus.QUEUED &&
      job.status !== ProductionJobStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Job não pode ser iniciado a partir do status "${job.status}"`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Validate that printer is not executing another job simultaneously
      const conflictingJob = await tx.productionJob.findFirst({
        where: {
          printerId: job.printerId,
          status: ProductionJobStatus.PRINTING,
          id: { not: id },
        },
      });

      if (conflictingJob) {
        throw new BadRequestException(
          `A impressora "${job.printer.name}" já está executando o job #${conflictingJob.id.slice(0, 8)}`,
        );
      }

      // Update printer status to PRINTING
      await tx.printer.update({
        where: { id: job.printerId },
        data: { status: PrinterStatus.PRINTING },
      });

      const updatedJob = await tx.productionJob.update({
        where: { id },
        data: {
          status: ProductionJobStatus.PRINTING,
          startedAt: job.startedAt || new Date(),
        },
        include: { product: true, variant: true, printer: true },
      });

      await this.auditLog.log({
        action: 'PRODUCTION_JOB_STARTED',
        entity: 'ProductionJob',
        entityId: id,
        userId: userId ?? null,
        metadata: { printerId: job.printerId },
      });

      return updatedJob;
    });
  }

  /**
   * Pause job execution (PRINTING -> PAUSED)
   */
  async pauseJob(id: string, userId?: string) {
    const job = await this.getProductionJobById(id);
    if (job.status !== ProductionJobStatus.PRINTING) {
      throw new BadRequestException(
        `Apenas jobs em PRINTING podem ser pausados (Atual: ${job.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.printer.update({
        where: { id: job.printerId },
        data: { status: PrinterStatus.AVAILABLE },
      });

      const updated = await tx.productionJob.update({
        where: { id },
        data: { status: ProductionJobStatus.PAUSED },
      });

      await this.auditLog.log({
        action: 'PRODUCTION_JOB_PAUSED',
        entity: 'ProductionJob',
        entityId: id,
        userId: userId ?? null,
      });

      return updated;
    });
  }

  /**
   * Cancel job execution
   */
  async cancelJob(id: string, reason?: string, userId?: string) {
    const job = await this.getProductionJobById(id);
    if (
      job.status === ProductionJobStatus.COMPLETED ||
      job.status === ProductionJobStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Job já se encontra em status terminal "${job.status}"`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Liberate printer if job was active
      if (job.status === ProductionJobStatus.PRINTING) {
        await tx.printer.update({
          where: { id: job.printerId },
          data: { status: PrinterStatus.AVAILABLE },
        });
      }

      const updated = await tx.productionJob.update({
        where: { id },
        data: {
          status: ProductionJobStatus.CANCELLED,
          notes: reason
            ? `${job.notes || ''} [Cancelado: ${reason}]`.trim()
            : job.notes,
        },
      });

      await this.auditLog.log({
        action: 'PRODUCTION_JOB_CANCELLED',
        entity: 'ProductionJob',
        entityId: id,
        userId: userId ?? null,
        metadata: { reason },
      });

      return updated;
    });
  }

  /**
   * Complete job execution:
   * 1. Register produced and rejected quantities
   * 2. Free up printer (PRINTING -> AVAILABLE)
   * 3. Deduct material consumption
   * 4. Add producedQuantity to Inventory
   */
  async completeJob(
    id: string,
    dto: CompleteProductionJobDto,
    userId?: string,
  ) {
    const job = await this.getProductionJobById(id);
    if (
      job.status !== ProductionJobStatus.PRINTING &&
      job.status !== ProductionJobStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Job deve estar em PRINTING ou PAUSED para conclusão (Atual: ${job.status})`,
      );
    }

    if (dto.producedQuantity < 0 || dto.rejectedQuantity < 0) {
      throw new BadRequestException(
        'Quantidades produzidas e rejeitadas não podem ser negativas',
      );
    }

    if (dto.producedQuantity + dto.rejectedQuantity > job.plannedQuantity) {
      throw new BadRequestException(
        `A soma de produzidos (${dto.producedQuantity}) e rejeitados (${dto.rejectedQuantity}) excede o planejado (${job.plannedQuantity})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Liberate printer
      await tx.printer.update({
        where: { id: job.printerId },
        data: { status: PrinterStatus.AVAILABLE },
      });

      // 2. Consume Materials if profile exists
      const profile = await tx.productionProfile.findFirst({
        where: {
          productId: job.productId,
          variantId: job.variantId || null,
          isActive: true,
        },
        include: { materials: { include: { material: true } } },
      });

      const totalItemsToConsume = dto.producedQuantity + dto.rejectedQuantity;
      let calculatedActualCost = 0;

      if (profile && totalItemsToConsume > 0) {
        for (const pm of profile.materials) {
          const requiredQty = Number(pm.quantity) * totalItemsToConsume;

          // Check material inventory
          const currentStock = Number(pm.material.currentQuantity);
          if (currentStock < requiredQty) {
            throw new BadRequestException(
              `Estoque insuficiente do material "${pm.material.name}". Disponível: ${currentStock}, Necessário: ${requiredQty}`,
            );
          }

          // Deduct material
          await tx.material.update({
            where: { id: pm.materialId },
            data: { currentQuantity: currentStock - requiredQty },
          });

          await tx.materialMovement.create({
            data: {
              materialId: pm.materialId,
              type: MaterialMovementType.OUT,
              quantity: requiredQty,
              referenceType: 'PRODUCTION_JOB',
              referenceId: job.id,
              reason: `Consumo Produção #${job.id.slice(0, 8)} (${totalItemsToConsume} itens)`,
              createdBy: userId || null,
            },
          });

          calculatedActualCost += Number(pm.material.costPerUnit) * requiredQty;
        }

        // Add proportional labor, energy, finishing
        const singleItemCost = await this.calculateEstimatedCost(
          profile.id,
          1,
          job.printerId,
        );
        calculatedActualCost +=
          (singleItemCost.energyCost +
            singleItemCost.machineCost +
            singleItemCost.finishingCost +
            singleItemCost.packagingCost +
            singleItemCost.laborCost) *
          dto.producedQuantity;
      }

      // 3. Update job record
      const completedJob = await tx.productionJob.update({
        where: { id },
        data: {
          status: ProductionJobStatus.COMPLETED,
          producedQuantity: dto.producedQuantity,
          rejectedQuantity: dto.rejectedQuantity,
          completedAt: new Date(),
          actualCost:
            calculatedActualCost > 0 ? calculatedActualCost : job.estimatedCost,
          notes: dto.notes?.trim() || job.notes,
        },
      });

      // 4. Entry to Finished Products Inventory
      if (dto.producedQuantity > 0) {
        await this.inventoryService.handleProductionCompleted(
          job.productId,
          job.variantId,
          dto.producedQuantity,
          job.id,
          tx,
        );
      }

      await this.auditLog.log({
        action: 'PRODUCTION_JOB_COMPLETED',
        entity: 'ProductionJob',
        entityId: id,
        userId: userId ?? null,
        metadata: {
          producedQuantity: dto.producedQuantity,
          rejectedQuantity: dto.rejectedQuantity,
          actualCost: completedJob.actualCost,
        },
      });

      return completedJob;
    });
  }

  // ==========================================
  // OPERATIONAL DASHBOARD
  // ==========================================

  async getOperationalDashboard() {
    const [
      queuedJobs,
      printingJobs,
      pausedJobs,
      completedJobs,
      availablePrinters,
      busyPrinters,
      materials,
      inventories,
    ] = await Promise.all([
      this.prisma.productionJob.count({
        where: { status: ProductionJobStatus.QUEUED },
      }),
      this.prisma.productionJob.count({
        where: { status: ProductionJobStatus.PRINTING },
      }),
      this.prisma.productionJob.count({
        where: { status: ProductionJobStatus.PAUSED },
      }),
      this.prisma.productionJob.count({
        where: { status: ProductionJobStatus.COMPLETED },
      }),
      this.prisma.printer.count({ where: { status: PrinterStatus.AVAILABLE } }),
      this.prisma.printer.count({ where: { status: PrinterStatus.PRINTING } }),
      this.prisma.material.findMany({
        select: { currentQuantity: true, minimumQuantity: true },
      }),
      this.prisma.inventory.findMany({
        select: {
          quantity: true,
          reservedQuantity: true,
          minimumQuantity: true,
          product: { select: { basePrice: true } },
        },
      }),
    ]);

    const lowStockMaterials = materials.filter(
      (m) => Number(m.currentQuantity) <= Number(m.minimumQuantity),
    ).length;

    const lowStockProducts = inventories.filter(
      (i) => i.quantity - i.reservedQuantity <= i.minimumQuantity,
    ).length;

    const totalInventoryValue = inventories.reduce((acc, i) => {
      const price = Number(i.product?.basePrice) || 0;
      return acc + (i.quantity - i.reservedQuantity) * price;
    }, 0);

    return {
      jobs: {
        queued: queuedJobs,
        printing: printingJobs,
        paused: pausedJobs,
        completed: completedJobs,
      },
      printers: {
        available: availablePrinters,
        busy: busyPrinters,
      },
      alerts: {
        lowStockMaterials,
        lowStockProducts,
      },
      financial: {
        totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
      },
    };
  }
}
