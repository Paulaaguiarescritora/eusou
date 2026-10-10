import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  PaymentProvider,
  CreatePaymentProviderInput,
  PaymentProviderResult,
  ParsedWebhookResult,
} from '../payment-provider.interface';

export class MockPaymentProvider implements PaymentProvider {
  readonly providerName = 'MOCK_DEMO_PROVIDER';

  async createPayment(input: CreatePaymentProviderInput): Promise<PaymentProviderResult> {
    const isPix = input.method === PaymentMethod.PIX;
    const providerPaymentId = `mock_mp_${Date.now()}_${input.orderId.slice(0, 8)}`;

    return {
      success: true,
      provider: this.providerName,
      providerPaymentId,
      status: PaymentStatus.PAID, // In mock mode, immediately confirm
      externalStatus: 'approved',
      externalStatusDetail: 'accredited',
      amount: input.amount,
      currency: input.currency || 'BRL',
      paidAt: new Date(),
      pixQrCode: isPix ? `00020126580014br.gov.bcb.pix0136${providerPaymentId}520400005303986540${input.amount.toFixed(2)}5802BR` : undefined,
      pixQrCodeBase64: isPix ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' : undefined,
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentProviderResult> {
    return {
      success: true,
      provider: this.providerName,
      providerPaymentId,
      status: PaymentStatus.PAID,
      externalStatus: 'approved',
      externalStatusDetail: 'accredited',
      amount: 100.0,
      currency: 'BRL',
      paidAt: new Date(),
    };
  }

  async cancelPayment(providerPaymentId: string): Promise<PaymentProviderResult> {
    return {
      success: true,
      provider: this.providerName,
      providerPaymentId,
      status: PaymentStatus.CANCELLED,
      externalStatus: 'cancelled',
      externalStatusDetail: 'by_collector',
      amount: 100.0,
      currency: 'BRL',
    };
  }

  async refundPayment(providerPaymentId: string, amount?: number): Promise<PaymentProviderResult> {
    return {
      success: true,
      provider: this.providerName,
      providerPaymentId,
      status: amount ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED,
      externalStatus: 'refunded',
      externalStatusDetail: 'refunded',
      amount: amount || 100.0,
      currency: 'BRL',
    };
  }

  parseWebhook(headers: Record<string, any>, query: Record<string, any>, body: any): ParsedWebhookResult {
    const dataId = body?.data?.id || query?.['data.id'] || query?.id;
    return {
      isValid: true,
      eventId: body?.id || `mock_event_${Date.now()}`,
      action: body?.action || 'payment.updated',
      providerPaymentId: dataId ? String(dataId) : undefined,
      topic: body?.type || 'payment',
      rawPayload: body,
    };
  }

  verifyWebhook(_headers: Record<string, any>, _query: Record<string, any>, _body: any): boolean {
    return true;
  }

  mapStatus(externalStatus: string, _externalStatusDetail?: string): PaymentStatus {
    switch (externalStatus) {
      case 'approved':
        return PaymentStatus.PAID;
      case 'authorized':
        return PaymentStatus.AUTHORIZED;
      case 'in_process':
      case 'pending':
        return PaymentStatus.PROCESSING;
      case 'rejected':
        return PaymentStatus.FAILED;
      case 'cancelled':
        return PaymentStatus.CANCELLED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      case 'charged_back':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
