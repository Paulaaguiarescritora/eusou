import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CatalogStatus, CatalogType } from '@prisma/client';

export class QueryCatalogsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CatalogStatus)
  status?: CatalogStatus;

  @IsOptional()
  @IsEnum(CatalogType)
  type?: CatalogType;

  @IsOptional()
  @IsUUID()
  nicheId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
