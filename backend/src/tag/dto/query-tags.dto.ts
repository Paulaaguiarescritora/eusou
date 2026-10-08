import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TagStatus } from '@prisma/client';

export class QueryTagsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TagStatus)
  status?: TagStatus;

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
