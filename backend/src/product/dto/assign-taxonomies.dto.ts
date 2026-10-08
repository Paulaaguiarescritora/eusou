import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class AssignNichesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  nicheIds: string[];
}

export class AssignCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  categoryIds: string[];
}

export class AssignTagsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  tagIds: string[];
}
