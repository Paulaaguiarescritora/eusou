import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreateAffiliateLinkDto {
  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  catalogId?: string;

  @IsUUID()
  @IsOptional()
  collectionId?: string;
}

export class UpdateAffiliateLinkDto {
  @IsString()
  @IsOptional()
  destination?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
