import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryStatus } from '@prisma/client';

export class QueryCategoriesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @IsOptional()
  @IsUUID()
  nicheId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

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
