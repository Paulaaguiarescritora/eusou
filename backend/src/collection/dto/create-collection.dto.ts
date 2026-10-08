import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { CollectionStatus } from '@prisma/client';

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  coverMediaId?: string;

  @IsEnum(CollectionStatus)
  @IsOptional()
  status?: CollectionStatus;
}
