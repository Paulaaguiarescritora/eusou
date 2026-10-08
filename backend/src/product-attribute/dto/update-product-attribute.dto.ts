import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateProductAttributeDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  value?: string;
}
