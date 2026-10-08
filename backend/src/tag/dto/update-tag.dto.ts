import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TagStatus } from '@prisma/client';

export class UpdateTagDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(TagStatus)
  @IsOptional()
  status?: TagStatus;
}
