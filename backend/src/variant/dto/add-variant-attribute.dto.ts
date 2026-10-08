import { IsString, IsNotEmpty } from 'class-validator';

export class AddVariantAttributeDto {
  @IsString()
  @IsNotEmpty()
  productAttributeValueId: string;
}
