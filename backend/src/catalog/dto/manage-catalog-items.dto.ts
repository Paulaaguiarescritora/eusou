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

export class AddCatalogProductDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;
}

export class CatalogProductsOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CatalogProductOrderItem)
  items: CatalogProductOrderItem[];
}

export class CatalogProductOrderItem {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(0)
  position: number;
}

export class AddCatalogCollectionDto {
  @IsUUID()
  collectionId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;
}

export class CatalogCollectionsOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CatalogCollectionOrderItem)
  items: CatalogCollectionOrderItem[];
}

export class CatalogCollectionOrderItem {
  @IsUUID()
  collectionId: string;

  @IsInt()
  @Min(0)
  position: number;
}
