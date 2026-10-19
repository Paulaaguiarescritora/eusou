import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
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
    affiliateService = {
      handleOrderStatusChanged: jest.fn().mockResolvedValue(undefined),
    };
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
      expect(prodService.getProviderName()).toBe(
        'UNCONFIGURED_PRODUCTION_GATEWAY',
      );

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
        amount: 89.9,
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

      const result = await service.refundPayment('pay-ref-1', {
        amount: 100.0,
        reason: 'Customer requested',
      });
      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(inventoryService.handleOrderCancelled).toHaveBeenCalledWith(
        'order-ref-1',
      );
      expect(affiliateService.handleOrderStatusChanged).toHaveBeenCalledWith(
        'order-ref-1',
        OrderStatus.CANCELLED,
      );
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
      expect(mpProvider.mapStatus('approved', 'accredited')).toBe(
        PaymentStatus.PAID,
      );
      expect(mpProvider.mapStatus('approved', 'partially_refunded')).toBe(
        PaymentStatus.PARTIALLY_REFUNDED,
      );
      expect(mpProvider.mapStatus('authorized')).toBe(PaymentStatus.AUTHORIZED);
      expect(mpProvider.mapStatus('in_process')).toBe(PaymentStatus.PROCESSING);
      expect(mpProvider.mapStatus('pending')).toBe(PaymentStatus.PROCESSING);
      expect(mpProvider.mapStatus('rejected')).toBe(PaymentStatus.FAILED);
      expect(mpProvider.mapStatus('cancelled', 'expired')).toBe(
        PaymentStatus.EXPIRED,
      );
      expect(mpProvider.mapStatus('cancelled', 'by_collector')).toBe(
        PaymentStatus.CANCELLED,
      );
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
      const v1 = crypto
        .createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');

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

  describe('8. Card Tokenization Security & Credit Card Processing (F16-B)', () => {
    it('should process credit card using cardToken without raw card data', async () => {
      const order = {
        id: 'ord-card-1',
        total: 100.0,
        customerName: 'Cliente Teste',
        customerEmail: 'test@example.com',
        customerPhone: '11999999999',
        status: OrderStatus.CONFIRMED,
      };
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.payment.create.mockImplementation(({ data }: any) => ({
        id: 'pay-card-1',
        ...data,
      }));

      const dto = {
        orderId: 'ord-card-1',
        method: PaymentMethod.CREDIT_CARD,
        amount: 100.0,
        cardToken: '9b83b381ec01c7fb880b9687e60124c8',
        installments: 1,
        paymentMethodId: 'visa',
        issuerId: '24',
      };

      // Ensure that DTO has cardToken and does NOT carry raw card details
      expect((dto as any).cardNumber).toBeUndefined();
      expect((dto as any).securityCode).toBeUndefined();
      expect((dto as any).cvv).toBeUndefined();
      expect((dto as any).expiration).toBeUndefined();

      const result = await service.processPayment(dto);

      expect(result).toBeDefined();
      expect(result.method).toBe(PaymentMethod.CREDIT_CARD);
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('MercadoPagoProvider must attach cardToken and NOT accept raw card details', async () => {
      const mpProvider = new MercadoPagoProvider({
        accessToken: 'TEST-ACCESS-TOKEN',
      });

      // Mock the request method
      const requestSpy = jest
        .spyOn(mpProvider as any, 'request')
        .mockResolvedValue({
          status: 201,
          data: {
            id: 1234567890,
            status: 'approved',
            status_detail: 'accredited',
            transaction_amount: 100.0,
            currency_id: 'BRL',
            date_approved: new Date().toISOString(),
          },
        });

      const input = {
        orderId: 'ord-card-test',
        amount: 100.0,
        currency: 'BRL',
        method: PaymentMethod.CREDIT_CARD,
        idempotencyKey: 'idem-card-test-123',
        cardToken: 'real_mp_card_token_abc123',
        installments: 1,
        paymentMethodId: 'master',
        issuerId: '25',
        customer: {
          name: 'Comprador Teste',
          email: 'buyer@test.com',
          phone: '11999999999',
          documentNumber: '11111111111',
          documentType: 'CPF',
        },
      };

      const result = await mpProvider.createPayment(input);

      expect(requestSpy).toHaveBeenCalledWith(
        '/v1/payments',
        'POST',
        expect.objectContaining({
          token: 'real_mp_card_token_abc123',
          installments: 1,
          payment_method_id: 'master',
          payer: expect.objectContaining({
            email: 'buyer@test.com',
            first_name: 'Comprador',
            last_name: 'Teste',
          }),
        }),
        'idem-card-test-123',
      );

      // Verify no raw card numbers are sent in payload
      const calledPayload = requestSpy.mock.calls[0][2] as any;
      expect(calledPayload.cardNumber).toBeUndefined();
      expect(calledPayload.securityCode).toBeUndefined();
      expect(calledPayload.cvv).toBeUndefined();
      expect(calledPayload.expiration).toBeUndefined();
      expect(calledPayload.payer.first_name).toBe('Comprador');
      expect(calledPayload.payer.last_name).toBe('Teste');
      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.providerPaymentId).toBe('1234567890');
    });

    it('MercadoPagoProvider parseCustomerName should handle single-word names and empty names safely', () => {
      const mpProvider = new MercadoPagoProvider({
        accessToken: 'TEST-ACCESS-TOKEN',
      });

      expect(mpProvider.parseCustomerName('APRO')).toEqual({
        firstName: 'APRO',
        lastName: 'APRO',
      });
      expect(mpProvider.parseCustomerName('Paula Aguiar da Silva')).toEqual({
        firstName: 'Paula',
        lastName: 'Aguiar da Silva',
      });
      expect(mpProvider.parseCustomerName('')).toEqual({
        firstName: 'Cliente',
        lastName: 'EuSou',
      });
    });

    it('F16-B Observability: HTTP 200 with x-request-id captures the identifier without secrets', async () => {
      const mpProvider = new MercadoPagoProvider({
        accessToken: 'TEST-SECRET-ACCESS-TOKEN',
      });

      jest.spyOn(mpProvider as any, 'request').mockResolvedValue({
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'x-request-id' ? 'req-200-abc-xyz' : null,
        },
        data: {
          id: 99887766,
          status: 'approved',
          status_detail: 'accredited',
          transaction_amount: 39.9,
          currency_id: 'BRL',
          date_approved: new Date().toISOString(),
        },
      });

      const result = await mpProvider.createPayment({
        orderId: 'ord-obs-200',
        amount: 39.9,
        currency: 'BRL',
        method: PaymentMethod.CREDIT_CARD,
        idempotencyKey: 'idem-obs-200',
        cardToken: 'token_card_secret_123',
        customer: {
          name: 'Comprador Observabilidade',
          email: 'obs@test.com',
          phone: '11999999999',
        },
      });

      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse.xRequestId).toBe('req-200-abc-xyz');

      // Security check: no secrets persisted in rawResponse
      const serialized = JSON.stringify(result.rawResponse);
      expect(serialized).not.toContain('TEST-SECRET-ACCESS-TOKEN');
      expect(serialized).not.toContain('token_card_secret_123');
    });

    it('F16-B Observability: HTTP 400 with x-request-id captures the identifier without secrets', async () => {
      const mpProvider = new MercadoPagoProvider({
        accessToken: 'TEST-SECRET-ACCESS-TOKEN',
      });

      jest.spyOn(mpProvider as any, 'request').mockResolvedValue({
        status: 400,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'x-request-id' ? 'req-400-bad-param' : null,
        },
        data: {
          message: 'invalid_parameter',
          error: 'bad_request',
          status: 400,
          cause: [{ code: 2001, description: 'bad card token' }],
        },
      });

      const result = await mpProvider.createPayment({
        orderId: 'ord-obs-400',
        amount: 39.9,
        currency: 'BRL',
        method: PaymentMethod.CREDIT_CARD,
        idempotencyKey: 'idem-obs-400',
        cardToken: 'secret_bad_token',
        customer: {
          name: 'Comprador Teste',
          email: 'obs@test.com',
          phone: '11999999999',
        },
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failureCode).toBe('2001');
      expect(result.rawResponse.xRequestId).toBe('req-400-bad-param');

      const serialized = JSON.stringify(result.rawResponse);
      expect(serialized).not.toContain('TEST-SECRET-ACCESS-TOKEN');
      expect(serialized).not.toContain('secret_bad_token');
    });

    it('F16-B Observability: HTTP 500 with x-request-id captures the identifier without secrets', async () => {
      const mpProvider = new MercadoPagoProvider({
        accessToken: 'TEST-SECRET-ACCESS-TOKEN',
      });

      jest.spyOn(mpProvider as any, 'request').mockResolvedValue({
        status: 500,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'x-request-id'
              ? 'req-500-internal-err-id'
              : null,
        },
        data: {
          message: 'internal_error',
          status: 500,
          cause: [],
          error: null,
        },
      });

      const result = await mpProvider.createPayment({
        orderId: 'ord-obs-500',
        amount: 39.9,
        currency: 'BRL',
        method: PaymentMethod.CREDIT_CARD,
        idempotencyKey: 'idem-obs-500',
        cardToken: 'secret_token_500',
        customer: {
          name: 'Comprador 500',
          email: 'obs@test.com',
          phone: '11999999999',
        },
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failureCode).toBe('500');
      expect(result.failureMessage).toBe('internal_error');
      expect(result.rawResponse.xRequestId).toBe('req-500-internal-err-id');

      const serialized = JSON.stringify(result.rawResponse);
      expect(serialized).not.toContain('TEST-SECRET-ACCESS-TOKEN');
      expect(serialized).not.toContain('secret_token_500');
    });

    it('F16-B Observability: response without x-request-id does not break the flow', async () => {
      const mpProvider = new MercadoPagoProvider({
        accessToken: 'TEST-SECRET-ACCESS-TOKEN',
      });

      jest.spyOn(mpProvider as any, 'request').mockResolvedValue({
        status: 500,
        headers: null,
        data: {
          message: 'internal_error',
          status: 500,
          cause: [],
        },
      });

      const result = await mpProvider.createPayment({
        orderId: 'ord-obs-missing-header',
        amount: 39.9,
        currency: 'BRL',
        method: PaymentMethod.CREDIT_CARD,
        idempotencyKey: 'idem-missing-header',
        cardToken: 'token_123',
        customer: {
          name: 'Comprador Header Faltante',
          email: 'obs@test.com',
          phone: '11999999999',
        },
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse.xRequestId).toBeUndefined();
    });

    it('F16-B Observability: network exception captures x-request-id if available and returns FAILED safely', async () => {
      const mpProvider = new MercadoPagoProvider({
        accessToken: 'TEST-SECRET-ACCESS-TOKEN',
      });

      const networkErr: any = new Error('Gateway Timeout');
      networkErr.response = {
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'x-request-id' ? 'req-net-timeout-id' : null,
        },
      };

      jest.spyOn(mpProvider as any, 'request').mockRejectedValue(networkErr);

      const result = await mpProvider.createPayment({
        orderId: 'ord-obs-net-err',
        amount: 39.9,
        currency: 'BRL',
        method: PaymentMethod.CREDIT_CARD,
        idempotencyKey: 'idem-obs-net',
        cardToken: 'secret_net_token',
        customer: {
          name: 'Cliente Rede',
          email: 'net@test.com',
          phone: '11999999999',
        },
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failureCode).toBe('500');
      expect(result.rawResponse.xRequestId).toBe('req-net-timeout-id');

      const serialized = JSON.stringify(result.rawResponse);
      expect(serialized).not.toContain('TEST-SECRET-ACCESS-TOKEN');
      expect(serialized).not.toContain('secret_net_token');
    });
  });

  describe('10. F16-B State Machine Payment -> Order -> Stock Consistency & Forbidden States', () => {
    it('TESTE 2: Payment FAILED must keep Order PENDING (or not CONFIRMED) and NOT deduct stock', async () => {
      const order = {
        id: 'ord-failed-1',
        total: '39.90',
        status: OrderStatus.PENDING,
        customerName: 'Cliente Teste',
        customerEmail: 'test@testuser.com',
        customerPhone: '11999999999',
      };
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.payment.findFirst.mockResolvedValue(null);

      // Simulate provider returning FAILED (e.g. HTTP 500 internal_error)
      jest.spyOn((service as any).provider, 'createPayment').mockResolvedValue({
        success: false,
        provider: 'MERCADO_PAGO',
        status: PaymentStatus.FAILED,
        amount: 39.9,
        currency: 'BRL',
        failureCode: '500',
        failureMessage: 'internal_error',
      });

      const failedPaymentRecord = {
        id: 'pay-fail-1',
        orderId: order.id,
        status: PaymentStatus.FAILED,
        amount: '39.90',
        method: PaymentMethod.CREDIT_CARD,
      };
      prisma.payment.create.mockResolvedValue(failedPaymentRecord);

      const result = await service.processPayment({
        orderId: order.id,
        amount: 39.9,
        method: PaymentMethod.CREDIT_CARD,
        cardToken: 'fake-token',
        paymentMethodId: 'master',
        installments: 1,
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(prisma.order.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.CONFIRMED }),
        }),
      );
      expect(inventoryService.handleOrderConfirmed).not.toHaveBeenCalled();
    });

    it('TESTE 3: Payment PAID must transition Order to CONFIRMED and deduct stock exactly once', async () => {
      const order = {
        id: 'ord-paid-1',
        total: '39.90',
        status: OrderStatus.PENDING,
        customerName: 'Cliente Teste',
        customerEmail: 'test@testuser.com',
        customerPhone: '11999999999',
      };
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.payment.findFirst.mockResolvedValue(null);

      jest.spyOn((service as any).provider, 'createPayment').mockResolvedValue({
        success: true,
        provider: 'MERCADO_PAGO',
        providerPaymentId: 'mp-paid-123',
        status: PaymentStatus.PAID,
        amount: 39.9,
        currency: 'BRL',
      });

      const paidPaymentRecord = {
        id: 'pay-paid-1',
        orderId: order.id,
        providerPaymentId: 'mp-paid-123',
        status: PaymentStatus.PAID,
        amount: '39.90',
        method: PaymentMethod.CREDIT_CARD,
      };
      prisma.payment.create.mockResolvedValue(paidPaymentRecord);

      const result = await service.processPayment({
        orderId: order.id,
        amount: 39.9,
        method: PaymentMethod.CREDIT_CARD,
        cardToken: 'token-apro',
        paymentMethodId: 'master',
        installments: 1,
      });

      expect(result.status).toBe(PaymentStatus.PAID);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED },
      });
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledWith(
        order.id,
      );
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledTimes(1);
    });

    it('TESTE 4 & 5: Webhook PAID received once then duplicated must only deduct stock once', async () => {
      const order = {
        id: 'ord-webhook-idem',
        total: '50.00',
        status: OrderStatus.PENDING,
      };
      const pendingPayment = {
        id: 'pay-web-idem',
        orderId: order.id,
        providerPaymentId: 'mp-web-idem-999',
        status: PaymentStatus.PENDING,
        order,
      };

      jest.spyOn((service as any).provider, 'getPayment').mockResolvedValue({
        success: true,
        status: PaymentStatus.PAID,
        providerPaymentId: 'mp-web-idem-999',
        paidAt: new Date(),
      });

      // Run 1: transitions to PAID
      prisma.payment.findFirst.mockResolvedValueOnce(pendingPayment);
      prisma.payment.update.mockResolvedValueOnce({
        ...pendingPayment,
        status: PaymentStatus.PAID,
      });

      const res1 = await service.handleWebhook(
        {},
        { 'data.id': 'mp-web-idem-999' },
        { action: 'payment.updated', data: { id: 'mp-web-idem-999' } },
      );
      expect(res1.status).toBe('PROCESSED');
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED },
      });
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledTimes(1);

      // Run 2: Duplicate webhook with already PAID status
      const paidPayment = {
        ...pendingPayment,
        status: PaymentStatus.PAID,
      };
      prisma.payment.findFirst.mockResolvedValueOnce(paidPayment);

      const res2 = await service.handleWebhook(
        {},
        { 'data.id': 'mp-web-idem-999' },
        { action: 'payment.updated', data: { id: 'mp-web-idem-999' } },
      );
      expect(res2.status).toBe('IGNORED');
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledTimes(1); // Still 1!
    });

    it('TESTE 6: First attempt FAILED then second attempt PAID must complete order with single stock deduction', async () => {
      const order = {
        id: 'ord-retry-flow',
        total: '39.90',
        status: OrderStatus.PENDING,
        customerName: 'Cliente Teste',
        customerEmail: 'test@testuser.com',
        customerPhone: '11999999999',
      };
      prisma.order.findUnique.mockResolvedValue(order);

      // First run: FAILED attempt
      prisma.payment.findFirst.mockResolvedValueOnce(null);
      jest
        .spyOn((service as any).provider, 'createPayment')
        .mockResolvedValueOnce({
          success: false,
          provider: 'MERCADO_PAGO',
          status: PaymentStatus.FAILED,
          amount: 39.9,
          currency: 'BRL',
          failureCode: '500',
          failureMessage: 'internal_error',
        });
      prisma.payment.create.mockResolvedValueOnce({
        id: 'pay-attempt-1',
        orderId: order.id,
        status: PaymentStatus.FAILED,
        amount: '39.90',
      });

      const firstAttempt = await service.processPayment({
        orderId: order.id,
        amount: 39.9,
        method: PaymentMethod.CREDIT_CARD,
        cardToken: 'tok-1',
      });
      expect(firstAttempt.status).toBe(PaymentStatus.FAILED);
      expect(inventoryService.handleOrderConfirmed).not.toHaveBeenCalled();

      // Second run: Customer tries again and payment SUCCEEDS
      prisma.payment.findFirst.mockResolvedValueOnce(null);
      jest
        .spyOn((service as any).provider, 'createPayment')
        .mockResolvedValueOnce({
          success: true,
          provider: 'MERCADO_PAGO',
          providerPaymentId: 'mp-paid-ok',
          status: PaymentStatus.PAID,
          amount: 39.9,
          currency: 'BRL',
        });
      prisma.payment.create.mockResolvedValueOnce({
        id: 'pay-attempt-2',
        orderId: order.id,
        status: PaymentStatus.PAID,
        amount: '39.90',
      });

      const secondAttempt = await service.processPayment({
        orderId: order.id,
        amount: 39.9,
        method: PaymentMethod.CREDIT_CARD,
        cardToken: 'tok-2',
      });
      expect(secondAttempt.status).toBe(PaymentStatus.PAID);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED },
      });
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledWith(
        order.id,
      );
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledTimes(1);
    });

    it('TESTE 7: Duplicate payment calls must not produce multiple StockMovement OUT', async () => {
      const order = {
        id: 'ord-dup-check',
        total: '39.90',
        status: OrderStatus.PENDING,
        customerName: 'Cliente Teste',
        customerEmail: 'test@testuser.com',
        customerPhone: '11999999999',
      };
      prisma.order.findUnique.mockResolvedValue(order);

      const existingPaid = {
        id: 'pay-already-paid',
        orderId: order.id,
        status: PaymentStatus.PAID,
        amount: '39.90',
      };
      // Layer 1 idempotency returns existing paid payment immediately
      prisma.payment.findFirst.mockResolvedValue(existingPaid);

      const res = await service.processPayment({
        orderId: order.id,
        amount: 39.9,
        method: PaymentMethod.CREDIT_CARD,
      });

      expect(res.id).toBe('pay-already-paid');
      expect(inventoryService.handleOrderConfirmed).not.toHaveBeenCalled();
    });

    it('TESTE 8 & 9: MockPaymentProvider obeys the same state machine (PAID confirms and deducts; FAILED does not)', async () => {
      const order = {
        id: 'ord-mock-eval',
        total: '39.90',
        status: OrderStatus.PENDING,
        customerName: 'Cliente Teste',
        customerEmail: 'test@testuser.com',
        customerPhone: '11999999999',
      };
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.payment.findFirst.mockResolvedValue(null);

      // Case A: Mock returns FAILED
      jest
        .spyOn((service as any).provider, 'createPayment')
        .mockResolvedValueOnce({
          success: false,
          provider: 'MOCK_DEMO_PROVIDER',
          status: PaymentStatus.FAILED,
          amount: 39.9,
          currency: 'BRL',
          failureCode: 'mock_card_declined',
        });
      prisma.payment.create.mockResolvedValueOnce({
        id: 'mock-fail',
        orderId: order.id,
        status: PaymentStatus.FAILED,
        amount: '39.90',
      });

      const failedRes = await service.processPayment({
        orderId: order.id,
        amount: 39.9,
        method: PaymentMethod.CREDIT_CARD,
      });
      expect(failedRes.status).toBe(PaymentStatus.FAILED);
      expect(inventoryService.handleOrderConfirmed).not.toHaveBeenCalled();

      // Case B: Mock returns PAID
      jest
        .spyOn((service as any).provider, 'createPayment')
        .mockResolvedValueOnce({
          success: true,
          provider: 'MOCK_DEMO_PROVIDER',
          providerPaymentId: 'mock-paid-tx',
          status: PaymentStatus.PAID,
          amount: 39.9,
          currency: 'BRL',
        });
      prisma.payment.create.mockResolvedValueOnce({
        id: 'mock-paid',
        orderId: order.id,
        status: PaymentStatus.PAID,
        amount: '39.90',
      });

      const paidRes = await service.processPayment({
        orderId: order.id,
        amount: 39.9,
        method: PaymentMethod.CREDIT_CARD,
      });
      expect(paidRes.status).toBe(PaymentStatus.PAID);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED },
      });
      expect(inventoryService.handleOrderConfirmed).toHaveBeenCalledTimes(1);
    });
  });
});
