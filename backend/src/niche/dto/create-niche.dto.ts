import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { NicheStatus } from '@prisma/client';

export class CreateNicheDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
