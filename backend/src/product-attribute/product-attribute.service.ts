import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';
import { ProductAttributeValue } from '@prisma/client';

@Injectable()
export class ProductAttributeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product)
      throw new NotFoundException(`Product "${productId}" not found`);
    return product;
  }

  private async assertAttributeActive(attributeDefinitionId: string) {
    const attr = await this.prisma.attributeDefinition.findUnique({
      where: { id: attributeDefinitionId },
    });
    if (!attr)
      throw new NotFoundException(
        `AttributeDefinition "${attributeDefinitionId}" not found`,
      );
    if (!attr.isActive)
      throw new BadRequestException(
        `AttributeDefinition "${attributeDefinitionId}" is not active`,
      );
    return attr;
  }

  async create(
    productId: string,
    dto: CreateProductAttributeDto,
    actorId?: string,
  ): Promise<ProductAttributeValue> {
    await this.assertProductExists(productId);
    await this.assertAttributeActive(dto.attributeDefinitionId);

    const existing = await this.prisma.productAttributeValue.findFirst({
      where: {
        productId,
        attributeDefinitionId: dto.attributeDefinitionId,
        value: dto.value.trim(),
      },
    });
    if (existing) {
      throw new ConflictException(
        `Attribute value already exists for this product`,
      );
    }

    const pav = await this.prisma.productAttributeValue.create({
      data: {
        productId,
        attributeDefinitionId: dto.attributeDefinitionId,
        value: dto.value.trim(),
      },
    });

    await this.auditLog.log({
      action: 'PRODUCT_ATTRIBUTE_CREATED',
      entity: 'ProductAttributeValue',
      entityId: pav.id,
      userId: actorId ?? null,
      metadata: {
        productId,
        attributeDefinitionId: dto.attributeDefinitionId,
        value: pav.value,
      },
    });

    return pav;
  }

  async findAll(productId: string): Promise<ProductAttributeValue[]> {
    await this.assertProductExists(productId);
    return this.prisma.productAttributeValue.findMany({
      where: { productId },
      include: { attributeDefinition: true },
    });
  }

  async update(
    productId: string,
    id: string,
    dto: UpdateProductAttributeDto,
    actorId?: string,
  ): Promise<ProductAttributeValue> {
    await this.assertProductExists(productId);

    const pav = await this.prisma.productAttributeValue.findFirst({
      where: { id, productId },
    });
    if (!pav)
      throw new NotFoundException(
        `ProductAttributeValue "${id}" not found for product "${productId}"`,
      );

    if (dto.value !== undefined) {
      const conflict = await this.prisma.productAttributeValue.findFirst({
        where: {
          productId,
          attributeDefinitionId: pav.attributeDefinitionId,
          value: dto.value.trim(),
          NOT: { id },
        },
      });
      if (conflict)
        throw new ConflictException(
          `Attribute value already exists for this product`,
        );
    }

    const updated = await this.prisma.productAttributeValue.update({
      where: { id },
      data: { value: dto.value?.trim() ?? pav.value },
    });

    await this.auditLog.log({
      action: 'PRODUCT_ATTRIBUTE_UPDATED',
      entity: 'ProductAttributeValue',
      entityId: id,
      userId: actorId ?? null,
      metadata: { productId, updatedFields: Object.keys(dto) },
    });

    return updated;
  }

  async delete(
    productId: string,
    id: string,
    actorId?: string,
  ): Promise<{ message: string }> {
    await this.assertProductExists(productId);

    const pav = await this.prisma.productAttributeValue.findFirst({
      where: { id, productId },
    });
    if (!pav)
      throw new NotFoundException(
        `ProductAttributeValue "${id}" not found for product "${productId}"`,
      );

    // Remove variant attribute values referencing this first
    await this.prisma.variantAttributeValue.deleteMany({
      where: { productAttributeValueId: id },
    });
    await this.prisma.productAttributeValue.delete({ where: { id } });

    await this.auditLog.log({
      action: 'PRODUCT_ATTRIBUTE_DELETED',
      entity: 'ProductAttributeValue',
      entityId: id,
      userId: actorId ?? null,
      metadata: { productId },
    });

    return { message: 'Product attribute deleted successfully' };
  }
}
