export interface PaymentRequest {
  orderId: string;
  amount: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  provider: string;
  message?: string;
}

export interface PaymentProvider {
  readonly providerName: string;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  getPaymentStatus(transactionId: string): Promise<PaymentResult>;
  cancelPayment(transactionId: string): Promise<PaymentResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly providerName = 'MOCK_DEMO_PROVIDER';

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    return {
      success: true,
      transactionId: `mock_tx_${Date.now()}_${request.orderId.slice(0, 8)}`,
      status: 'CONFIRMED',
      provider: this.providerName,
      message: 'Demonstration payment approved in test mode',
    };
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId,
      status: 'CONFIRMED',
      provider: this.providerName,
    };
  }

  async cancelPayment(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId,
      status: 'PENDING',
      provider: this.providerName,
      message: 'Payment cancelled in test mode',
    };
  }
}

