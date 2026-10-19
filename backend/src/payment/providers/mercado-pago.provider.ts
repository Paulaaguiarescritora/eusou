import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  PaymentProvider,
  CreatePaymentProviderInput,
  PaymentProviderResult,
  ParsedWebhookResult,
} from '../payment-provider.interface';

export interface MercadoPagoConfig {
  accessToken: string;
  publicKey?: string;
  webhookSecret?: string;
  environment?: 'TEST' | 'PRODUCTION';
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly providerName = 'MERCADO_PAGO';
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly logger = new Logger(MercadoPagoProvider.name);

  constructor(private readonly config: MercadoPagoConfig) {}

  private async request(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT',
    body?: any,
    idempotencyKey?: string,
  ): Promise<{ status: number; data: any; headers: any }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseData = await response.json().catch(() => null);

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || '2';
        this.logger.warn(
          `Mercado Pago Rate Limit 429 hit. Retry-After: ${retryAfter}s`,
        );
      }

      return {
        status: response.status,
        data: responseData,
        headers: response.headers,
      };
    } catch (err: any) {
      this.logger.error(
        `Mercado Pago HTTP request error to ${endpoint}: ${err.message}`,
      );
      throw err;
    }
  }

  async createPayment(
    input: CreatePaymentProviderInput,
  ): Promise<PaymentProviderResult> {
    const isPix = input.method === PaymentMethod.PIX;

    let payload: any;

    const { firstName, lastName } = this.parseCustomerName(input.customer.name);

    if (isPix) {
      payload = {
        transaction_amount: Number(input.amount),
        description: `Pedido ${input.orderId}`,
        payment_method_id: 'pix',
        payer: {
          email: input.customer.email,
          first_name: firstName,
          last_name: lastName,
          identification: input.customer.documentNumber
            ? {
                type: input.customer.documentType || 'CPF',
                number: input.customer.documentNumber.replace(/\D/g, ''),
              }
            : undefined,
        },
      };
    } else {
      // Cartão de Crédito
      payload = {
        transaction_amount: Number(input.amount),
        token: input.cardToken,
        description: `Pedido ${input.orderId}`,
        installments: input.installments || 1,
        payment_method_id: input.paymentMethodId || 'credit_card',
        issuer_id: input.issuerId
          ? Number(input.issuerId) || input.issuerId
          : undefined,
        payer: {
          email: input.customer.email,
          first_name: firstName,
          last_name: lastName,
          identification: input.customer.documentNumber
            ? {
                type: input.customer.documentType || 'CPF',
                number: input.customer.documentNumber.replace(/\D/g, ''),
              }
            : undefined,
        },
      };
    }

    let res: { status: number; data: any; headers: any };
    try {
      res = await this.request(
        '/v1/payments',
        'POST',
        payload,
        input.idempotencyKey,
      );
    } catch (err: any) {
      const xRequestId =
        err?.response?.headers?.get?.('x-request-id') ||
        err?.response?.headers?.['x-request-id'] ||
        err?.headers?.['x-request-id'] ||
        null;
      this.logger.error(
        `Mercado Pago POST /v1/payments request failed with exception: ${err.message}${
          xRequestId ? ` (x-request-id: ${xRequestId})` : ''
        }`,
      );
      return {
        success: false,
        provider: this.providerName,
        status: PaymentStatus.FAILED,
        externalStatus: 'error',
        externalStatusDetail: 'NETWORK_ERROR',
        amount: input.amount,
        currency: input.currency || 'BRL',
        failureCode: '500',
        failureMessage: err.message || 'Mercado Pago request failed',
        rawResponse: {
          error: err.message,
          ...(xRequestId ? { xRequestId } : {}),
        },
      };
    }

    // Observability: Capture Mercado Pago x-request-id safely
    const xRequestId =
      res.headers?.get?.('x-request-id') ||
      res.headers?.['x-request-id'] ||
      res.headers?.['X-Request-Id'] ||
      null;

    if (xRequestId) {
      this.logger.log(
        `Mercado Pago POST /v1/payments responded with status ${res.status} (x-request-id: ${xRequestId})`,
      );
    }

    if (res.status >= 200 && res.status < 300 && res.data) {
      const data = res.data;
      const mappedStatus = this.mapStatus(data.status, data.status_detail);

      let pixQrCode: string | undefined;
      let pixQrCodeBase64: string | undefined;

      if (isPix && data.point_of_interaction?.transaction_data) {
        pixQrCode = data.point_of_interaction.transaction_data.qr_code;
        pixQrCodeBase64 =
          data.point_of_interaction.transaction_data.qr_code_base64;
      }

      // Attach x-request-id safely to rawResponse metadata (no secrets included)
      const rawResponse = {
        ...data,
        ...(xRequestId ? { xRequestId } : {}),
      };

      return {
        success:
          mappedStatus === PaymentStatus.PAID ||
          mappedStatus === PaymentStatus.PROCESSING ||
          mappedStatus === PaymentStatus.AUTHORIZED,
        provider: this.providerName,
        providerPaymentId: String(data.id),
        providerOrderId: data.order?.id ? String(data.order.id) : undefined,
        status: mappedStatus,
        externalStatus: data.status,
        externalStatusDetail: data.status_detail,
        amount: data.transaction_amount || input.amount,
        currency: data.currency_id || 'BRL',
        paidAt: data.date_approved ? new Date(data.date_approved) : undefined,
        expiresAt: data.date_of_expiration
          ? new Date(data.date_of_expiration)
          : undefined,
        pixQrCode,
        pixQrCodeBase64,
        failureCode:
          data.status === 'rejected' ? data.status_detail : undefined,
        failureMessage:
          data.status === 'rejected'
            ? this.formatStatusDetail(data.status_detail)
            : undefined,
        rawResponse,
      };
    }

    // Failure / Error response
    const errorMessage =
      res.data?.message || res.data?.error || `HTTP ${res.status}`;
    const failureCode =
      res.data?.cause?.[0]?.code != null
        ? String(res.data.cause[0].code)
        : String(res.status);

    // Attach x-request-id safely to error rawResponse metadata (no secrets included)
    const rawResponse = {
      ...(res.data && typeof res.data === 'object'
        ? res.data
        : { raw: res.data }),
      ...(xRequestId ? { xRequestId } : {}),
    };

    return {
      success: false,
      provider: this.providerName,
      status: PaymentStatus.FAILED,
      externalStatus: 'error',
      externalStatusDetail: failureCode,
      amount: input.amount,
      currency: input.currency || 'BRL',
      failureCode,
      failureMessage: errorMessage,
      rawResponse,
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentProviderResult> {
    const res = await this.request(`/v1/payments/${providerPaymentId}`, 'GET');

    if (res.status === 200 && res.data) {
      const data = res.data;
      const mappedStatus = this.mapStatus(data.status, data.status_detail);

      let pixQrCode: string | undefined;
      let pixQrCodeBase64: string | undefined;

      if (data.point_of_interaction?.transaction_data) {
        pixQrCode = data.point_of_interaction.transaction_data.qr_code;
        pixQrCodeBase64 =
          data.point_of_interaction.transaction_data.qr_code_base64;
      }

      return {
        success: true,
        provider: this.providerName,
        providerPaymentId: String(data.id),
        providerOrderId: data.order?.id ? String(data.order.id) : undefined,
        status: mappedStatus,
        externalStatus: data.status,
        externalStatusDetail: data.status_detail,
        amount: data.transaction_amount,
        currency: data.currency_id || 'BRL',
        paidAt: data.date_approved ? new Date(data.date_approved) : undefined,
        expiresAt: data.date_of_expiration
          ? new Date(data.date_of_expiration)
          : undefined,
        pixQrCode,
        pixQrCodeBase64,
        rawResponse: data,
      };
    }

    return {
      success: false,
      provider: this.providerName,
      providerPaymentId,
      status: PaymentStatus.FAILED,
      amount: 0,
      currency: 'BRL',
      failureCode: String(res.status),
      failureMessage: res.data?.message || 'Payment not found on Mercado Pago',
      rawResponse: res.data,
    };
  }

  async cancelPayment(
    providerPaymentId: string,
  ): Promise<PaymentProviderResult> {
    const res = await this.request(`/v1/payments/${providerPaymentId}`, 'PUT', {
      status: 'cancelled',
    });

    if (res.status === 200 && res.data) {
      return {
        success: true,
        provider: this.providerName,
        providerPaymentId: String(res.data.id),
        status: PaymentStatus.CANCELLED,
        externalStatus: res.data.status,
        externalStatusDetail: res.data.status_detail,
        amount: res.data.transaction_amount || 0,
        currency: res.data.currency_id || 'BRL',
        rawResponse: res.data,
      };
    }

    return {
      success: false,
      provider: this.providerName,
      providerPaymentId,
      status: PaymentStatus.FAILED,
      amount: 0,
      currency: 'BRL',
      failureMessage: res.data?.message || 'Failed to cancel payment',
      rawResponse: res.data,
    };
  }

  async refundPayment(
    providerPaymentId: string,
    amount?: number,
  ): Promise<PaymentProviderResult> {
    const body = amount ? { amount: Number(amount) } : {};
    const res = await this.request(
      `/v1/payments/${providerPaymentId}/refunds`,
      'POST',
      body,
      `refund_${Date.now()}_${providerPaymentId}`,
    );

    if (res.status >= 200 && res.status < 300 && res.data) {
      return {
        success: true,
        provider: this.providerName,
        providerPaymentId,
        status: amount
          ? PaymentStatus.PARTIALLY_REFUNDED
          : PaymentStatus.REFUNDED,
        externalStatus: 'refunded',
        amount: res.data.amount || amount || 0,
        currency: 'BRL',
        rawResponse: res.data,
      };
    }

    return {
      success: false,
      provider: this.providerName,
      providerPaymentId,
      status: PaymentStatus.FAILED,
      amount: amount || 0,
      currency: 'BRL',
      failureMessage: res.data?.message || 'Failed to refund payment',
      rawResponse: res.data,
    };
  }

  parseWebhook(
    _headers: Record<string, any>,
    query: Record<string, any>,
    body: any,
  ): ParsedWebhookResult {
    const dataId = body?.data?.id || query?.['data.id'] || query?.id;
    const eventId = body?.id || `webhook_${dataId || Date.now()}`;
    const topic = body?.type || query?.type || query?.topic || 'payment';

    return {
      isValid: Boolean(dataId),
      eventId: String(eventId),
      action: body?.action || 'payment.updated',
      providerPaymentId: dataId ? String(dataId) : undefined,
      topic: String(topic),
      rawPayload: body || query,
    };
  }

  verifyWebhook(
    headers: Record<string, any>,
    query: Record<string, any>,
    _body: any,
  ): boolean {
    if (!this.config.webhookSecret) {
      // If secret not configured yet, log warning and allow for homologation readiness
      return true;
    }

    const xSignature = headers['x-signature'] || headers['X-Signature'];
    const xRequestId = headers['x-request-id'] || headers['X-Request-Id'];
    const dataId = query?.['data.id'] || query?.id;

    if (!xSignature) {
      return false;
    }

    // Split ts and v1 from xSignature
    const parts = xSignature.split(',');
    let ts: string | undefined;
    let v1: string | undefined;

    for (const part of parts) {
      const [key, val] = part.trim().split('=');
      if (key === 'ts') ts = val;
      if (key === 'v1') v1 = val;
    }

    if (!ts || !v1) {
      return false;
    }

    // Manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
    let manifest = '';
    if (dataId) manifest += `id:${dataId};`;
    if (xRequestId) manifest += `request-id:${xRequestId};`;
    manifest += `ts:${ts};`;

    const hmac = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(manifest)
      .digest('hex');

    return hmac === v1;
  }

  mapStatus(
    externalStatus: string,
    externalStatusDetail?: string,
  ): PaymentStatus {
    switch (externalStatus) {
      case 'approved':
        return externalStatusDetail === 'partially_refunded'
          ? PaymentStatus.PARTIALLY_REFUNDED
          : PaymentStatus.PAID;
      case 'authorized':
        return PaymentStatus.AUTHORIZED;
      case 'in_process':
      case 'pending':
        return PaymentStatus.PROCESSING;
      case 'rejected':
        return PaymentStatus.FAILED;
      case 'cancelled':
        return externalStatusDetail === 'expired'
          ? PaymentStatus.EXPIRED
          : PaymentStatus.CANCELLED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      case 'charged_back':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private formatStatusDetail(detail?: string): string {
    const map: Record<string, string> = {
      cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
      cc_rejected_bad_filled_date: 'Confira a data de validade.',
      cc_rejected_bad_filled_security_code:
        'Confira o código de segurança (CVV).',
      cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
      cc_rejected_call_for_authorize:
        'Você deve autorizar o pagamento junto à sua instituição financeira.',
      cc_rejected_insufficient_amount:
        'Saldo ou limite insuficiente no cartão.',
      cc_rejected_card_disabled:
        'Ligue para a instituição financeira para ativar o seu cartão.',
      cc_rejected_duplicated_payment:
        'Pagamento duplicado. Verifique os lançamentos da fatura.',
      cc_rejected_high_risk:
        'Pagamento recusado pela análise de risco de segurança.',
    };
    return map[detail || ''] || 'Pagamento recusado pelo emissor do cartão.';
  }

  parseCustomerName(rawName?: string): { firstName: string; lastName: string } {
    const parts = (rawName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return { firstName: 'Cliente', lastName: 'EuSou' };
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: parts[0] };
    }
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName };
  }
}
