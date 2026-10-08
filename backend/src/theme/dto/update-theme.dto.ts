import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ThemeStatus } from '@prisma/client';

export class UpdateThemeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ThemeStatus)
  @IsOptional()
  status?: ThemeStatus;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  primaryColor?: string;

  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  font?: string;

  @IsString()
  @IsOptional()
  buttonStyle?: string;

  @IsString()
  @IsOptional()
  cardStyle?: string;

  @IsString()
  @IsOptional()
  bannerStyle?: string;

  @IsInt()
  @Min(1)
  @Max(6)
  @IsOptional()
  productsPerRow?: number;

  @IsBoolean()
  @IsOptional()
  showCategories?: boolean;

  @IsBoolean()
  @IsOptional()
  showHighlights?: boolean;

  @IsBoolean()
  @IsOptional()
  showNewProducts?: boolean;

  @IsBoolean()
  @IsOptional()
  showOffers?: boolean;

  @IsBoolean()
  @IsOptional()
  isPreset?: boolean;
}
