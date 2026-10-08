import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CatalogStatus, CatalogType } from '@prisma/client';
import { CatalogRuleDto } from './create-catalog.dto';

export class UpdateCatalogDto {
  @IsString()
  @IsOptional()
  name?: string;

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
  nicheId?: string | null;

  @IsUUID()
  @IsOptional()
  themeId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogRuleDto)
  @IsOptional()
  rules?: CatalogRuleDto[];
}
