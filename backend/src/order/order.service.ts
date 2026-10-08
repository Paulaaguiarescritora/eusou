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
import {
  MockPaymentProvider,
  PaymentProvider,
} from './payment/payment-provider.interface';
import { AffiliateService } from '../affiliate/affiliate.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrderService {
  private paymentProvider: PaymentProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly affiliateService: AffiliateService,
    private readonly inventoryService: InventoryService,
  ) {
    this.paymentProvider = new MockPaymentProvider();
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
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

      let unitPrice = Number(product.basePrice) || 0;
      let skuSnapshot = product.sku;

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
        if (variant.price !== null && variant.price !== undefined) {
          unitPrice = Number(variant.price);
        }
        if (variant.sku) {
          skuSnapshot = variant.sku;
        }
      }

      const itemSubtotal = unitPrice * item.quantity;
      calculatedSubtotal += itemSubtotal;

      orderItemsData.push({
        productId: product.id,
        variantId: item.variantId || null,
        productNameSnapshot: product.name,
        skuSnapshot: skuSnapshot || null,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        subtotal: itemSubtotal.toFixed(2),
      });
    }

    const shippingAmount = 0.0; // Shipping calculation not mocked with arbitrary numbers
    const calculatedTotal = calculatedSubtotal + shippingAmount;

    // Persist order with historical snapshot data
    const order = await this.prisma.order.create({
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
        status: OrderStatus.CONFIRMED, // Mock payment confirms order
        affiliateCode: dto.affiliateCode?.trim() || null,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
      },
    });

    // Process affiliate conversion if order was created with referral code
    if (dto.affiliateCode?.trim()) {
      await this.affiliateService.handleOrderCreated(
        order.id,
        dto.affiliateCode.trim(),
      );
    }

    // Mock payment simulation
    await this.paymentProvider.createPayment({
      orderId: order.id,
      amount: calculatedTotal,
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
      },
    });

    // F7: Deduct stock on confirmation
    if (order.status === OrderStatus.CONFIRMED) {
      await this.inventoryService.handleOrderConfirmed(order.id);
    }

    await this.auditLog.log({
      action: 'ORDER_CREATED',
      entity: 'Order',
      entityId: order.id,
      metadata: {
        customerEmail: order.customerEmail,
        total: order.total,
        itemCount: orderItemsData.length,
        affiliateCode: dto.affiliateCode || null,
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
}
