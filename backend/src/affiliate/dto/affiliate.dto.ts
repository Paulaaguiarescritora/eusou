import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
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
}
