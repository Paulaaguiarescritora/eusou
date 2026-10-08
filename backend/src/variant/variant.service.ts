import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ProductVariant } from '@prisma/client';

@Injectable()
export class VariantService {
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

  async create(
    productId: string,
    dto: CreateVariantDto,
    actorId?: string,
  ): Promise<ProductVariant> {
    await this.assertProductExists(productId);

    if (dto.sku) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: dto.sku.trim() },
      });
      if (existingSku)
        throw new ConflictException(
          `Variant with SKU "${dto.sku}" already exists`,
        );
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name?.trim() || null,
        sku: dto.sku?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.auditLog.log({
      action: 'VARIANT_CREATED',
      entity: 'ProductVariant',
      entityId: variant.id,
      userId: actorId ?? null,
      metadata: { productId, name: variant.name, sku: variant.sku },
    });

    return variant;
  }

  async findAll(productId: string) {
    await this.assertProductExists(productId);
    return this.prisma.productVariant.findMany({
      where: { productId },
      include: {
        variantAttributeValues: {
          include: {
            productAttributeValue: { include: { attributeDefinition: true } },
          },
        },
      },
    });
  }

  async findById(
    productId: string,
    variantId: string,
  ): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      include: {
        variantAttributeValues: {
          include: {
            productAttributeValue: { include: { attributeDefinition: true } },
          },
        },
      },
    });
    if (!variant)
      throw new NotFoundException(
        `Variant "${variantId}" not found for product "${productId}"`,
      );
    return variant;
  }

  async update(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    actorId?: string,
  ): Promise<ProductVariant> {
    await this.assertProductExists(productId);
    const variant = await this.findById(productId, variantId);

    const updateData: any = {};
    const updatedFields: string[] = [];

    if (dto.name !== undefined) {
      updateData.name = dto.name?.trim() || null;
      updatedFields.push('name');
    }

    if (dto.sku !== undefined) {
      const targetSku = dto.sku?.trim() || null;
      if (targetSku && targetSku !== variant.sku) {
        const existing = await this.prisma.productVariant.findUnique({
          where: { sku: targetSku },
        });
        if (existing)
          throw new ConflictException(
            `Variant with SKU "${targetSku}" already exists`,
          );
      }
      updateData.sku = targetSku;
      updatedFields.push('sku');
    }

    const isDeactivating =
      dto.isActive !== undefined &&
      dto.isActive === false &&
      variant.isActive === true;
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
      updatedFields.push('isActive');
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });

    await this.auditLog.log({
      action: isDeactivating ? 'VARIANT_DEACTIVATED' : 'VARIANT_UPDATED',
      entity: 'ProductVariant',
      entityId: variantId,
      userId: actorId ?? null,
      metadata: { productId, updatedFields },
    });

    return updated;
  }

  async delete(
    productId: string,
    variantId: string,
    actorId?: string,
  ): Promise<{ message: string }> {
    await this.assertProductExists(productId);
    await this.findById(productId, variantId);

    // Soft delete: set isActive = false
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    });

    await this.auditLog.log({
      action: 'VARIANT_DEACTIVATED',
      entity: 'ProductVariant',
      entityId: variantId,
      userId: actorId ?? null,
      metadata: { productId },
    });

    return { message: 'Variant deactivated successfully' };
  }

  // ---- Variant Attribute Values ----

  async addAttribute(
    productId: string,
    variantId: string,
    productAttributeValueId: string,
    actorId?: string,
  ) {
    await this.assertProductExists(productId);
    const variant = await this.findById(productId, variantId);

    // Assert the PAV belongs to the same product
    const pav = await this.prisma.productAttributeValue.findFirst({
      where: { id: productAttributeValueId, productId },
    });
    if (!pav) {
      throw new BadRequestException(
        `ProductAttributeValue "${productAttributeValueId}" does not belong to product "${productId}"`,
      );
    }

    // Assert no duplicate AttributeDefinition in same variant
    const existingDef = (variant as any).variantAttributeValues?.find(
      (vav: any) =>
        vav.productAttributeValue?.attributeDefinitionId ===
        pav.attributeDefinitionId,
    );
    if (existingDef) {
      throw new ConflictException(
        `Variant already has a value for this attribute definition`,
      );
    }

    // Check for duplicate combination across all variants of same product
    // Build the complete would-be attribute set for this variant
    const currentPavIds = ((variant as any).variantAttributeValues || []).map(
      (vav: any) => vav.productAttributeValueId,
    );
    const newPavIds = [...currentPavIds, productAttributeValueId].sort();

    // Get all other variants of same product with their attribute value sets
    const otherVariants = await this.prisma.productVariant.findMany({
      where: { productId, id: { not: variantId } },
      include: { variantAttributeValues: true },
    });

    for (const ov of otherVariants) {
      const ovPavIds = ov.variantAttributeValues
        .map((vav) => vav.productAttributeValueId)
        .sort();
      if (JSON.stringify(ovPavIds) === JSON.stringify(newPavIds)) {
        throw new ConflictException(
          `Another variant already has the same combination of attributes`,
        );
      }
    }

    const vav = await this.prisma.variantAttributeValue.create({
      data: { variantId, productAttributeValueId },
    });

    await this.auditLog.log({
      action: 'VARIANT_ATTRIBUTE_ADDED',
      entity: 'VariantAttributeValue',
      entityId: vav.id,
      userId: actorId ?? null,
      metadata: { productId, variantId, productAttributeValueId },
    });

    return vav;
  }

  async removeAttribute(
    productId: string,
    variantId: string,
    attributeValueId: string,
    actorId?: string,
  ) {
    await this.assertProductExists(productId);
    await this.findById(productId, variantId);

    const vav = await this.prisma.variantAttributeValue.findFirst({
      where: { id: attributeValueId, variantId },
    });
    if (!vav)
      throw new NotFoundException(
        `VariantAttributeValue "${attributeValueId}" not found`,
      );

    await this.prisma.variantAttributeValue.delete({
      where: { id: attributeValueId },
    });

    await this.auditLog.log({
      action: 'VARIANT_ATTRIBUTE_REMOVED',
      entity: 'VariantAttributeValue',
      entityId: attributeValueId,
      userId: actorId ?? null,
      metadata: { productId, variantId },
    });

    return { message: 'Variant attribute removed successfully' };
  }
}
