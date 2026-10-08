import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { TagStatus } from '@prisma/client';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(TagStatus)
  @IsOptional()
  status?: TagStatus;
}
