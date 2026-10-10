import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';

describe('PaymentService & MercadoPagoProvider (F16-A)', () => {
  let service: PaymentService;
  let prisma: any;
  let auditLog: any;
  let affiliateService: any;
  let inventoryService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    affiliateService = { handleOrderStatusChanged: jest.fn().mockResolvedValue(undefined) };
    inventoryService = {
      handleOrderConfirmed: jest.fn().mockResolvedValue(undefined),
      handleOrderCancelled: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined; // Development defaults to MockPaymentProvider
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: AffiliateService, useValue: affiliateService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('1. Baseline Provider Initialization & Safe Production Fallback', () => {
    it('should initialize with MockPaymentProvider in development when MERCADOPAGO_ACCESS_TOKEN is absent', () => {
      expect(service.getProviderName()).toBe('MOCK_DEMO_PROVIDER');
    });

    it('CRITICAL TEST: in NODE_ENV=production without MERCADOPAGO_ACCESS_TOKEN, mock must NOT be used and requests must fail securely', async () => {
      const prodConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'NODE_ENV') return 'production';
          return undefined; // no MP credentials
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          { provide: PrismaService, useValue: prisma },
          { provide: AuditLogService, useValue: auditLog },
          { provide: AffiliateService, useValue: affiliateService },
          { provide: InventoryService, useValue: inventoryService },
          { provide: ConfigService, useValue: prodConfigService },
        ],
      }).compile();

      const prodService = module.get<PaymentService>(PaymentService);
      expect(prodService.getProviderName()).toBe('UNCONFIGURED_PRODUCTION_GATEWAY');

      prisma.order.findUnique.mockResolvedValue({
        id: 'order-prod-1',
        total: '150.00',
        status: OrderStatus.PENDING,
        customerName: 'Cliente',
        customerEmail: 'cliente@teste.com',
        customerPhone: '11999999999',
      });

      await expect(
        prodService.processPayment({
          orderId: 'order-prod-1',
          method: PaymentMethod.PIX,
          amount: 150.0,
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('2. Financial Calculations & Backend Total Security (CRITICAL TEST 38)', () => {
    it('CRITICAL TEST: should reject payment if amount sent by frontend differs from backend order total', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        total: '199.90',
        status: OrderStatus.PENDING,
      });

      await expect(
        service.processPayment({
          orderId: 'order-1',
          method: PaymentMethod.PIX,
          amount: 10.0, // Fraudulent frontend amount
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Double-Click & Layer 1 Idempotency (CRITICAL TEST 36)', () => {
    it('CRITICAL TEST: two rapid payment attempts for the same order must return existing payment and avoid duplicate charges', async () => {
      const mockOrder = {
        id: 'order-double-click',
        total: '89.90',
        status: OrderStatus.PENDING,
        customerName: 'Carlos Teste',
        customerEmail: 'carlos@teste.com',
        customerPhone: '11988887777',
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const existingPaidPayment = {
        id: 'pay-existing-1',
        orderId: 'order-double-click',
        status: PaymentStatus.PAID,
        amount: '89.90',
        method: PaymentMethod.CREDIT_CARD,
      };

      // Simulate first payment already recorded or currently processing
      prisma.payment.findFirst.mockResolvedValue(existingPaidPayment);

      const result = await service.processPayment({
        orderId: 'order-double-click',
        method: PaymentMethod.CREDIT_CARD,
        amount: 89.90,
        idempotencyKey: 'idem-click-123',
      });

      expect(result.id).toBe('pay-existing-1');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('4. Pix Flow & QR Code Generation', () => {
    it('should process Pix and return QR Code and Copia e Cola payload', async () => {
      const mockOrder = {
        id: 'order-pix-1',
        total: '120.00',
        status: OrderStatus.PENDING,
        customerName: 'Maria Silva',
        customerEmail: 'maria@teste.com',
        customerPhone: '11977776666',
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.payment.findFirst.mockResolvedValue(null);

      const createdPayment = {
        id: 'pay-pix-1',
        orderId: 'order-pix-1',
        provider: 'MOCK_DEMO_PROVIDER',
        method: PaymentMethod.PIX,
        status: PaymentStatus.PAID,
        amount: '120.00',
        pixQrCode: '00020126580014br.gov.bcb.pix...',
      };
      prisma.payment.create.mockResolvedValue(createdPayment);

      const result = await service.processPayment({
        orderId: 'order-pix-1',
        method: PaymentMethod.PIX,
        amount: 120.0,
      });

      expect(result.method).toBe(PaymentMethod.PIX);
      expect(result.pixQrCode).toBeDefined();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_CREATED' }),
      );
    });
  });

  describe('5. Webhook Handling & Deduplication (CRITICAL TEST 37)', () => {
    it('CRITICAL TEST: processing the same webhook 3 times must update payment, order and inventory ONCE only', async () => {
      const mockPayment = {
        id: 'pay-web-1',
        orderId: 'order-web-1',
        providerPaymentId: 'mp_pay_9999',
        status: PaymentStatus.PENDING,
        order: { id: 'order-web-1', status: OrderStatus.PENDING },
      };

      // Mock gateway lookup returning approved
      jest.spyOn((service as any).provider, 'getPayment').mockResolvedValue({
        success: true,
        status: PaymentStatus.PAID,
        providerPaymentId: 'mp_pay_9999',
        paidAt: new Date(),
      });

      // First run: status is PENDING, transitions to PAID
      prisma.payment.findFirst.mockResolvedValueOnce(mockPayment);
      prisma.payment.update.mockResolvedValueOnce({
        ...mockPayment,
        status: PaymentStatus.PAID,
      });

      const res1 = await service.handleWebhook(
        {},
        { 'data.id': 'mp_pay_9999' },
        { action: 'payment.updated', data: { id: 'mp_pay_9999' } },
      );
      expect(res1.status).toBe('PROCESSED');
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledTimes(1);

      // Second run: payment in DB is already PAID
      const alreadyPaidPayment = {
        ...mockPayment,
        status: PaymentStatus.PAID,
      };
      prisma.payment.findFirst.mockResolvedValueOnce(alreadyPaidPayment);

      const res2 = await service.handleWebhook(
        {},
        { 'data.id': 'mp_pay_9999' },
        { action: 'payment.updated', data: { id: 'mp_pay_9999' } },
      );
      expect(res2.status).toBe('IGNORED');

      // Third run: still already PAID
      prisma.payment.findFirst.mockResolvedValueOnce(alreadyPaidPayment);

      const res3 = await service.handleWebhook(
        {},
        { 'data.id': 'mp_pay_9999' },
        { action: 'payment.updated', data: { id: 'mp_pay_9999' } },
      );
      expect(res3.status).toBe('IGNORED');

      // Total stock deduction remains 1
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. Refund Flow & Stock Restoration', () => {
    it('should refund a PAID payment and cancel order and revert stock for full refund', async () => {
      const mockPaidPayment = {
        id: 'pay-ref-1',
        orderId: 'order-ref-1',
        status: PaymentStatus.PAID,
        amount: '100.00',
        providerPaymentId: 'mock_tx_ref',
        order: { id: 'order-ref-1', status: OrderStatus.CONFIRMED },
      };
      prisma.payment.findUnique.mockResolvedValue(mockPaidPayment);
      prisma.payment.update.mockResolvedValue({
        ...mockPaidPayment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await service.refundPayment('pay-ref-1', { amount: 100.0, reason: 'Customer requested' });
      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(inventoryService.handleOrderCancelled).toHaveBeenCalledWith('order-ref-1');
      expect(affiliateService.handleOrderStatusChanged).toHaveBeenCalledWith('order-ref-1', OrderStatus.CANCELLED);
    });

    it('should prevent refund amount exceeding payment amount', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-ref-2',
        status: PaymentStatus.PAID,
        amount: '50.00',
      });

      await expect(
        service.refundPayment('pay-ref-2', { amount: 150.0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('7. MercadoPagoProvider Status Mapping & Webhook Verification', () => {
    const mpProvider = new MercadoPagoProvider({
      accessToken: 'TEST_TOKEN',
      webhookSecret: 'test_secret_key',
    });

    it('should correctly map official Mercado Pago statuses', () => {
      expect(mpProvider.mapStatus('approved', 'accredited')).toBe(PaymentStatus.PAID);
      expect(mpProvider.mapStatus('approved', 'partially_refunded')).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(mpProvider.mapStatus('authorized')).toBe(PaymentStatus.AUTHORIZED);
      expect(mpProvider.mapStatus('in_process')).toBe(PaymentStatus.PROCESSING);
      expect(mpProvider.mapStatus('pending')).toBe(PaymentStatus.PROCESSING);
      expect(mpProvider.mapStatus('rejected')).toBe(PaymentStatus.FAILED);
      expect(mpProvider.mapStatus('cancelled', 'expired')).toBe(PaymentStatus.EXPIRED);
      expect(mpProvider.mapStatus('cancelled', 'by_collector')).toBe(PaymentStatus.CANCELLED);
      expect(mpProvider.mapStatus('refunded')).toBe(PaymentStatus.REFUNDED);
      expect(mpProvider.mapStatus('charged_back')).toBe(PaymentStatus.FAILED);
    });

    it('should verify valid HMAC-SHA256 signature on x-signature header', () => {
      const secret = 'test_secret_key';
      const crypto = require('crypto');
      const ts = '1728556800';
      const dataId = '123456789';
      const requestId = 'req-abc-xyz';
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      const headers = {
        'x-signature': `ts=${ts},v1=${v1}`,
        'x-request-id': requestId,
      };
      const query = { 'data.id': dataId };

      expect(mpProvider.verifyWebhook(headers, query, {})).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      const headers = {
        'x-signature': 'ts=1728556800,v1=invalid_hash',
        'x-request-id': 'req-1',
      };
      const query = { 'data.id': '123' };

      expect(mpProvider.verifyWebhook(headers, query, {})).toBe(false);
    });
  });
});
