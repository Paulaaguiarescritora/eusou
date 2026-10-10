import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentMethod, PaymentStatus, OrderStatus, Payment } from '@prisma/client';
import {
  PaymentProvider,
  CreatePaymentProviderInput,
} from './payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { CreatePaymentDto, RefundPaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private provider: PaymentProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly affiliateService: AffiliateService,
    private readonly inventoryService: InventoryService,
    private readonly configService: ConfigService,
  ) {
    this.initProvider();
  }

  private initProvider() {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    const publicKey = this.configService.get<string>('MERCADOPAGO_PUBLIC_KEY');
    const webhookSecret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET');
    const environment = (this.configService.get<string>('MERCADOPAGO_ENVIRONMENT') || 'TEST') as 'TEST' | 'PRODUCTION';

    if (accessToken && accessToken.trim()) {
      this.logger.log(`Initializing MercadoPagoProvider in ${environment} mode`);
      this.provider = new MercadoPagoProvider({
        accessToken: accessToken.trim(),
        publicKey: publicKey?.trim(),
        webhookSecret: webhookSecret?.trim(),
        environment,
      });
    } else {
      if (nodeEnv === 'production') {
        this.logger.error(
          'CRITICAL: Production environment detected without MERCADOPAGO_ACCESS_TOKEN. Mock provider fallback is strictly disallowed in production.',
        );
        // In production without MP credentials, fail safely
        this.provider = {
          providerName: 'UNCONFIGURED_PRODUCTION_GATEWAY',
          createPayment: async () => {
            throw new InternalServerErrorException(
              'Gateway de pagamento não configurado em ambiente de produção.',
            );
          },
          getPayment: async () => {
            throw new InternalServerErrorException(
              'Gateway de pagamento não configurado em ambiente de produção.',
            );
          },
          cancelPayment: async () => {
            throw new InternalServerErrorException(
              'Gateway de pagamento não configurado em ambiente de produção.',
            );
          },
          refundPayment: async () => {
            throw new InternalServerErrorException(
              'Gateway de pagamento não configurado em ambiente de produção.',
            );
          },
          parseWebhook: () => ({ isValid: false, rawPayload: null }),
          verifyWebhook: () => false,
          mapStatus: () => PaymentStatus.FAILED,
        };
      } else {
        this.logger.warn(
          'MERCADOPAGO_ACCESS_TOKEN not found. Using MockPaymentProvider for development/test environment.',
        );
        this.provider = new MockPaymentProvider();
      }
    }
  }

  getProviderName(): string {
    return this.provider.providerName;
  }

  /**
   * Create payment for order with backend amount verification and double-click idempotency
   */
  async processPayment(dto: CreatePaymentDto): Promise<Payment> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order "${dto.orderId}" not found`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for a cancelled order');
    }

    // Layer 1 validation: Strict backend amount recalculation
    const expectedTotal = Number(order.total);
    if (Math.abs(expectedTotal - Number(dto.amount)) > 0.01) {
      throw new BadRequestException(
        `Invalid payment amount: received ${dto.amount}, but order total is ${expectedTotal}`,
      );
    }

    // Double-click Idempotency Check (Layer 1)
    const idempotencyKey = dto.idempotencyKey || `idem_${order.id}_${Date.now()}`;
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { idempotencyKey },
          {
            orderId: order.id,
            status: { in: [PaymentStatus.PAID, PaymentStatus.PROCESSING, PaymentStatus.PENDING] },
          },
        ],
      },
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.PAID) {
        return existingPayment;
      }
      // If pending PIX or processing credit card within expiration, return existing
      if (
        existingPayment.status === PaymentStatus.PENDING ||
        existingPayment.status === PaymentStatus.PROCESSING
      ) {
        return existingPayment;
      }
    }

    // Call Gateway Provider
    const providerInput: CreatePaymentProviderInput = {
      orderId: order.id,
      amount: expectedTotal,
      currency: 'BRL',
      method: dto.method,
      idempotencyKey,
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        documentNumber: dto.documentNumber,
        documentType: dto.documentType,
      },
      cardToken: dto.cardToken,
      installments: dto.installments,
      paymentMethodId: dto.paymentMethodId,
      issuerId: dto.issuerId,
    };

    const providerResult = await this.provider.createPayment(providerInput);

    // Save payment entity
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: providerResult.provider,
        providerPaymentId: providerResult.providerPaymentId || null,
        providerOrderId: providerResult.providerOrderId || null,
        method: dto.method,
        status: providerResult.status,
        amount: expectedTotal.toFixed(2),
        currency: providerResult.currency || 'BRL',
        paidAt: providerResult.paidAt || null,
        expiresAt: providerResult.expiresAt || null,
        failureCode: providerResult.failureCode || null,
        failureMessage: providerResult.failureMessage || null,
        externalStatus: providerResult.externalStatus || null,
        externalStatusDetail: providerResult.externalStatusDetail || null,
        idempotencyKey,
        pixQrCode: providerResult.pixQrCode || null,
        pixQrCodeBase64: providerResult.pixQrCodeBase64 || null,
        metadata: providerResult.rawResponse || undefined,
      },
    });

    await this.auditLog.log({
      action: 'PAYMENT_CREATED',
      entity: 'Payment',
      entityId: payment.id,
      metadata: {
        orderId: order.id,
        method: payment.method,
        status: payment.status,
        provider: payment.provider,
        amount: payment.amount,
      },
    });

    // If payment confirmed immediately (e.g. Credit Card approved or MockProvider)
    if (payment.status === PaymentStatus.PAID) {
      await this.handlePaymentSuccess(payment, order);
    }

    return payment;
  }

  /**
   * Handle Webhook notifications from Mercado Pago
   */
  async handleWebhook(
    headers: Record<string, any>,
    query: Record<string, any>,
    body: any,
  ): Promise<{ status: string; message: string }> {
    const isVerified = this.provider.verifyWebhook(headers, query, body);
    if (!isVerified) {
      await this.auditLog.log({
        action: 'PAYMENT_WEBHOOK_FAILED',
        entity: 'PaymentWebhook',
        metadata: { reason: 'Invalid signature', headers, query },
      });
      throw new BadRequestException('Invalid webhook signature');
    }

    const parsed = this.provider.parseWebhook(headers, query, body);

    await this.auditLog.log({
      action: 'PAYMENT_WEBHOOK_RECEIVED',
      entity: 'PaymentWebhook',
      metadata: {
        eventId: parsed.eventId,
        topic: parsed.topic,
        providerPaymentId: parsed.providerPaymentId,
      },
    });

    if (!parsed.providerPaymentId) {
      return { status: 'IGNORED', message: 'No payment id in webhook notification' };
    }

    // Retrieve state from official gateway
    const externalPayment = await this.provider.getPayment(parsed.providerPaymentId);
    if (!externalPayment.success) {
      await this.auditLog.log({
        action: 'PAYMENT_WEBHOOK_IGNORED',
        entity: 'PaymentWebhook',
        metadata: {
          providerPaymentId: parsed.providerPaymentId,
          reason: 'External payment lookup returned failure',
        },
      });
      return { status: 'IGNORED', message: 'Payment lookup failed' };
    }

    // Find internal payment
    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: parsed.providerPaymentId },
      include: { order: true },
    });

    if (!payment) {
      return { status: 'IGNORED', message: 'Internal payment not found' };
    }

    // Idempotency: If already in target status, ignore duplicate webhook
    if (payment.status === externalPayment.status) {
      await this.auditLog.log({
        action: 'PAYMENT_WEBHOOK_IGNORED',
        entity: 'Payment',
        entityId: payment.id,
        metadata: {
          reason: 'Duplicate webhook with same status',
          status: payment.status,
          providerPaymentId: parsed.providerPaymentId,
        },
      });
      return { status: 'IGNORED', message: 'Duplicate webhook already processed' };
    }

    // Update payment record
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: externalPayment.status,
        externalStatus: externalPayment.externalStatus || null,
        externalStatusDetail: externalPayment.externalStatusDetail || null,
        paidAt: externalPayment.paidAt || (externalPayment.status === PaymentStatus.PAID ? new Date() : null),
      },
    });

    await this.auditLog.log({
      action: 'PAYMENT_WEBHOOK_PROCESSED',
      entity: 'Payment',
      entityId: payment.id,
      metadata: {
        oldStatus: payment.status,
        newStatus: updatedPayment.status,
        providerPaymentId: parsed.providerPaymentId,
      },
    });

    // Handle state transitions
    if (updatedPayment.status === PaymentStatus.PAID) {
      await this.handlePaymentSuccess(updatedPayment, payment.order);
    } else if (
      updatedPayment.status === PaymentStatus.CANCELLED ||
      updatedPayment.status === PaymentStatus.EXPIRED ||
      updatedPayment.status === PaymentStatus.FAILED
    ) {
      await this.handlePaymentFailed(updatedPayment, payment.order);
    }

    return { status: 'PROCESSED', message: 'Payment status updated' };
  }

  /**
   * Payment confirmed: Payment PAID -> Order CONFIRMED -> F7 stock deduct -> F6 affiliate
   */
  private async handlePaymentSuccess(payment: Payment, order: any) {
    if (order.status !== OrderStatus.CONFIRMED) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED },
      });

      await this.auditLog.log({
        action: 'PAYMENT_PAID',
        entity: 'Payment',
        entityId: payment.id,
        metadata: { orderId: order.id, amount: payment.amount },
      });

      // Deduct stock idempotently
      await this.inventoryService.handleOrderConfirmed(order.id);

      // Affiliate conversion update
      await this.affiliateService.handleOrderStatusChanged(order.id, OrderStatus.CONFIRMED);
    }
  }

  private async handlePaymentFailed(payment: Payment, order: any) {
    if (order.status === OrderStatus.PENDING) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      await this.auditLog.log({
        action: 'PAYMENT_FAILED',
        entity: 'Payment',
        entityId: payment.id,
        metadata: {
          orderId: order.id,
          failureCode: payment.failureCode,
          failureMessage: payment.failureMessage,
        },
      });

      await this.affiliateService.handleOrderStatusChanged(order.id, OrderStatus.CANCELLED);
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(paymentId: string, actorId?: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment "${paymentId}" not found`);
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException(
        'Cannot cancel an already PAID payment. Use refund instead.',
      );
    }

    if (payment.providerPaymentId) {
      await this.provider.cancelPayment(payment.providerPaymentId);
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.CANCELLED },
    });

    await this.auditLog.log({
      action: 'PAYMENT_CANCELLED',
      entity: 'Payment',
      entityId: paymentId,
      userId: actorId || null,
      metadata: { orderId: payment.orderId },
    });

    return updated;
  }

  /**
   * Refund payment (Admin only)
   */
  async refundPayment(
    paymentId: string,
    dto: RefundPaymentDto,
    actorId?: string,
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment "${paymentId}" not found`);
    }

    if (payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new BadRequestException('Only PAID payments can be refunded');
    }

    const currentAmount = Number(payment.amount);
    if (dto.amount && dto.amount > currentAmount) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    if (payment.providerPaymentId) {
      const refundResult = await this.provider.refundPayment(
        payment.providerPaymentId,
        dto.amount,
      );
      if (!refundResult.success) {
        throw new BadRequestException(
          refundResult.failureMessage || 'Gateway rejected refund request',
        );
      }
    }

    const nextStatus =
      dto.amount && dto.amount < currentAmount
        ? PaymentStatus.PARTIALLY_REFUNDED
        : PaymentStatus.REFUNDED;

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: nextStatus },
    });

    await this.auditLog.log({
      action: 'PAYMENT_REFUNDED',
      entity: 'Payment',
      entityId: paymentId,
      userId: actorId || null,
      metadata: {
        orderId: payment.orderId,
        refundedAmount: dto.amount || currentAmount,
        reason: dto.reason,
      },
    });

    // If full refund, cancel order and revert stock
    if (nextStatus === PaymentStatus.REFUNDED) {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await this.inventoryService.handleOrderCancelled(payment.orderId);
      await this.affiliateService.handleOrderStatusChanged(payment.orderId, OrderStatus.CANCELLED);
    }

    return updated;
  }

  /**
   * Find payment by ID
   */
  async findById(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment "${id}" not found`);
    }

    return payment;
  }

  /**
   * Find payment by Order ID
   */
  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin list payments
   */
  async findAll(query: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    orderId?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.orderId) where.orderId = query.orderId;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              customerName: true,
              customerEmail: true,
              total: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
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
}
