import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CatalogStatus, CatalogType, CatalogRuleType } from '@prisma/client';

export class CatalogRuleDto {
  @IsEnum(CatalogRuleType)
  type: CatalogRuleType;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreateCatalogDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CatalogStatus)
  @IsOptional()
  status?: CatalogStatus;

  @IsEnum(CatalogType)
  @IsOptional()
  type?: CatalogType;

  @IsUUID()
  @IsOptional()
  nicheId?: string;

  @IsUUID()
  @IsOptional()
  themeId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogRuleDto)
  @IsOptional()
  rules?: CatalogRuleDto[];
}
