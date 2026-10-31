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
  MaterialCategory,
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
  category?: MaterialCategory;
  color?: string;
  unit?: MaterialUnit;
  costPerUnit: number;
  currentQuantity?: number;
  minimumQuantity?: number;
}

export interface UpdateMaterialDto {
  name?: string;
  type?: MaterialType;
  category?: MaterialCategory;
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
  printerId?: string;
  productionMode?: ProductionMode;
  productionTimeMinutes?: number;
  productionTimeSeconds?: number;
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

export interface UpdateProductionProfileDto {
  printerId?: string;
  productionMode?: ProductionMode;
  productionTimeMinutes?: number;
  productionTimeSeconds?: number;
  materialWeightGrams?: number;
  powerConsumptionWatts?: number;
  finishingTimeMinutes?: number;
  finishingCost?: number;
  packagingCost?: number;
  laborCost?: number;
  notes?: string;
  isActive?: boolean;
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

  async getMaterials(query?: {
    activeOnly?: boolean;
    category?: MaterialCategory;
  }) {
    const where: any = {};
    if (query?.activeOnly) where.isActive = true;
    if (query?.category) where.category = query.category;
    return this.prisma.material.findMany({
      where,
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
        category: dto.category || MaterialCategory.PRODUCTION,
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
      metadata: { name: material.name, type: material.type, category: material.category },
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
        category: dto.category,
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

  /**
   * Exclusão segura de material:
   * Se já estiver associado a fichas técnicas ou movimentações de estoque,
   * NÃO apagar fisicamente — arquivar/desativar com segurança (isActive = false).
   * Se nunca tiver sido utilizado, permitir exclusão definitiva.
   */
  async deleteMaterial(id: string, userId?: string) {
    const material = await this.getMaterialById(id);

    const [usageCount, movementCount] = await Promise.all([
      this.prisma.productionMaterial.count({ where: { materialId: id } }),
      this.prisma.materialMovement.count({ where: { materialId: id } }),
    ]);

    if (usageCount > 0 || movementCount > 0) {
      const archived = await this.prisma.material.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditLog.log({
        action: 'MATERIAL_ARCHIVED',
        entity: 'Material',
        entityId: id,
        userId: userId ?? null,
        metadata: {
          name: material.name,
          reason: 'Material em uso arquivado com segurança (histórico preservado)',
          usageCount,
          movementCount,
        },
      });

      return {
        success: true,
        archived: true,
        deleted: false,
        message: 'Material possui histórico de uso e foi arquivado/desativado com segurança.',
        material: archived,
      };
    }

    await this.prisma.material.delete({ where: { id } });

    await this.auditLog.log({
      action: 'MATERIAL_DELETED',
      entity: 'Material',
      entityId: id,
      userId: userId ?? null,
      metadata: { name: material.name },
    });

    return {
      success: true,
      archived: false,
      deleted: true,
      message: 'Material sem histórico excluído definitivamente.',
    };
  }

  async archiveMaterial(id: string, userId?: string) {
    const material = await this.getMaterialById(id);
    const updated = await this.prisma.material.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLog.log({
      action: 'MATERIAL_ARCHIVED',
      entity: 'Material',
      entityId: id,
      userId: userId ?? null,
      metadata: { name: material.name },
    });

    return updated;
  }

  async reactivateMaterial(id: string, userId?: string) {
    const material = await this.getMaterialById(id);
    const updated = await this.prisma.material.update({
      where: { id },
      data: { isActive: true },
    });

    await this.auditLog.log({
      action: 'MATERIAL_REACTIVATED',
      entity: 'Material',
      entityId: id,
      userId: userId ?? null,
      metadata: { name: material.name },
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

  async getProductionProfiles(query?: {
    productId?: string;
    variantId?: string;
  }) {
    const where: any = {};
    if (query?.productId) where.productId = query.productId;
    if (query?.variantId) where.variantId = query.variantId;

    return this.prisma.productionProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
        printer: {
          select: { id: true, name: true, model: true, machineCostPerHour: true },
        },
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
        printer: true,
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

    if (dto.printerId) {
      const printer = await this.prisma.printer.findUnique({
        where: { id: dto.printerId },
      });
      if (!printer) throw new NotFoundException('Impressora não encontrada');
    }

    // Check if profile already exists for this product / variant
    const existing = await this.prisma.productionProfile.findFirst({
      where: {
        productId: dto.productId || null,
        variantId: dto.variantId || null,
      },
    });

    const totalSeconds =
      dto.productionTimeSeconds !== undefined && dto.productionTimeSeconds !== null
        ? dto.productionTimeSeconds
        : (dto.productionTimeMinutes ?? 0) * 60;

    const totalMinutes =
      dto.productionTimeMinutes !== undefined && dto.productionTimeMinutes !== null
        ? dto.productionTimeMinutes
        : Math.round(totalSeconds / 60);

    if (existing) {
      return this.updateProductionProfile(
        existing.id,
        {
          printerId: dto.printerId,
          productionMode: dto.productionMode,
          productionTimeMinutes: totalMinutes,
          productionTimeSeconds: totalSeconds,
          materialWeightGrams: dto.materialWeightGrams,
          powerConsumptionWatts: dto.powerConsumptionWatts,
          finishingTimeMinutes: dto.finishingTimeMinutes,
          finishingCost: dto.finishingCost,
          packagingCost: dto.packagingCost,
          laborCost: dto.laborCost,
          notes: dto.notes,
          materials: dto.materials,
        },
        userId,
      );
    }

    const profile = await this.prisma.productionProfile.create({
      data: {
        productId: dto.productId || null,
        variantId: dto.variantId || null,
        printerId: dto.printerId || null,
        productionMode: dto.productionMode || ProductionMode.STOCK,
        productionTimeMinutes: totalMinutes,
        productionTimeSeconds: totalSeconds,
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
        product: true,
        variant: true,
        printer: true,
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

  async updateProductionProfile(
    id: string,
    dto: UpdateProductionProfileDto,
    userId?: string,
  ) {
    const existing = await this.getProductionProfileById(id);

    if (dto.printerId) {
      const printer = await this.prisma.printer.findUnique({
        where: { id: dto.printerId },
      });
      if (!printer) throw new NotFoundException('Impressora não encontrada');
    }

    const totalSeconds =
      dto.productionTimeSeconds !== undefined && dto.productionTimeSeconds !== null
        ? dto.productionTimeSeconds
        : dto.productionTimeMinutes !== undefined && dto.productionTimeMinutes !== null
        ? dto.productionTimeMinutes * 60
        : existing.productionTimeSeconds || (existing.productionTimeMinutes * 60);

    const totalMinutes =
      dto.productionTimeMinutes !== undefined && dto.productionTimeMinutes !== null
        ? dto.productionTimeMinutes
        : Math.round(totalSeconds / 60);

    return this.prisma.$transaction(async (tx) => {
      if (dto.materials) {
        await tx.productionMaterial.deleteMany({
          where: { productionProfileId: id },
        });

        await tx.productionMaterial.createMany({
          data: dto.materials.map((m) => ({
            productionProfileId: id,
            materialId: m.materialId,
            quantity: m.quantity,
            unit: m.unit || MaterialUnit.GRAM,
            notes: m.notes?.trim() || null,
          })),
        });
      }

      const updated = await tx.productionProfile.update({
        where: { id },
        data: {
          printerId: dto.printerId !== undefined ? dto.printerId : existing.printerId,
          productionMode:
            dto.productionMode !== undefined
              ? dto.productionMode
              : existing.productionMode,
          productionTimeMinutes: totalMinutes,
          productionTimeSeconds: totalSeconds,
          materialWeightGrams:
            dto.materialWeightGrams !== undefined
              ? dto.materialWeightGrams
              : existing.materialWeightGrams,
          powerConsumptionWatts:
            dto.powerConsumptionWatts !== undefined
              ? dto.powerConsumptionWatts
              : existing.powerConsumptionWatts,
          finishingTimeMinutes:
            dto.finishingTimeMinutes !== undefined
              ? dto.finishingTimeMinutes
              : existing.finishingTimeMinutes,
          finishingCost:
            dto.finishingCost !== undefined
              ? dto.finishingCost
              : existing.finishingCost,
          packagingCost:
            dto.packagingCost !== undefined
              ? dto.packagingCost
              : existing.packagingCost,
          laborCost:
            dto.laborCost !== undefined ? dto.laborCost : existing.laborCost,
          notes:
            dto.notes !== undefined
              ? dto.notes?.trim() || null
              : existing.notes,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
        },
        include: {
          product: true,
          variant: true,
          printer: true,
          materials: { include: { material: true } },
        },
      });

      await this.auditLog.log({
        action: 'PRODUCTION_PROFILE_UPDATED',
        entity: 'ProductionProfile',
        entityId: id,
        userId: userId ?? null,
        metadata: { productId: updated.productId },
      });

      return updated;
    });
  }

  /**
   * Cálculo Simplificado e Preciso do Custo de Produção F7:
   * FILAMENTO + MÁQUINA + MATERIAIS ADICIONAIS + EMBALAGEM = CUSTO TOTAL DE PRODUÇÃO
   */
  async calculateEstimatedCost(
    profileId: string,
    quantity: number = 1,
    printerId?: string,
  ): Promise<{
    filamentCost: number;
    machineCost: number;
    additionalMaterialsCost: number;
    packagingCost: number;
    materialCost: number;
    energyCost: number;
    finishingCost: number;
    laborCost: number;
    totalCost: number;
    isPartial: boolean;
    breakdown: {
      filament: Array<{
        materialId: string;
        name: string;
        quantity: number;
        unit: string;
        costPerUnit: number;
        totalCost: number;
      }>;
      additionalMaterials: Array<{
        materialId: string;
        name: string;
        quantity: number;
        unit: string;
        costPerUnit: number;
        totalCost: number;
      }>;
      packaging: Array<{
        materialId: string;
        name: string;
        quantity: number;
        unit: string;
        costPerUnit: number;
        totalCost: number;
      }>;
      machine: {
        printerId?: string;
        printerName?: string;
        hours: number;
        ratePerHour: number;
        totalCost: number;
        timeFormatted: string;
      };
    };
  }> {
    const profile = await this.getProductionProfileById(profileId);

    // 1. Classificação e Cálculo dos Materiais
    let filamentCost = 0;
    let additionalMaterialsCost = 0;
    let packagingMaterialsCost = 0;

    const breakdownFilament: any[] = [];
    const breakdownAdditional: any[] = [];
    const breakdownPackaging: any[] = [];

    for (const pm of profile.materials) {
      const mat = pm.material;
      let unitCost = Number(mat.costPerUnit);
      if (
        mat.unit === MaterialUnit.KILOGRAM &&
        (pm.unit === MaterialUnit.GRAM || !pm.unit)
      ) {
        unitCost = unitCost / 1000;
      } else if (
        mat.unit === MaterialUnit.GRAM &&
        pm.unit === MaterialUnit.KILOGRAM
      ) {
        unitCost = unitCost * 1000;
      }
      const qtyUsed = Number(pm.quantity) * quantity;
      const itemCost = qtyUsed * unitCost;

      const itemData = {
        materialId: mat.id,
        name: mat.name,
        quantity: qtyUsed,
        unit: pm.unit || mat.unit,
        costPerUnit: unitCost,
        totalCost: Number(itemCost.toFixed(4)),
      };

      if (
        mat.category === MaterialCategory.PRODUCTION ||
        (!mat.category &&
          ['PLA', 'PETG', 'ABS', 'RESIN'].includes(mat.type))
      ) {
        filamentCost += itemCost;
        breakdownFilament.push(itemData);
      } else if (mat.category === MaterialCategory.COMPONENT) {
        additionalMaterialsCost += itemCost;
        breakdownAdditional.push(itemData);
      } else if (mat.category === MaterialCategory.PACKAGING) {
        packagingMaterialsCost += itemCost;
        breakdownPackaging.push(itemData);
      } else {
        // Fallback default
        additionalMaterialsCost += itemCost;
        breakdownAdditional.push(itemData);
      }
    }

    // 2. Máquina e Tempo (Bambu Studio: minutos e segundos convertidos para horas)
    let machineCost = 0;
    const resolvedPrinterId = printerId || profile.printerId;
    let resolvedPrinter: any = null;

    if (resolvedPrinterId) {
      resolvedPrinter = await this.prisma.printer.findUnique({
        where: { id: resolvedPrinterId },
      });
    }

    if (!resolvedPrinter && typeof this.prisma.printer.findFirst === 'function') {
      resolvedPrinter =
        (await this.prisma.printer.findFirst({
          where: { status: PrinterStatus.AVAILABLE },
        })) || (await this.prisma.printer.findFirst());
    }

    const totalSeconds =
      profile.productionTimeSeconds && profile.productionTimeSeconds > 0
        ? profile.productionTimeSeconds
        : (profile.productionTimeMinutes || 0) * 60;

    const hours = (totalSeconds / 3600) * quantity;
    const printerRate = resolvedPrinter ? Number(resolvedPrinter.machineCostPerHour) : 0;

    if (resolvedPrinter && printerRate > 0) {
      machineCost = hours * printerRate;
    }

    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const timeFormatted = `${mins}m${secs < 10 ? '0' : ''}${secs}s`;

    // 3. Embalagem (Materiais de embalagem + eventual taxa fixa no perfil)
    const fixedPackaging = Number(profile.packagingCost || 0) * quantity;
    const totalPackagingCost = packagingMaterialsCost + fixedPackaging;

    // 4. Energia e Custos Complementares
    // Regra: Não duplicar energia se o custo de máquina da impressora já foi apurado
    let energyCost = 0;
    if (machineCost === 0 && profile.powerConsumptionWatts > 0 && hours > 0) {
      const energyConfig = await this.prisma.energyCostConfig.findFirst({
        where: { isActive: true },
      });
      if (energyConfig) {
        const kwh = (profile.powerConsumptionWatts / 1000) * hours;
        energyCost = kwh * Number(energyConfig.costPerKwh);
      }
    }

    const finishingCost = Number(profile.finishingCost || 0) * quantity;
    const laborCost = Number(profile.laborCost || 0) * quantity;

    // Helper para arredondamento monetário preciso a duas casas decimais
    const roundCurrency = (val: number) => Math.round(val * 100 + 0.00001) / 100;

    const filamentRounded = roundCurrency(filamentCost);
    const machineRounded = roundCurrency(machineCost);
    const additionalRounded = roundCurrency(additionalMaterialsCost);
    const packagingRounded = roundCurrency(totalPackagingCost);
    const energyRounded = roundCurrency(energyCost);
    const finishingRounded = roundCurrency(finishingCost);
    const laborRounded = roundCurrency(laborCost);

    // 5. Custo Total de Produção F7
    // FILAMENTO + MÁQUINA + MATERIAIS ADICIONAIS + EMBALAGEM (+ energia/acabamento residuais se houver)
    const totalCost = roundCurrency(
      filamentRounded +
      machineRounded +
      additionalRounded +
      packagingRounded +
      energyRounded +
      finishingRounded +
      laborRounded,
    );

    const totalMaterialsCost = roundCurrency(
      filamentRounded + additionalRounded + packagingRounded,
    );

    return {
      filamentCost: filamentRounded,
      machineCost: machineRounded,
      additionalMaterialsCost: additionalRounded,
      packagingCost: packagingRounded,
      materialCost: totalMaterialsCost,
      energyCost: energyRounded,
      finishingCost: finishingRounded,
      laborCost: laborRounded,
      totalCost,
      isPartial: !resolvedPrinter && profile.materials.length === 0,
      breakdown: {
        filament: breakdownFilament,
        additionalMaterials: breakdownAdditional,
        packaging: breakdownPackaging,
        machine: {
          printerId: resolvedPrinter?.id,
          printerName: resolvedPrinter?.name
            ? `${resolvedPrinter.name} (${resolvedPrinter.model})`
            : undefined,
          hours: Number(hours.toFixed(4)),
          ratePerHour: printerRate,
          totalCost: machineRounded,
          timeFormatted,
        },
      },
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

          let matUnitCost = Number(pm.material.costPerUnit);
          if (
            pm.material.unit === MaterialUnit.KILOGRAM &&
            (pm.unit === MaterialUnit.GRAM || !pm.unit)
          ) {
            matUnitCost = matUnitCost / 1000;
          } else if (
            pm.material.unit === MaterialUnit.GRAM &&
            pm.unit === MaterialUnit.KILOGRAM
          ) {
            matUnitCost = matUnitCost * 1000;
          }
          calculatedActualCost += matUnitCost * requiredQty;
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
      (i) => i.quantity - i.reservedQuantity < i.minimumQuantity,
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
