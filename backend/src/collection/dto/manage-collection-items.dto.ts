import {
  IsArray,
  IsUUID,
  ArrayNotEmpty,
  IsInt,
  Min,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddCollectionProductDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;
}

export class CollectionProductsOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CollectionProductOrderItem)
  items: CollectionProductOrderItem[];
}

export class CollectionProductOrderItem {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(0)
  position: number;
}
