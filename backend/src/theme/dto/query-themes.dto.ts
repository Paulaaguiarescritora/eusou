import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ThemeStatus } from '@prisma/client';

export class QueryThemesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ThemeStatus)
  status?: ThemeStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPreset?: boolean;

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
