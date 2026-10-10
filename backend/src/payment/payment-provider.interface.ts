import { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface CreatePaymentProviderInput {
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  idempotencyKey: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    documentNumber?: string;
    documentType?: string;
  };
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string; // e.g. 'visa', 'master', 'pix'
  issuerId?: string;
}

export interface PaymentProviderResult {
  success: boolean;
  provider: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  status: PaymentStatus;
  externalStatus?: string;
  externalStatusDetail?: string;
  amount: number;
  currency: string;
  paidAt?: Date;
  expiresAt?: Date;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse?: any;
}

export interface WebhookNotificationPayload {
  id?: string;
  live_mode?: boolean;
  type?: string;
  date_created?: string;
  action?: string;
  data?: {
    id: string;
  };
  [key: string]: any;
}

export interface ParsedWebhookResult {
  isValid: boolean;
  eventId?: string;
  action?: string;
  providerPaymentId?: string;
  topic?: string;
  rawPayload: any;
}

export interface PaymentProvider {
  readonly providerName: string;

  createPayment(input: CreatePaymentProviderInput): Promise<PaymentProviderResult>;
  getPayment(providerPaymentId: string): Promise<PaymentProviderResult>;
  cancelPayment(providerPaymentId: string): Promise<PaymentProviderResult>;
  refundPayment(providerPaymentId: string, amount?: number): Promise<PaymentProviderResult>;
  parseWebhook(headers: Record<string, any>, query: Record<string, any>, body: any): ParsedWebhookResult;
  verifyWebhook(headers: Record<string, any>, query: Record<string, any>, body: any): boolean;
  mapStatus(externalStatus: string, externalStatusDetail?: string): PaymentStatus;
}
