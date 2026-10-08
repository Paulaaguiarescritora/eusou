import {
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
} from 'class-validator';

export class CreateCommissionRuleDto {
  @IsUUID()
  @IsOptional()
  affiliateId?: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  nicheId?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fixedAmount?: number;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCommissionRuleDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  percentage?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fixedAmount?: number;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
