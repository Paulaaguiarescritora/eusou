import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateProductAttributeDto {
  @IsString()
  @IsNotEmpty()
  attributeDefinitionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  value: string;
}
