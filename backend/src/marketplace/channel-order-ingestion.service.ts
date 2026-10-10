import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { IngestChannelOrderDto } from './dto/marketplace.dto';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class ChannelOrderIngestionService {
  private readonly logger = new Logger(ChannelOrderIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Ingere pedido vindo de marketplace externo:
   * 1. Verifica duplicidade de externalOrderId (Idempotência).
   * 2. Cria registro no modelo Order (F5) interno.
   * 3. Registra os OrderItems associados aos produtos internos correspondentes.
   * 4. Abate estoque do inventário (F7) de forma consistente.
   * 5. Cria vínculo 1:1 ChannelOrder.
   * 6. Registra AuditLog da operação.
   */
  async ingestOrder(dto: IngestChannelOrderDto, userId?: string) {
    // 1. Idempotência por [channelId, externalOrderId]
    const existingChannelOrder = await this.prisma.channelOrder.findUnique({
      where: {
        channelId_externalOrderId: {
          channelId: dto.channelId,
          externalOrderId: dto.externalOrderId,
        },
      },
      include: {
        order: {
          include: { items: true },
        },
      },
    });

    if (existingChannelOrder) {
      this.logger.log(
        `Pedido de marketplace ${dto.externalOrderId} já ingerido anteriormente (ID interno: ${existingChannelOrder.orderId}). Atualizando status.`,
      );

      // Atualiza status se mudou
      const updatedChannelOrder = await this.prisma.channelOrder.update({
        where: { id: existingChannelOrder.id },
        data: {
          externalStatus: dto.externalStatus,
          rawPayload: (dto.rawPayload !== undefined ? dto.rawPayload : existingChannelOrder.rawPayload) as any,
          syncedAt: new Date(),
        },
        include: {
          order: {
            include: { items: true },
          },
        },
      });

      return {
        alreadyExists: true,
        channelOrder: updatedChannelOrder,
      };
    }

    // 2. Valida canal e conta
    const channel = await this.prisma.channel.findUnique({
      where: { id: dto.channelId },
    });
    if (!channel) {
      throw new NotFoundException(`Canal ${dto.channelId} não encontrado.`);
    }

    const account = await this.prisma.channelAccount.findUnique({
      where: { id: dto.channelAccountId },
    });
    if (!account) {
      throw new NotFoundException(
        `Conta de canal ${dto.channelAccountId} não encontrada.`,
      );
    }

    // 3. Monta dados do cliente (com fallback caso o canal mascare dados)
    const customerName = dto.customer?.name || `Comprador ${channel.name} #${dto.externalOrderId}`;
    const customerEmail =
      dto.customer?.email || `marketplace-${dto.externalOrderId.toLowerCase()}@eusou.com.br`;
    const customerPhone = dto.customer?.phone || '00000000000';
    const street = dto.customer?.street || 'Canal Integrado';
    const number = dto.customer?.number || 'S/N';
    const complement = dto.customer?.complement || null;
    const neighborhood = dto.customer?.neighborhood || 'Centro';
    const city = dto.customer?.city || 'São Paulo';
    const state = dto.customer?.state || 'SP';
    const zipCode = dto.customer?.zipCode || '01001-000';

    // 4. Mapeia itens e produtos internos
    const rawItems = dto.items || [];
    const orderItemsData: Array<{
      productId: string;
      variantId?: string | null;
      productNameSnapshot: string;
      skuSnapshot?: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }> = [];

    for (const item of rawItems) {
      let resolvedProduct = null;

      if (item.productId) {
        resolvedProduct = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });
      } else if (item.sku) {
        resolvedProduct = await this.prisma.product.findUnique({
          where: { sku: item.sku },
        });
      } else if (item.externalItemId) {
        // Tenta achar pelo ChannelProduct
        const cp = await this.prisma.channelProduct.findFirst({
          where: {
            channelAccountId: dto.channelAccountId,
            externalProductId: item.externalItemId,
          },
          include: { product: true },
        });
        if (cp) {
          resolvedProduct = cp.product;
        }
      }

      if (!resolvedProduct) {
        // Fallback: busca qualquer produto ativo ou cria snapshot com o primeiro disponível
        const fallbackProd = await this.prisma.product.findFirst({
          where: { status: 'ACTIVE' },
        });
        if (!fallbackProd) {
          throw new BadRequestException(
            `Nenhum produto cadastrado no EuSou para associar ao item "${item.title || item.sku || 'Item'}".`,
          );
        }
        resolvedProduct = fallbackProd;
      }

      orderItemsData.push({
        productId: resolvedProduct.id,
        variantId: null,
        productNameSnapshot: item.title || resolvedProduct.name,
        skuSnapshot: item.sku || resolvedProduct.sku,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
      });
    }

    // Se nenhum item foi passado pelo webhook/payload, cria ao menos 1 item proporcional
    if (orderItemsData.length === 0) {
      const fallbackProd = await this.prisma.product.findFirst();
      if (!fallbackProd) {
        throw new BadRequestException('Nenhum produto encontrado para compor o pedido.');
      }
      orderItemsData.push({
        productId: fallbackProd.id,
        variantId: null,
        productNameSnapshot: `Pedido ${channel.name} #${dto.externalOrderId}`,
        skuSnapshot: fallbackProd.sku,
        quantity: 1,
        unitPrice: new Prisma.Decimal(dto.externalTotal.toFixed(2)),
      });
    }

    // Calcula totais
    const subtotal = orderItemsData.reduce(
      (sum, it) => sum.add(it.unitPrice.mul(it.quantity)),
      new Prisma.Decimal(0),
    );
    const shippingAmount = new Prisma.Decimal((dto.shippingFee || 0).toFixed(2));
    const total = new Prisma.Decimal(dto.externalTotal.toFixed(2));

    // Determina status interno correspondente
    let orderStatus: OrderStatus = OrderStatus.CONFIRMED;
    const extStatusUpper = dto.externalStatus.toUpperCase();
    if (extStatusUpper.includes('CANCEL') || extStatusUpper.includes('REJECT')) {
      orderStatus = OrderStatus.CANCELLED;
    } else if (extStatusUpper.includes('DELIVERED')) {
      orderStatus = OrderStatus.DELIVERED;
    } else if (extStatusUpper.includes('SHIPPED')) {
      orderStatus = OrderStatus.SHIPPED;
    } else if (extStatusUpper.includes('PENDING')) {
      orderStatus = OrderStatus.PENDING;
    }

    // 5. Transação atômica: Criação de Order + OrderItems + Abate de Estoque (F7) + ChannelOrder
    const result = await this.prisma.$transaction(async (tx) => {
      // Cria Order F5
      const newOrder = await tx.order.create({
        data: {
          customerName,
          customerEmail,
          customerPhone,
          status: orderStatus,
          subtotal,
          shippingAmount,
          total,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          zipCode,
          items: {
            create: orderItemsData.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              productNameSnapshot: it.productNameSnapshot,
              skuSnapshot: it.skuSnapshot,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              subtotal: it.unitPrice.mul(it.quantity),
            })),
          },
        },
        include: { items: true },
      });

      // Cria vínculo ChannelOrder
      const createdChannelOrder = await tx.channelOrder.create({
        data: {
          channelId: dto.channelId,
          channelAccountId: dto.channelAccountId,
          orderId: newOrder.id,
          externalOrderId: dto.externalOrderId,
          externalBuyerId: dto.customer?.name || dto.externalBuyerId,
          externalStatus: dto.externalStatus,
          externalTotal: total,
          externalCurrency: dto.externalCurrency || 'BRL',
          commissionFee: dto.commissionFee !== undefined ? new Prisma.Decimal(dto.commissionFee.toFixed(2)) : null,
          shippingFee: shippingAmount,
          rawPayload: dto.rawPayload || undefined,
        },
        include: {
          order: {
            include: { items: true },
          },
          channel: true,
          channelAccount: true,
        },
      });

      // Abate ou reserva estoque no Inventário (F7) caso o pedido não esteja cancelado
      if (orderStatus !== OrderStatus.CANCELLED) {
        for (const it of orderItemsData) {
          const inv = await tx.inventory.findFirst({
            where: { productId: it.productId },
          });

          if (inv) {
            const newQty = Math.max(0, inv.quantity - it.quantity);
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: newQty },
            });

            await tx.stockMovement.create({
              data: {
                productId: it.productId,
                type: 'OUT',
                quantity: it.quantity,
                reason: `Venda ${channel.name} Pedido #${dto.externalOrderId}`,
                referenceId: newOrder.id,
              },
            });
          }
        }
      }

      return createdChannelOrder;
    });

    await this.auditLog.log({
      action: 'CHANNEL_ORDER_INGESTED',
      entity: 'ChannelOrder',
      entityId: result.id,
      userId: userId || null,
      metadata: {
        channelId: dto.channelId,
        externalOrderId: dto.externalOrderId,
        internalOrderId: result.orderId,
        total: total.toString(),
      },
    });

    return {
      alreadyExists: false,
      channelOrder: result,
    };
  }

  /**
   * Consulta ChannelOrder com Order interna associada
   */
  async getChannelOrder(id: string) {
    const co = await this.prisma.channelOrder.findUnique({
      where: { id },
      include: {
        order: {
          include: { items: true },
        },
        channel: true,
        channelAccount: true,
      },
    });
    if (!co) {
      throw new NotFoundException(`ChannelOrder "${id}" não encontrado.`);
    }
    return co;
  }

  /**
   * Lista pedidos de canais
   */
  async listChannelOrders(options?: {
    channelId?: string;
    channelAccountId?: string;
    limit?: number;
  }) {
    return this.prisma.channelOrder.findMany({
      where: {
        channelId: options?.channelId || undefined,
        channelAccountId: options?.channelAccountId || undefined,
      },
      include: {
        order: {
          include: { items: true },
        },
        channel: true,
        channelAccount: true,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });
  }
}
