import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CategoryStatus)
  @IsOptional()
  status?: CategoryStatus;

  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @IsUUID()
  @IsOptional()
  nicheId?: string | null;
}
