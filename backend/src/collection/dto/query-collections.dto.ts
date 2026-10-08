import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CollectionStatus } from '@prisma/client';

export class QueryCollectionsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;

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
