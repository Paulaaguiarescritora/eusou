import { IsString, IsOptional, IsEnum } from 'class-validator';
import { NicheStatus } from '@prisma/client';

export class UpdateNicheDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(NicheStatus)
  @IsOptional()
  status?: NicheStatus;
}
