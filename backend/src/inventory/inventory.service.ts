import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { StockMovementType } from '@prisma/client';

export interface AdjustStockDto {
  productId?: string;
  variantId?: string;
  quantity: number; // Delta (ex: +5, -3) or target
  mode?: 'DELTA' | 'SET';
  reason: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getInventory(query: {
    productId?: string;
    variantId?: string;
    lowStockOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.productId) where.productId = query.productId;
    if (query.variantId) where.variantId = query.variantId;

    const allRecords = await this.prisma.inventory.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, status: true } },
        variant: {
          select: { id: true, name: true, sku: true, isActive: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let filtered = allRecords;

    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.product?.name.toLowerCase().includes(q) ||
          i.product?.sku?.toLowerCase().includes(q) ||
          i.variant?.name?.toLowerCase().includes(q) ||
          i.variant?.sku?.toLowerCase().includes(q),
      );
    }

    if (String(query.lowStockOnly) === 'true') {
      filtered = filtered.filter(
        (i) => i.quantity - i.reservedQuantity <= i.minimumQuantity,
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      data: paginated.map((i) => ({
        ...i,
        availableQuantity: Math.max(0, i.quantity - i.reservedQuantity),
        isLowStock: i.quantity - i.reservedQuantity <= i.minimumQuantity,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getMovements(query: {
    productId?: string;
    variantId?: string;
    type?: StockMovementType;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.productId) where.productId = query.productId;
    if (query.variantId) where.variantId = query.variantId;
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, sku: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
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

  /**
   * Manual Adjustment by Admin
   */
  async adjustStock(dto: AdjustStockDto, userId?: string) {
    if (!dto.productId && !dto.variantId) {
      throw new BadRequestException('Informe productId ou variantId');
    }
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('Motivo do ajuste é obrigatório');
    }

    const mode = dto.mode || 'DELTA';

    return this.prisma.$transaction(async (tx) => {
      // Find or create inventory row
      let inventory = await tx.inventory.findFirst({
        where: {
          productId: dto.productId || null,
          variantId: dto.variantId || null,
        },
      });

      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            productId: dto.productId || null,
            variantId: dto.variantId || null,
            quantity: 0,
            reservedQuantity: 0,
            minimumQuantity: 0,
          },
        });
      }

      let delta = 0;
      let newQuantity = inventory.quantity;

      if (mode === 'SET') {
        if (dto.quantity < 0) {
          throw new BadRequestException('Estoque não pode ser negativo');
        }
        delta = dto.quantity - inventory.quantity;
        newQuantity = dto.quantity;
      } else {
        delta = dto.quantity;
        newQuantity = inventory.quantity + delta;
      }

      if (newQuantity - inventory.reservedQuantity < 0) {
        throw new BadRequestException(
          `Ajuste inválido: o estoque disponível não pode ser negativo (Atual: ${inventory.quantity}, Reservado: ${inventory.reservedQuantity}, Tentativa: ${newQuantity})`,
        );
      }

      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQuantity },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId || inventory.productId!,
          variantId: dto.variantId || null,
          type: StockMovementType.ADJUSTMENT,
          quantity: delta,
          referenceType: 'MANUAL_ADJUSTMENT',
          reason: dto.reason.trim(),
          createdBy: userId || null,
        },
      });

      await this.auditLog.log({
        action: 'STOCK_ADJUSTMENT',
        entity: 'Inventory',
        entityId: updated.id,
        userId: userId ?? null,
        metadata: {
          previousQuantity: inventory.quantity,
          newQuantity: updated.quantity,
          delta,
          reason: dto.reason,
          movementId: movement.id,
        },
      });

      return {
        inventory: updated,
        movement,
      };
    });
  }

  /**
   * Handle order confirmation: deduct stock atomically
   */
  async handleOrderConfirmed(orderId: string, txClient?: any) {
    const prisma = txClient || this.prisma;

    // Check if movement already registered for this order to prevent double deduction
    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.OUT,
      },
    });

    if (existingMovement) {
      return; // Already processed
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    for (const item of order.items) {
      // Find inventory
      const inventory = await prisma.inventory.findFirst({
        where: {
          productId: item.productId,
          variantId: item.variantId || null,
        },
      });

      // If no inventory record exists, make-to-order allows purchase without blocking
      if (!inventory) {
        // Record movement without negative check
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId || null,
            type: StockMovementType.OUT,
            quantity: -item.quantity,
            referenceType: 'ORDER',
            referenceId: order.id,
            reason: `Venda Pedido #${order.id.slice(0, 8)}`,
          },
        });
        continue;
      }

      const available = inventory.quantity - inventory.reservedQuantity;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Estoque insuficiente para o item "${item.productNameSnapshot}". Disponível: ${available}, Requisitado: ${item.quantity}`,
        );
      }

      await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: inventory.quantity - item.quantity },
      });

      await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          variantId: item.variantId || null,
          type: StockMovementType.OUT,
          quantity: -item.quantity,
          referenceType: 'ORDER',
          referenceId: order.id,
          reason: `Venda Pedido #${order.id.slice(0, 8)}`,
        },
      });
    }

    await this.auditLog.log({
      action: 'STOCK_OUT',
      entity: 'Order',
      entityId: order.id,
      metadata: {
        orderId: order.id,
        itemsCount: order.items.length,
      },
    });
  }

  /**
   * Handle order cancellation: return stock safely
   */
  async handleOrderCancelled(orderId: string, txClient?: any) {
    const prisma = txClient || this.prisma;

    // Check if an OUT movement occurred for this order
    const outMovements = await prisma.stockMovement.findMany({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.OUT,
      },
    });

    if (outMovements.length === 0) {
      return; // Nothing to return
    }

    // Check if already returned
    const existingInMovement = await prisma.stockMovement.findFirst({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.IN,
      },
    });

    if (existingInMovement) {
      return; // Already refunded
    }

    for (const mov of outMovements) {
      const quantityToReturn = Math.abs(mov.quantity);

      const inventory = await prisma.inventory.findFirst({
        where: {
          productId: mov.productId,
          variantId: mov.variantId || null,
        },
      });

      if (inventory) {
        await prisma.inventory.update({
          where: { id: inventory.id },
          data: { quantity: inventory.quantity + quantityToReturn },
        });
      }

      await prisma.stockMovement.create({
        data: {
          productId: mov.productId,
          variantId: mov.variantId || null,
          type: StockMovementType.IN,
          quantity: quantityToReturn,
          referenceType: 'ORDER',
          referenceId: orderId,
          reason: `Devolução por Cancelamento Pedido #${orderId.slice(0, 8)}`,
        },
      });
    }

    await this.auditLog.log({
      action: 'STOCK_IN',
      entity: 'Order',
      entityId: orderId,
      metadata: {
        orderId,
        returnedItemsCount: outMovements.length,
      },
    });
  }

  /**
   * Entry from completed production
   */
  async handleProductionCompleted(
    productId: string,
    variantId: string | null,
    producedQuantity: number,
    productionJobId: string,
    txClient?: any,
  ) {
    if (producedQuantity <= 0) return;

    const prisma = txClient || this.prisma;

    let inventory = await prisma.inventory.findFirst({
      where: {
        productId,
        variantId: variantId || null,
      },
    });

    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          productId,
          variantId: variantId || null,
          quantity: producedQuantity,
          reservedQuantity: 0,
          minimumQuantity: 5,
        },
      });
    } else {
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: inventory.quantity + producedQuantity },
      });
    }

    await prisma.stockMovement.create({
      data: {
        productId,
        variantId: variantId || null,
        type: StockMovementType.IN,
        quantity: producedQuantity,
        referenceType: 'PRODUCTION',
        referenceId: productionJobId,
        reason: `Entrada da Produção #${productionJobId.slice(0, 8)} (${producedQuantity} un)`,
      },
    });

    await this.auditLog.log({
      action: 'STOCK_IN',
      entity: 'ProductionJob',
      entityId: productionJobId,
      metadata: {
        productId,
        variantId,
        producedQuantity,
        newStockTotal: inventory.quantity,
      },
    });
  }
}
