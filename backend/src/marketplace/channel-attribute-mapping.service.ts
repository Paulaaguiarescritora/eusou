import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAttributeMappingDto } from './dto/marketplace.dto';

@Injectable()
export class ChannelAttributeMappingService {
  private readonly logger = new Logger(ChannelAttributeMappingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista mapeamentos por canal e opcionalmente categoria
   */
  async listMappings(channelId: string, externalCategoryId?: string) {
    return this.prisma.channelAttributeMapping.findMany({
      where: {
        channelId,
        externalCategoryId: externalCategoryId || undefined,
      },
      include: {
        attributeDefinition: true,
        channel: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Salva ou atualiza um mapeamento de atributo (Upsert)
   */
  async upsertMapping(dto: CreateAttributeMappingDto) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: dto.channelId },
    });
    if (!channel) {
      throw new NotFoundException(`Canal com ID "${dto.channelId}" não encontrado.`);
    }

    const attrDef = await this.prisma.attributeDefinition.findUnique({
      where: { id: dto.attributeDefinitionId },
    });
    if (!attrDef) {
      throw new NotFoundException(
        `AttributeDefinition com ID "${dto.attributeDefinitionId}" não encontrado.`,
      );
    }

    const externalCategoryId = dto.externalCategoryId || null;

    const existing = await this.prisma.channelAttributeMapping.findFirst({
      where: {
        channelId: dto.channelId,
        externalCategoryId,
        attributeDefinitionId: dto.attributeDefinitionId,
      },
    });

    if (existing) {
      return this.prisma.channelAttributeMapping.update({
        where: { id: existing.id },
        data: {
          externalAttributeId: dto.externalAttributeId,
          externalAttributeName: dto.externalAttributeName,
          isRequired: dto.isRequired !== undefined ? dto.isRequired : existing.isRequired,
          defaultValue: dto.defaultValue !== undefined ? dto.defaultValue : existing.defaultValue,
          valueMapping: (dto.valueMapping !== undefined ? dto.valueMapping : existing.valueMapping) as any,
        },
        include: {
          attributeDefinition: true,
          channel: true,
        },
      });
    }

    return this.prisma.channelAttributeMapping.create({
      data: {
        channelId: dto.channelId,
        externalCategoryId,
        attributeDefinitionId: dto.attributeDefinitionId,
        externalAttributeId: dto.externalAttributeId,
        externalAttributeName: dto.externalAttributeName,
        isRequired: dto.isRequired || false,
        defaultValue: dto.defaultValue,
        valueMapping: dto.valueMapping,
      },
      include: {
        attributeDefinition: true,
        channel: true,
      },
    });
  }

  /**
   * Deleta mapeamento
   */
  async deleteMapping(id: string) {
    const existing = await this.prisma.channelAttributeMapping.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Mapeamento de atributo "${id}" não encontrado.`);
    }
    return this.prisma.channelAttributeMapping.delete({ where: { id } });
  }

  /**
   * Resolve atributos do produto aplicando os mapeamentos cadastrados
   */
  async resolveMappedAttributes(
    channelId: string,
    product: any,
    externalCategoryId?: string,
  ): Promise<Record<string, string>> {
    const mappings = await this.prisma.channelAttributeMapping.findMany({
      where: {
        channelId,
        OR: [
          { externalCategoryId: externalCategoryId || null },
          { externalCategoryId: null },
        ],
      },
      include: { attributeDefinition: true },
    });

    const resolved: Record<string, string> = {};

    // Mapeia os valores atuais do produto por attributeDefinitionId
    const productAttrMap = new Map<string, string>();
    if (product.attributeValues && Array.isArray(product.attributeValues)) {
      for (const av of product.attributeValues) {
        if (av.attributeDefinitionId && av.value) {
          productAttrMap.set(av.attributeDefinitionId, av.value);
        }
      }
    }

    for (const mapping of mappings) {
      const val = productAttrMap.get(mapping.attributeDefinitionId);
      const targetAttrId = mapping.externalAttributeId;

      if (val) {
        // Verifica se há mapeamento de valor específico (ex: "Azul" -> "BLUE")
        let finalVal = val;
        if (mapping.valueMapping && typeof mapping.valueMapping === 'object') {
          const dict = mapping.valueMapping as Record<string, string>;
          if (dict[val]) {
            finalVal = dict[val];
          }
        }
        resolved[targetAttrId] = finalVal;
      } else if (mapping.defaultValue) {
        resolved[targetAttrId] = mapping.defaultValue;
      }
    }

    return resolved;
  }
}
