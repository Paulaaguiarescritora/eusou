import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  // Credit Card fields (tokenized, never full card details)
  @IsString()
  @IsOptional()
  cardToken?: string;

  @IsNumber()
  @IsOptional()
  installments?: number;

  @IsString()
  @IsOptional()
  paymentMethodId?: string; // 'visa', 'master', etc.

  @IsString()
  @IsOptional()
  issuerId?: string;

  // Customer identification for Pix / Credit card anti-fraud
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  documentType?: string;
}

export class RefundPaymentDto {
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  amount?: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
