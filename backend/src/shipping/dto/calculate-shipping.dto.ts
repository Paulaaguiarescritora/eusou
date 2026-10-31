import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ShippingItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string | null;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CalculateShippingDto {
  @IsString()
  @IsNotEmpty()
  destinationPostalCode: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingItemDto)
  items: ShippingItemDto[];
}
