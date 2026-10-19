import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DryRunDto {
  @IsString()
  @IsNotEmpty()
  fileBase64: string;

  @IsString()
  @IsOptional()
  fileName?: string;
}

export class ExecuteImportDto {
  @IsString()
  @IsNotEmpty()
  importToken: string;
}
