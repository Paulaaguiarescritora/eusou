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
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            status: true,
            variants: {
              where: { isActive: true },
              select: { id: true, name: true, sku: true, isActive: true },
            },
          },
        },
        variant: {
          select: { id: true, name: true, sku: true, isActive: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Regra operacional comercial (homologada em DashboardService e CommercialAlertService):
    // 1. Se o produto possui variantes ativas:
    //    - O registro de estoque do produto-pai (variantId: null) é OCULTADO da listagem.
    //    - Listam-se exclusivamente os estoques das variantes ativas.
    // 2. Se o produto NÃO possui variantes ativas:
    //    - Lista-se o estoque próprio do produto (variantId: null).
    let filtered = allRecords.filter((inv) => {
      if (!inv.product) return false;

      const activeVariantsCount = inv.product.variants?.length || 0;

      if (activeVariantsCount > 0) {
        // Produto com variantes ativas:
        // Oculta registro do produto-pai (variantId === null)
        if (!inv.variantId) return false;
        // Oculta variantes inativas se houver
        if (inv.variant && !inv.variant.isActive) return false;
        return true;
      } else {
        // Produto sem variantes ativas:
        // Mantém apenas o registro do produto-pai
        return !inv.variantId;
      }
    });

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
   * Garante a existência do registro de inventário central para um produto/variante
   */
  async ensureInventoryExists(productId: string, variantId?: string | null, txClient?: any) {
    const prisma = txClient || this.prisma;
    const existing = await prisma.inventory.findFirst({
      where: {
        productId,
        variantId: variantId || null,
      },
    });

    if (!existing) {
      return prisma.inventory.create({
        data: {
          productId,
          variantId: variantId || null,
          quantity: 0,
          reservedQuantity: 0,
          minimumQuantity: 5,
        },
      });
    }
    return existing;
  }

  /**
   * P0: Reserva imediata e atômica de estoque no momento da criação do pedido (PENDING).
   * Protegido contra race condition / concorrência via WHERE (quantity - reservedQuantity >= requested).
   */
  async reserveStockForOrder(
    orderId: string,
    items: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
      productNameSnapshot?: string;
    }>,
    txClient?: any,
  ) {
    const prisma = txClient || this.prisma;

    // Idempotência: Se já houver reservas para este pedido, não duplicar
    const existingReservation = await prisma.stockMovement.findFirst({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.RESERVATION,
      },
    });
    if (existingReservation) {
      return;
    }

    for (const item of items) {
      if (item.quantity <= 0) continue;

      // Regra homologada: Se o produto possui variantes ativas, é estritamente proibido reservar estoque do produto-pai (variantId: null)
      const activeVariantsCount = await prisma.productVariant.count({
        where: { productId: item.productId, isActive: true },
      });
      if (activeVariantsCount > 0 && !item.variantId) {
        throw new BadRequestException(
          `Não é permitido reservar estoque do produto-pai para produtos com variantes ativas (${item.productNameSnapshot || item.productId}).`,
        );
      }

      // Assegura que o registro de inventário existe
      await this.ensureInventoryExists(item.productId, item.variantId, prisma);

      // Atualização atômica condicional no PostgreSQL
      let affectedRows: number;
      if (item.variantId) {
        affectedRows = await prisma.$executeRaw`
          UPDATE "Inventory"
          SET "reservedQuantity" = "reservedQuantity" + ${item.quantity},
              "updatedAt" = NOW()
          WHERE "productId" = ${item.productId}
            AND "variantId" = ${item.variantId}
            AND ("quantity" - "reservedQuantity") >= ${item.quantity}
        `;
      } else {
        affectedRows = await prisma.$executeRaw`
          UPDATE "Inventory"
          SET "reservedQuantity" = "reservedQuantity" + ${item.quantity},
              "updatedAt" = NOW()
          WHERE "productId" = ${item.productId}
            AND "variantId" IS NULL
            AND ("quantity" - "reservedQuantity") >= ${item.quantity}
        `;
      }

      if (affectedRows === 0) {
        // Obter saldo atual para mensagem descritiva de erro
        const currentInv = await prisma.inventory.findFirst({
          where: {
            productId: item.productId,
            variantId: item.variantId || null,
          },
        });
        const avail = currentInv ? Math.max(0, currentInv.quantity - currentInv.reservedQuantity) : 0;
        if (item.variantId) {
          if (avail <= 0) {
            throw new BadRequestException(
              `Esta variante está esgotada: "${item.productNameSnapshot || item.productId}".`,
            );
          }
          throw new BadRequestException(
            `Quantidade solicitada indisponível em estoque para a variante "${item.productNameSnapshot || item.productId}".`,
          );
        } else {
          if (avail <= 0) {
            throw new BadRequestException(
              `O produto "${item.productNameSnapshot || item.productId}" está esgotado.`,
            );
          }
          throw new BadRequestException(
            `Quantidade solicitada indisponível em estoque para o produto "${item.productNameSnapshot || item.productId}".`,
          );
        }
      }

      // Registra movimentação do tipo RESERVATION
      await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          variantId: item.variantId || null,
          type: StockMovementType.RESERVATION,
          quantity: item.quantity,
          referenceType: 'ORDER',
          referenceId: orderId,
          reason: `Reserva Pedido #${orderId.slice(0, 8)} (Prazo 24h)`,
        },
      });
    }

    await this.auditLog.log({
      action: 'STOCK_RESERVED',
      entity: 'Order',
      entityId: orderId,
      metadata: {
        orderId,
        itemsCount: items.length,
      },
    });
  }

  /**
   * P0: Liberação de reserva quando o pedido expirar (24h) ou for cancelado.
   * SEMÂNTICA OBRIGATÓRIA: reduz reservedQuantity SEM aumentar quantity.
   * IDEMPOTÊNCIA OBRIGATÓRIA: se executado mais de uma vez, não libera novamente.
   */
  async releaseStockForOrder(orderId: string, txClient?: any) {
    const prisma = txClient || this.prisma;

    // Idempotência: se já houve RELEASE para este pedido, aborta imediatamente
    const existingRelease = await prisma.stockMovement.findFirst({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.RELEASE,
      },
    });
    if (existingRelease) {
      return; // Já liberado previamente
    }

    // Busca reservas ativas do pedido
    const reservations = await prisma.stockMovement.findMany({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.RESERVATION,
      },
    });

    if (reservations.length === 0) {
      return; // Nenhuma reserva a liberar
    }

    for (const res of reservations) {
      const qtyToRelease = Math.abs(res.quantity);

      // Reduz reservedQuantity sem mexer em quantity (semântica oficial)
      if (res.variantId) {
        await prisma.$executeRaw`
          UPDATE "Inventory"
          SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${qtyToRelease}),
              "updatedAt" = NOW()
          WHERE "productId" = ${res.productId}
            AND "variantId" = ${res.variantId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE "Inventory"
          SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${qtyToRelease}),
              "updatedAt" = NOW()
          WHERE "productId" = ${res.productId}
            AND "variantId" IS NULL
        `;
      }

      // Registra a movimentação de RELEASE
      await prisma.stockMovement.create({
        data: {
          productId: res.productId,
          variantId: res.variantId || null,
          type: StockMovementType.RELEASE,
          quantity: -qtyToRelease,
          referenceType: 'ORDER',
          referenceId: orderId,
          reason: `Liberação de Reserva por Expiração/Cancelamento Pedido #${orderId.slice(0, 8)}`,
        },
      });
    }

    await this.auditLog.log({
      action: 'STOCK_RELEASED',
      entity: 'Order',
      entityId: orderId,
      metadata: {
        orderId,
        releasedItemsCount: reservations.length,
      },
    });
  }

  /**
   * Handle order confirmation: deduct stock atomically
   * SEMÂNTICA OBRIGATÓRIA: reduz quantity e reservedQuantity na mesma operação quando houver reserva prévia.
   * IDEMPOTÊNCIA OBRIGATÓRIA: não duplica baixa caso chamado repetidamente.
   */
  async handleOrderConfirmed(orderId: string, txClient?: any) {
    const prisma = txClient || this.prisma;

    // Idempotência: Check if movement already registered for this order to prevent double deduction
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
      // Verifica se houve reserva prévia (pedido criado na loja com status PENDING)
      const reservation = await prisma.stockMovement.findFirst({
        where: {
          referenceType: 'ORDER',
          referenceId: orderId,
          type: StockMovementType.RESERVATION,
          productId: item.productId,
          variantId: item.variantId || null,
        },
      });

      if (reservation) {
        // Reduz simultaneamente quantity e reservedQuantity na mesma operação atômica
        if (typeof prisma.$executeRaw === 'function') {
          if (item.variantId) {
            await prisma.$executeRaw`
              UPDATE "Inventory"
              SET "quantity" = GREATEST(0, "quantity" - ${item.quantity}),
                  "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity}),
                  "updatedAt" = NOW()
              WHERE "productId" = ${item.productId}
                AND "variantId" = ${item.variantId}
            `;
          } else {
            await prisma.$executeRaw`
              UPDATE "Inventory"
              SET "quantity" = GREATEST(0, "quantity" - ${item.quantity}),
                  "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity}),
                  "updatedAt" = NOW()
              WHERE "productId" = ${item.productId}
                AND "variantId" IS NULL
            `;
          }
        } else {
          const inv = await prisma.inventory.findFirst({
            where: { productId: item.productId, variantId: item.variantId || null },
          });
          if (inv) {
            await prisma.inventory.update({
              where: { id: inv.id },
              data: {
                quantity: Math.max(0, inv.quantity - item.quantity),
                reservedQuantity: Math.max(0, inv.reservedQuantity - item.quantity),
              },
            });
          }
        }
      } else {
        // Pedido sem reserva prévia (ex: marketplace ou legado): garante inventário e valida saldo
        const inv = await this.ensureInventoryExists(item.productId, item.variantId, prisma);
        const available = (inv?.quantity || 0) - (inv?.reservedQuantity || 0);
        if (available < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para o item "${item.productNameSnapshot || item.productId}". Disponível: ${available}, Solicitado: ${item.quantity}`,
          );
        }

        if (typeof prisma.$executeRaw === 'function') {
          if (item.variantId) {
            await prisma.$executeRaw`
              UPDATE "Inventory"
              SET "quantity" = GREATEST(0, "quantity" - ${item.quantity}),
                  "updatedAt" = NOW()
              WHERE "productId" = ${item.productId}
                AND "variantId" = ${item.variantId}
            `;
          } else {
            await prisma.$executeRaw`
              UPDATE "Inventory"
              SET "quantity" = GREATEST(0, "quantity" - ${item.quantity}),
                  "updatedAt" = NOW()
              WHERE "productId" = ${item.productId}
                AND "variantId" IS NULL
            `;
          }
        } else {
          await prisma.inventory.update({
            where: { id: inv.id },
            data: { quantity: (inv?.quantity || 0) - item.quantity },
          });
        }
      }

      await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          variantId: item.variantId || null,
          type: StockMovementType.OUT,
          quantity: -item.quantity,
          referenceType: 'ORDER',
          referenceId: order.id,
          reason: `Venda Confirmada Pedido #${order.id.slice(0, 8)}`,
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
   * Handle order cancellation: return stock or release reservation safely
   */
  async handleOrderCancelled(orderId: string, txClient?: any) {
    const prisma = txClient || this.prisma;

    // 1. Se o pedido tinha reserva não confirmada, libera a reserva (reduz reservedQuantity)
    const reservations = await prisma.stockMovement.findMany({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.RESERVATION,
      },
    });

    const outMovements = await prisma.stockMovement.findMany({
      where: {
        referenceType: 'ORDER',
        referenceId: orderId,
        type: StockMovementType.OUT,
      },
    });

    if (reservations.length > 0 && outMovements.length === 0) {
      await this.releaseStockForOrder(orderId, prisma);
      return;
    }

    // 2. Se o pedido já havia sido confirmado (teve OUT), faz a devolução física (IN)
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
