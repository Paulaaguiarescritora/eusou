import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AffiliateStatus } from '@prisma/client';

export class CreateAffiliateDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsEnum(AffiliateStatus)
  @IsOptional()
  status?: AffiliateStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'defaultCommissionPercent deve ser um número com até 2 casas decimais' })
  @Min(0, { message: 'defaultCommissionPercent não pode ser menor que 0' })
  @Max(100, { message: 'defaultCommissionPercent não pode ser maior que 100' })
  defaultCommissionPercent?: number;
}

export class UpdateAffiliateDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsEnum(AffiliateStatus)
  @IsOptional()
  status?: AffiliateStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'defaultCommissionPercent deve ser um número com até 2 casas decimais' })
  @Min(0, { message: 'defaultCommissionPercent não pode ser menor que 0' })
  @Max(100, { message: 'defaultCommissionPercent não pode ser maior que 100' })
  defaultCommissionPercent?: number;
}

