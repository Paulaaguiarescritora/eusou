import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
  parentId?: string;

  @IsUUID()
  @IsOptional()
  nicheId?: string;
}
