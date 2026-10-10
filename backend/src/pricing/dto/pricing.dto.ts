import {
  IsUUID,
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Max,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class SimulatePricingDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsUUID()
  channelId: string;

  @IsOptional()
  @IsNumber()
  costOverride?: number;

  @IsOptional()
  @IsNumber()
  marginOverride?: number;

  @IsOptional()
  @IsUUID()
  pricingProfileId?: string;
}

export class CalculatePricingDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  channelIds?: string[];

  @IsOptional()
  @IsUUID()
  pricingProfileId?: string;
}

export class SetManualPriceDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsUUID()
  channelId: string;

  @IsNumber()
  @Min(0.01)
  manualPrice: number;
}

export class CreatePricingProfileDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  defaultTargetMargin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packagingCost?: number;

  @IsOptional()
  @IsString()
  roundingRule?: string;
}

export class UpdatePricingProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  defaultTargetMargin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packagingCost?: number;

  @IsOptional()
  @IsString()
  roundingRule?: string;
}

export class CreatePricingChannelRuleDto {
  @IsUUID()
  pricingProfileId: string;

  @IsUUID()
  channelId: string;

  @IsString()
  channelType: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  targetMargin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  commissionPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  fixedCostPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  otherPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherFixedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  orderFixedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  paymentFeePercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePricingRuleTierDto {
  @IsUUID()
  pricingChannelRuleId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @Min(0)
  minPrice: number;

  @IsNumber()
  @Min(0)
  maxPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  commissionPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  fixedCostPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  otherPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherFixedCost?: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
