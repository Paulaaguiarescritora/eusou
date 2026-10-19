import {
  IsArray,
  IsUUID,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChannelAssignmentItemDto {
  @IsUUID()
  channelId: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class AssignProductChannelsDto {
  /**
   * Suporta lista simples de IDs de canais (ex: ["uuid-1", "uuid-2"])
   * ou itens detalhados com flag isEnabled.
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  channelIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelAssignmentItemDto)
  channels?: ChannelAssignmentItemDto[];
}
