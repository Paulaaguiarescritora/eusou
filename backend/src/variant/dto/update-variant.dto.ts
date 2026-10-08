import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateVariantDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
