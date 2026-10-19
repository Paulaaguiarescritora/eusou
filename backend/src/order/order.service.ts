import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { Order, OrderStatus } from '@prisma/client';
import { AffiliateService } from '../affiliate/affiliate.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly affiliateService: AffiliateService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // 1. Resolve canal de origem comercial
    let resolvedChannelId = dto.channelId || null;
    if (!resolvedChannelId) {
      const ownStoreChannel = await this.prisma.channel.findFirst({
        where: { type: 'OWN_STORE', isActive: true },
      });
      resolvedChannelId = ownStoreChannel?.id || null;
    }

    let calculatedSubtotal = 0;
    const orderItemsData: any[] = [];

    // Validate products, variants and calculate snapshot prices securely on backend
    for (const item of dto.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero');
      }

      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product "${item.productId}" not found`);
      }
      if (product.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Product "${product.name}" is not active`,
        );
      }

      // P1: Verifica disponibilidade comercial no canal (ProductChannel)
      if (resolvedChannelId) {
        const pc = await this.prisma.productChannel.findUnique({
          where: {
            productId_channelId: {
              productId: product.id,
              channelId: resolvedChannelId,
            },
          },
        });
        if (!pc || !pc.isEnabled) {
          throw new BadRequestException(
            `O produto "${product.name}" não está disponível para venda neste canal comercial.`,
          );
        }
      }

      let unitPrice = 0;
      let skuSnapshot = product.sku;
      let finalProductNameSnapshot = product.name;


      if (item.variantId) {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
        });
        if (!variant || variant.productId !== item.productId) {
          throw new NotFoundException(
            `Variant "${item.variantId}" not found for product "${product.name}"`,
          );
        }
        if (!variant.isActive) {
          throw new BadRequestException(
            `Variant "${variant.sku || variant.id}" is inactive`,
          );
        }
        if (variant.sku) {
          skuSnapshot = variant.sku;
        }
        if (variant.name && variant.name.trim()) {
          finalProductNameSnapshot = `${product.name} - ${variant.name.trim()}`;
        }
      }

      // Validação rigorosa de estoque por variante / produto (P0)
      const activeVariants = await this.prisma.productVariant.findMany({
        where: { productId: product.id, isActive: true },
      });
      const hasActiveVariants = activeVariants.length > 0;

      if (hasActiveVariants) {
        // Regra homologada: produto com variantes NÃO usa estoque do produto-pai
        if (!item.variantId) {
          throw new BadRequestException(
            `O produto "${product.name}" possui variantes. É obrigatório selecionar uma variante válida.`,
          );
        }

        const matchingVariant = activeVariants.find((v) => v.id === item.variantId);
        if (!matchingVariant) {
          throw new BadRequestException(
            `Variante selecionada inválida ou inativa para o produto "${product.name}".`,
          );
        }

        const inv = await this.prisma.inventory.findFirst({
          where: {
            productId: product.id,
            variantId: item.variantId,
          },
        });
        const availableStock = inv ? Math.max(0, inv.quantity - inv.reservedQuantity) : 0;

        if (availableStock <= 0) {
          throw new BadRequestException(
            `Esta variante está esgotada: "${finalProductNameSnapshot}".`,
          );
        }

        if (item.quantity > availableStock) {
          throw new BadRequestException(
            `Quantidade solicitada indisponível em estoque para a variante "${finalProductNameSnapshot}".`,
          );
        }
      } else {
        // Produto sem variantes: validação pelo estoque-pai (variantId: null)
        const inv = await this.prisma.inventory.findFirst({
          where: {
            productId: product.id,
            variantId: null,
          },
        });
        const availableStock = inv ? Math.max(0, inv.quantity - inv.reservedQuantity) : 0;

        if (availableStock <= 0) {
          throw new BadRequestException(
            `O produto "${product.name}" está esgotado.`,
          );
        }

        if (item.quantity > availableStock) {
          throw new BadRequestException(
            `Quantidade solicitada indisponível em estoque para o produto "${product.name}".`,
          );
        }
      }

      // Consulta obrigatória de preço comercial em ProductChannelPrice para o canal da operação
      if (resolvedChannelId) {
        let pcp = dto.nicheId
          ? await this.prisma.productChannelPrice.findFirst({
              where: {
                productId: product.id,
                channelId: resolvedChannelId,
                variantId: item.variantId || null,
                nicheId: dto.nicheId,
              },
            })
          : null;

        if (!pcp) {
          pcp = await this.prisma.productChannelPrice.findFirst({
            where: {
              productId: product.id,
              channelId: resolvedChannelId,
              variantId: item.variantId || null,
              nicheId: null,
            },
          });
        }

        if (pcp) {
          const effective =
            pcp.mode === 'MANUAL' && pcp.manualPrice !== null
              ? pcp.manualPrice
              : pcp.effectivePrice || pcp.calculatedPrice;
          if (effective !== null && effective !== undefined && Number(effective) > 0) {
            unitPrice = Number(effective);
          }
        } else if (item.variantId) {
          // Fallback para o preço do produto no canal caso a variante não tenha preço isolado
          let basePcp = dto.nicheId
            ? await this.prisma.productChannelPrice.findFirst({
                where: {
                  productId: product.id,
                  channelId: resolvedChannelId,
                  variantId: null,
                  nicheId: dto.nicheId,
                },
              })
            : null;

          if (!basePcp) {
            basePcp = await this.prisma.productChannelPrice.findFirst({
              where: {
                productId: product.id,
                channelId: resolvedChannelId,
                variantId: null,
                nicheId: null,
              },
            });
          }

          if (basePcp) {
            const effective =
              basePcp.mode === 'MANUAL' && basePcp.manualPrice !== null
                ? basePcp.manualPrice
                : basePcp.effectivePrice || basePcp.calculatedPrice;
            if (effective !== null && effective !== undefined && Number(effective) > 0) {
              unitPrice = Number(effective);
            }
          }
        }
      }

      // Regra oficial: Se não houver ProductChannelPrice válido no canal, a venda deve ser impedida
      if (!unitPrice || unitPrice <= 0) {
        throw new BadRequestException(
          `Produto indisponível para venda: preço não configurado no canal para "${finalProductNameSnapshot}".`,
        );
      }

      const itemSubtotal = unitPrice * item.quantity;
      calculatedSubtotal += itemSubtotal;

      orderItemsData.push({
        productId: product.id,
        variantId: item.variantId || null,
        productNameSnapshot: finalProductNameSnapshot,
        skuSnapshot: skuSnapshot || null,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        subtotal: itemSubtotal.toFixed(2),
      });
    }

    const shippingAmount = 0.0; // Shipping calculation not mocked with arbitrary numbers
    const calculatedTotal = calculatedSubtotal + shippingAmount;

    // P0: Prazo de Pagamento rigoroso de 24 horas
    const now = new Date();
    const paymentDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Persist order e reserva de estoque atomicamente dentro de uma transação Prisma
    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          customerName: dto.customerName.trim(),
          customerEmail: dto.customerEmail.trim().toLowerCase(),
          customerPhone: dto.customerPhone.trim(),
          street: dto.street.trim(),
          number: dto.number.trim(),
          complement: dto.complement?.trim() || null,
          neighborhood: dto.neighborhood.trim(),
          city: dto.city.trim(),
          state: dto.state.trim().toUpperCase(),
          zipCode: dto.zipCode.trim(),
          subtotal: calculatedSubtotal.toFixed(2),
          shippingAmount: shippingAmount.toFixed(2),
          total: calculatedTotal.toFixed(2),
          status: OrderStatus.PENDING,
          paymentDeadline,
          affiliateCode: dto.affiliateCode?.trim() || null,
          nicheId: dto.nicheId || null,
          channelId: resolvedChannelId,
          originDomain: dto.originDomain?.trim() || null,
          utmSource: dto.utmSource?.trim() || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      // P0: Reserva imediata do estoque com proteção contra race conditions
      await this.inventoryService.reserveStockForOrder(
        createdOrder.id,
        orderItemsData,
        tx,
      );

      return createdOrder;
    });

    // Process affiliate conversion if order was created with referral code
    if (dto.affiliateCode?.trim()) {
      await this.affiliateService.handleOrderCreated(
        order.id,
        dto.affiliateCode.trim(),
      );
    }

    await this.auditLog.log({
      action: 'ORDER_CREATED',
      entity: 'Order',
      entityId: order.id,
      metadata: {
        customerEmail: order.customerEmail,
        total: order.total,
        itemCount: orderItemsData.length,
        paymentDeadline: order.paymentDeadline,
        affiliateCode: dto.affiliateCode || null,
        nicheId: order.nicheId || null,
        channelId: order.channelId || null,
        originDomain: order.originDomain || null,
        utmSource: order.utmSource || null,
      },
    });

    return order;
  }

  async findById(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                media: { orderBy: { sortOrder: 'asc' }, take: 1 },
              },
            },
            variant: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }

    return order;
  }

  async findAll(query: QueryOrdersDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search?.trim()) {
      where.OR = [
        {
          customerName: { contains: query.search.trim(), mode: 'insensitive' },
        },
        {
          customerEmail: { contains: query.search.trim(), mode: 'insensitive' },
        },
        { id: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true } },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where }),
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

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    actorId?: string,
  ): Promise<Order> {
    const order = await this.findById(id);

    // Validate valid status transitions
    const invalidTransitions: Record<OrderStatus, OrderStatus[]> = {
      CANCELLED: [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ],
      DELIVERED: [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
      ],
      SHIPPED: [OrderStatus.PENDING, OrderStatus.CONFIRMED],
      PROCESSING: [OrderStatus.PENDING],
      CONFIRMED: [],
      PENDING: [],
    };

    if (invalidTransitions[order.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from status "${order.status}" to "${dto.status}"`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditLog.log({
      action:
        dto.status === OrderStatus.CANCELLED
          ? 'ORDER_CANCELLED'
          : 'ORDER_STATUS_CHANGED',
      entity: 'Order',
      entityId: id,
      userId: actorId ?? null,
      metadata: {
        oldStatus: order.status,
        newStatus: dto.status,
      },
    });

    // Synchronize status with affiliate conversion
    await this.affiliateService.handleOrderStatusChanged(id, dto.status);

    // F7: Synchronize stock on transition
    if (
      dto.status === OrderStatus.CONFIRMED &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      await this.inventoryService.handleOrderConfirmed(id);
    } else if (dto.status === OrderStatus.CANCELLED) {
      await this.inventoryService.handleOrderCancelled(id);
    }

    return updated;
  }

  /**
   * P0: Expiração de pedidos PENDING com mais de 24 horas sem pagamento confirmado.
   * Libera reserva de estoque de forma estritamente idempotente.
   */
  async expireUnpaidOrders(actorId?: string): Promise<{ expiredCount: number; orderIds: string[] }> {
    const now = new Date();
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        paymentDeadline: {
          lt: now,
        },
      },
      include: { items: true },
    });

    const expiredIds: string[] = [];

    for (const order of expiredOrders) {
      let wasCancelled = false;

      await this.prisma.$transaction(async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true },
        });

        // Concorrência segura: se outra instância já alterou o status, não processa
        if (current?.status !== OrderStatus.PENDING) {
          return;
        }

        // Atualiza status para CANCELLED
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED },
        });

        // Libera reserva de forma idempotente (reduz reservedQuantity sem alterar quantity)
        await this.inventoryService.releaseStockForOrder(order.id, tx);
        wasCancelled = true;
      });

      if (!wasCancelled) {
        continue;
      }

      await this.auditLog.log({
        action: 'ORDER_EXPIRED_24H',
        entity: 'Order',
        entityId: order.id,
        userId: actorId ?? null,
        metadata: {
          orderId: order.id,
          paymentDeadline: order.paymentDeadline,
          reason: 'Expirado por ausência de pagamento no prazo de 24 horas',
        },
      });

      await this.affiliateService.handleOrderStatusChanged(order.id, OrderStatus.CANCELLED);
      expiredIds.push(order.id);
    }

    return {
      expiredCount: expiredIds.length,
      orderIds: expiredIds,
    };
  }
}
