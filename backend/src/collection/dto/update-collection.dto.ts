import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { CollectionStatus } from '@prisma/client';

export class UpdateCollectionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  coverMediaId?: string | null;

  @IsEnum(CollectionStatus)
  @IsOptional()
  status?: CollectionStatus;
}
