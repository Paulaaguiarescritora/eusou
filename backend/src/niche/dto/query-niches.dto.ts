import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NicheStatus } from '@prisma/client';

export class QueryNichesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(NicheStatus)
  status?: NicheStatus;

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
