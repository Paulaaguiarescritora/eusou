import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { InventoryService } from '../inventory/inventory.service';
import { CostResolverService } from '../pricing/services/cost-resolver.service';
import { ProductionService } from '../production/production.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ProductVariant, Prisma } from '@prisma/client';

@Injectable()
export class VariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Optional() private readonly inventoryService?: InventoryService,
    @Optional() private readonly costResolver?: CostResolverService,
    @Optional() private readonly productionService?: ProductionService,
  ) {}

  private async enrichVariant(variant: any, productId: string, cachedBaseProfile?: any) {
    const inventories = variant.inventories || [];
    const stock = inventories.reduce(
      (sum: number, inv: any) => sum + (inv.quantity || 0),
      0,
    );
    const reservedStock = inventories.reduce(
      (sum: number, inv: any) => sum + (inv.reservedQuantity || 0),
      0,
    );
    const availableStock = Math.max(0, stock - reservedStock);

    let materialId: string | null = null;
    let materialName: string | null = null;
    let materialCostPerUnit: number | null = null;
    let isMaterialCustom = false;

    const activeVariantProfile = (variant.productionProfiles || []).find(
      (p: any) => p.isActive,
    );

    if (activeVariantProfile && activeVariantProfile.materials?.length > 0) {
      const customMat =
        activeVariantProfile.materials.find(
          (pm: any) =>
            pm.material?.category === 'PRODUCTION' ||
            (!pm.material?.category &&
              ['PLA', 'PETG', 'ABS', 'RESIN'].includes(pm.material?.type)),
        ) || activeVariantProfile.materials[0];

      if (customMat?.material) {
        materialId = customMat.material.id;
        materialName = customMat.material.name;
        materialCostPerUnit = Number(customMat.material.costPerUnit);
        isMaterialCustom = true;
      }
    }

    let baseProfile = cachedBaseProfile;
    if (!isMaterialCustom) {
      if (baseProfile === undefined && this.prisma.productionProfile?.findFirst) {
        baseProfile = await this.prisma.productionProfile.findFirst({
          where: { productId, variantId: null, isActive: true },
          orderBy: { createdAt: 'desc' },
          include: {
            materials: { include: { material: true } },
          },
        });
      }

      if (baseProfile && baseProfile.materials?.length > 0) {
        const baseMat =
          baseProfile.materials.find(
            (pm: any) =>
              pm.material?.category === 'PRODUCTION' ||
              (!pm.material?.category &&
                ['PLA', 'PETG', 'ABS', 'RESIN'].includes(pm.material?.type)),
          ) || baseProfile.materials[0];

        if (baseMat?.material) {
          materialId = baseMat.material.id;
          materialName = baseMat.material.name;
          materialCostPerUnit = Number(baseMat.material.costPerUnit);
          isMaterialCustom = false;
        }
      }
    }

    // F7 Production Cost (Filamento + Máquina + Materiais Adicionais + Embalagem)
    let productionCost: number | null = null;
    const targetProfileId = activeVariantProfile?.id || baseProfile?.id;
    if (targetProfileId && this.productionService) {
      try {
        const est = await this.productionService.calculateEstimatedCost(targetProfileId);
        if (est && est.totalCost > 0) {
          productionCost = Number(est.totalCost.toFixed(2));
        }
      } catch {
        // graceful fallback
      }
    }

    if (productionCost === null && this.costResolver) {
      try {
        const costRes = await this.costResolver.resolveCost(productId, variant.id);
        if (costRes && costRes.source !== 'NONE' && costRes.cost) {
          productionCost = Number(costRes.cost);
        }
      } catch {
        // graceful fallback
      }
    }

    return {
      ...variant,
      stock,
      reservedStock,
      availableStock,
      productionCost,
      materialId,
      materialName,
      materialCostPerUnit,
      isMaterialCustom,
    };
  }

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product)
      throw new NotFoundException(`Product "${productId}" not found`);
    return product;
  }

  async syncVariantMaterial(
    productId: string,
    variantId: string,
    materialId?: string | null,
    actorId?: string,
  ) {
    if (materialId === undefined) {
      return;
    }

    if (!materialId || materialId.trim() === '') {
      // Inactivate any variant-specific profile
      if (this.prisma.productionProfile?.updateMany) {
        await this.prisma.productionProfile.updateMany({
          where: { variantId, isActive: true },
          data: { isActive: false },
        });
      }
      return;
    }

    // Verify material exists
    if (!this.prisma.material?.findUnique) return;
    const material = await this.prisma.material.findUnique({
      where: { id: materialId.trim() },
    });
    if (!material) {
      throw new NotFoundException(`Material "${materialId}" não encontrado.`);
    }

    // Fetch product's base profile
    const baseProfile = this.prisma.productionProfile?.findFirst
      ? await this.prisma.productionProfile.findFirst({
          where: { productId, variantId: null, isActive: true },
          orderBy: { createdAt: 'desc' },
          include: {
            materials: { include: { material: true } },
          },
        })
      : null;

    // Check if variant profile exists
    const existingVariantProfile = this.prisma.productionProfile?.findFirst
      ? await this.prisma.productionProfile.findFirst({
          where: { variantId },
        })
      : null;

    const newMaterials: Array<{
      materialId: string;
      quantity: number;
      unit: any;
      notes?: string | null;
    }> = [];

    if (baseProfile && baseProfile.materials && baseProfile.materials.length > 0) {
      let filamentReplaced = false;
      for (const pm of baseProfile.materials) {
        const isFilament =
          pm.material?.category === 'PRODUCTION' ||
          (!pm.material?.category &&
            ['PLA', 'PETG', 'ABS', 'RESIN'].includes(pm.material?.type));

        if (isFilament && !filamentReplaced) {
          newMaterials.push({
            materialId: material.id,
            quantity: Number(pm.quantity),
            unit: pm.unit,
            notes: pm.notes,
          });
          filamentReplaced = true;
        } else {
          newMaterials.push({
            materialId: pm.materialId,
            quantity: Number(pm.quantity),
            unit: pm.unit,
            notes: pm.notes,
          });
        }
      }
      if (!filamentReplaced) {
        newMaterials.unshift({
          materialId: material.id,
          quantity: Number(baseProfile.materialWeightGrams || 0),
          unit: 'GRAM',
          notes: null,
        });
      }
    } else {
      newMaterials.push({
        materialId: material.id,
        quantity: baseProfile ? Number(baseProfile.materialWeightGrams || 0) : 0,
        unit: 'GRAM',
        notes: null,
      });
    }

    const profileData = {
      productId,
      variantId,
      printerId: baseProfile?.printerId || null,
      productionMode: baseProfile?.productionMode || 'STOCK',
      productionTimeMinutes: baseProfile?.productionTimeMinutes || 0,
      productionTimeSeconds: baseProfile?.productionTimeSeconds || 0,
      materialWeightGrams: baseProfile?.materialWeightGrams || 0,
      powerConsumptionWatts: baseProfile?.powerConsumptionWatts || 0,
      finishingTimeMinutes: baseProfile?.finishingTimeMinutes || 0,
      finishingCost: baseProfile?.finishingCost || 0,
      packagingCost: baseProfile?.packagingCost || 0,
      laborCost: baseProfile?.laborCost || 0,
      notes: baseProfile?.notes || `Perfil específico da variante ${variantId}`,
      isActive: true,
    };

    if (existingVariantProfile) {
      await this.prisma.$transaction(async (tx) => {
        await tx.productionMaterial.deleteMany({
          where: { productionProfileId: existingVariantProfile.id },
        });
        await tx.productionProfile.update({
          where: { id: existingVariantProfile.id },
          data: {
            ...profileData,
            materials: {
              create: newMaterials.map((m) => ({
                materialId: m.materialId,
                quantity: m.quantity,
                unit: m.unit,
                notes: m.notes,
              })),
            },
          },
        });
      });
    } else {
      await this.prisma.productionProfile.create({
        data: {
          ...profileData,
          materials: {
            create: newMaterials.map((m) => ({
              materialId: m.materialId,
              quantity: m.quantity,
              unit: m.unit,
              notes: m.notes,
            })),
          },
        },
      });
    }
  }

  async create(
    productId: string,
    dto: CreateVariantDto,
    actorId?: string,
  ): Promise<any> {
    await this.assertProductExists(productId);

    if (dto.sku !== undefined && dto.sku !== null) {
      const trimmedSku = dto.sku.trim();
      if (!trimmedSku) {
        throw new BadRequestException('SKU da variante não pode ser vazio.');
      }
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: trimmedSku },
      });
      if (existingSku)
        throw new ConflictException(
          `Variant with SKU "${dto.sku}" already exists`,
        );
    }

    if (dto.price !== undefined && dto.price !== null && Number(dto.price) < 0) {
      throw new BadRequestException('Preço da variante deve ser positivo.');
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name?.trim() || null,
        sku: dto.sku?.trim() || null,
        price:
          dto.price !== undefined && dto.price !== null
            ? new Prisma.Decimal(dto.price.toString())
            : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    if (dto.stock !== undefined && dto.stock !== null && this.inventoryService) {
      await this.inventoryService.adjustStock(
        {
          productId,
          variantId: variant.id,
          quantity: Number(dto.stock),
          mode: 'SET',
          reason: `Estoque inicial da variante ${variant.sku || variant.id}`,
        },
        actorId,
      );
    }

    if (dto.materialId !== undefined) {
      await this.syncVariantMaterial(productId, variant.id, dto.materialId, actorId);
    }

    await this.auditLog.log({
      action: 'VARIANT_CREATED',
      entity: 'ProductVariant',
      entityId: variant.id,
      userId: actorId ?? null,
      metadata: { productId, name: variant.name, sku: variant.sku },
    });

    return this.findById(productId, variant.id);
  }

  async findAll(productId: string, activeOnly = false) {
    await this.assertProductExists(productId);
    const [variants, baseProfile] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: {
          productId,
          ...(activeOnly ? { isActive: true } : {}),
        },
        include: {
          inventories: true,
          productionProfiles: {
            where: { isActive: true },
            include: {
              materials: { include: { material: true } },
              printer: true,
            },
          },
          variantAttributeValues: {
            include: {
              productAttributeValue: { include: { attributeDefinition: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productionProfile?.findFirst
        ? this.prisma.productionProfile.findFirst({
            where: { productId, variantId: null, isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
              materials: { include: { material: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    return Promise.all(variants.map((v) => this.enrichVariant(v, productId, baseProfile)));
  }

  async findActive(productId: string) {
    return this.findAll(productId, true);
  }

  async findById(
    productId: string,
    variantId: string,
  ): Promise<any> {
    const [variant, baseProfile] = await Promise.all([
      this.prisma.productVariant.findFirst({
        where: { id: variantId, productId },
        include: {
          inventories: true,
          productionProfiles: {
            where: { isActive: true },
            include: {
              materials: { include: { material: true } },
              printer: true,
            },
          },
          variantAttributeValues: {
            include: {
              productAttributeValue: { include: { attributeDefinition: true } },
            },
          },
        },
      }),
      this.prisma.productionProfile?.findFirst
        ? this.prisma.productionProfile.findFirst({
            where: { productId, variantId: null, isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
              materials: { include: { material: true } },
            },
          })
        : Promise.resolve(null),
    ]);
    if (!variant)
      throw new NotFoundException(
        `Variant "${variantId}" not found for product "${productId}"`,
      );
    return this.enrichVariant(variant, productId, baseProfile);
  }

  async update(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    actorId?: string,
  ): Promise<any> {
    await this.assertProductExists(productId);
    const variant = await this.findById(productId, variantId);

    const updateData: any = {};
    const updatedFields: string[] = [];

    if (dto.name !== undefined) {
      const trimmedName = dto.name !== null ? dto.name.trim() : '';
      if (!trimmedName) {
        throw new BadRequestException('Nome/rótulo da variante não pode ser vazio.');
      }
      updateData.name = trimmedName;
      updatedFields.push('name');
    }

    if (dto.sku !== undefined) {
      const targetSku = dto.sku !== null ? dto.sku.trim() : '';
      if (!targetSku) {
        throw new BadRequestException('SKU da variante não pode ser vazio.');
      }
      if (targetSku !== variant.sku) {
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

    if (dto.price !== undefined) {
      if (dto.price !== null && Number(dto.price) < 0) {
        throw new BadRequestException('Preço da variante deve ser positivo.');
      }
      updateData.price =
        dto.price !== null && dto.price !== undefined
          ? new Prisma.Decimal(dto.price.toString())
          : null;
      updatedFields.push('price');
    }

    const isDeactivating =
      dto.isActive !== undefined &&
      dto.isActive === false &&
      variant.isActive === true;
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
      updatedFields.push('isActive');
    }

    if (dto.stock !== undefined && dto.stock !== null && this.inventoryService) {
      await this.inventoryService.adjustStock(
        {
          productId,
          variantId,
          quantity: Number(dto.stock),
          mode: 'SET',
          reason: `Ajuste manual de estoque da variante ${variant.sku || variantId}`,
        },
        actorId,
      );
      updatedFields.push('stock');
    }

    if (dto.materialId !== undefined) {
      await this.syncVariantMaterial(productId, variantId, dto.materialId, actorId);
      updatedFields.push('materialId');
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

    return this.findById(productId, variantId);
  }

  async delete(
    productId: string,
    variantId: string,
    actorId?: string,
  ): Promise<{ message: string; variant: ProductVariant }> {
    await this.assertProductExists(productId);
    await this.findById(productId, variantId);

    // Soft delete: set isActive = false
    const updated = await this.prisma.productVariant.update({
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

    return { message: 'Variant deactivated successfully', variant: updated };
  }

  async archive(
    productId: string,
    variantId: string,
    actorId?: string,
  ): Promise<ProductVariant> {
    const res = await this.delete(productId, variantId, actorId);
    return res.variant;
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
