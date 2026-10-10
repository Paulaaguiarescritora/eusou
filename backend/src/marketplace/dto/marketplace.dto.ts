import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ChannelType, ChannelAccountStatus } from '@prisma/client';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateChannelAccountDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  externalAccountId?: string;

  @IsOptional()
  configuration?: Record<string, any>;
}

export class UpdateChannelAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ChannelAccountStatus)
  @IsOptional()
  status?: ChannelAccountStatus;

  @IsOptional()
  configuration?: Record<string, any>;
}

export class PublishProductDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  channelAccountId: string;

  @IsNumber()
  @IsOptional()
  priceOverride?: number;
}

export class MapCategoryDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  externalCategoryId: string;

  @IsString()
  @IsNotEmpty()
  externalCategoryName: string;
}

export class CompleteOAuthDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  channelAccountId?: string;

  @IsString()
  @IsOptional()
  accountName?: string;
}

export class ValidateProductDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  channelAccountId: string;

  @IsNumber()
  @IsOptional()
  priceOverride?: number;
}

export class CreateAttributeMappingDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsOptional()
  externalCategoryId?: string;

  @IsString()
  @IsNotEmpty()
  attributeDefinitionId: string;

  @IsString()
  @IsNotEmpty()
  externalAttributeId: string;

  @IsString()
  @IsOptional()
  externalAttributeName?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsString()
  @IsOptional()
  defaultValue?: string;

  @IsOptional()
  valueMapping?: Record<string, any>;
}

export class IngestChannelOrderDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  channelAccountId: string;

  @IsString()
  @IsNotEmpty()
  externalOrderId: string;

  @IsString()
  @IsOptional()
  externalBuyerId?: string;

  @IsString()
  @IsNotEmpty()
  externalStatus: string;

  @IsNumber()
  externalTotal: number;

  @IsString()
  @IsOptional()
  externalCurrency?: string;

  @IsNumber()
  @IsOptional()
  commissionFee?: number;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsOptional()
  rawPayload?: Record<string, any>;

  // Customer info for internal Order creation
  @IsOptional()
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };

  // Order items
  @IsOptional()
  items?: Array<{
    productId?: string;
    sku?: string;
    externalItemId?: string;
    quantity: number;
    unitPrice: number;
    title?: string;
  }>;
}

