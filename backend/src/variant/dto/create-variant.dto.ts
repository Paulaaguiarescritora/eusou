import { IsString, IsOptional, IsBoolean, MaxLength, IsNumber, Min } from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

  @IsString()
  @IsOptional()
  materialId?: string | null;
}
