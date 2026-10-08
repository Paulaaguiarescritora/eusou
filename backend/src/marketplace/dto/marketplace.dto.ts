import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ChannelType, ChannelAccountStatus } from '@prisma/client';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateChannelAccountDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  externalAccountId?: string;

  @IsOptional()
  configuration?: Record<string, any>;
}

export class UpdateChannelAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ChannelAccountStatus)
  @IsOptional()
  status?: ChannelAccountStatus;

  @IsOptional()
  configuration?: Record<string, any>;
}

export class PublishProductDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  channelAccountId: string;

  @IsNumber()
  @IsOptional()
  priceOverride?: number;
}

export class MapCategoryDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  externalCategoryId: string;

  @IsString()
  @IsNotEmpty()
  externalCategoryName: string;
}

export class CompleteOAuthDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  channelAccountId?: string;

  @IsString()
  @IsOptional()
  accountName?: string;
}

export class ValidateProductDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  channelAccountId: string;

  @IsNumber()
  @IsOptional()
  priceOverride?: number;
}
