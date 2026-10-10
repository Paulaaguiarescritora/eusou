import { Injectable } from '@nestjs/common';

export interface HubValidationMessage {
  field?: string;
  code: string;
  message: string;
}

export interface HubValidationResult {
  isValid: boolean;
  errors: HubValidationMessage[];
  warnings: HubValidationMessage[];
  info: HubValidationMessage[];
}

export interface HubValidationOptions {
  channelType?: string;
  externalCategoryId?: string;
  requiredAttributeSlugs?: string[];
  resolvedPrice?: number;
  availableStock?: number;
}

@Injectable()
export class HubValidatorService {
  /**
   * Validação multi-nível agnóstica para publicação e sincronização em Marketplaces
   */
  validateForPublication(
    product: any,
    options?: HubValidationOptions,
  ): HubValidationResult {
    const errors: HubValidationMessage[] = [];
    const warnings: HubValidationMessage[] = [];
    const info: HubValidationMessage[] = [];

    // 1. Validação básica de existência do produto
    if (!product) {
      return {
        isValid: false,
        errors: [{ code: 'PRODUCT_REQUIRED', message: 'Produto não informado.' }],
        warnings: [],
        info: [],
      };
    }

    // 2. Status do produto no EuSou
    if (product.status && product.status !== 'ACTIVE') {
      errors.push({
        field: 'status',
        code: 'PRODUCT_NOT_ACTIVE',
        message: `Produto não está ativo no sistema EuSou (status atual: ${product.status}).`,
      });
    }

    // 3. Título / Nome
    const name = product.name?.trim() || '';
    if (!name || name.length < 5) {
      errors.push({
        field: 'name',
        code: 'TITLE_TOO_SHORT',
        message: 'Título do produto deve possuir no mínimo 5 caracteres.',
      });
    } else if (name.length > 60) {
      warnings.push({
        field: 'name',
        code: 'TITLE_TOO_LONG',
        message: `Título possui ${name.length} caracteres e pode ser truncado para o limite de 60 do canal.`,
      });
    }

    // 4. SKU
    if (!product.sku || product.sku.trim() === '') {
      warnings.push({
        field: 'sku',
        code: 'SKU_MISSING',
        message: `Produto não possui SKU próprio; será gerado fallback automático baseado no ID.`,
      });
    }

    // 5. Categoria mapeada
    if (!options?.externalCategoryId) {
      errors.push({
        field: 'externalCategoryId',
        code: 'CATEGORY_MAPPING_MISSING',
        message: 'Categoria externa do canal não mapeada para este produto ou sua categoria.',
      });
    }

    // 6. Preço
    const effectivePrice =
      options?.resolvedPrice !== undefined && options?.resolvedPrice !== null
        ? Number(options.resolvedPrice)
        : Number(product.basePrice || product.price || 0);

    if (isNaN(effectivePrice) || effectivePrice <= 0) {
      errors.push({
        field: 'price',
        code: 'PRICE_INVALID',
        message: 'Preço do produto deve ser maior que zero.',
      });
    } else if (effectivePrice < 5) {
      warnings.push({
        field: 'price',
        code: 'PRICE_VERY_LOW',
        message: `Preço (R$ ${effectivePrice.toFixed(2)}) é muito baixo e taxas fixas de marketplace podem superar a margem.`,
      });
    }

    // 7. Imagens
    const images: string[] = [];
    if (product.media && Array.isArray(product.media)) {
      for (const m of product.media) {
        if (m.url && (m.url.startsWith('http://') || m.url.startsWith('https://'))) {
          images.push(m.url);
        }
      }
    }

    if (images.length === 0) {
      errors.push({
        field: 'media',
        code: 'IMAGES_REQUIRED',
        message: 'O canal exige pelo menos 1 imagem pública (HTTP/HTTPS) cadastrada no produto.',
      });
    } else {
      info.push({
        field: 'media',
        code: 'IMAGES_COUNT',
        message: `${images.length} imagem(ns) pública(s) válidas identificadas.`,
      });
    }

    // 8. Estoque disponível
    let stock = 0;
    if (options?.availableStock !== undefined && options?.availableStock !== null) {
      stock = Number(options.availableStock);
    } else if (product.inventories && Array.isArray(product.inventories)) {
      stock = product.inventories.reduce(
        (sum: number, inv: any) =>
          sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)),
        0,
      );
    } else if (product.stockQuantity !== undefined) {
      stock = Number(product.stockQuantity);
    } else {
      stock = 10; // Fallback sob demanda
    }

    if (stock < 0) {
      errors.push({
        field: 'stock',
        code: 'STOCK_NEGATIVE',
        message: 'Estoque disponível não pode ser negativo.',
      });
    } else if (stock === 0) {
      warnings.push({
        field: 'stock',
        code: 'STOCK_ZERO',
        message: 'Estoque disponível é 0. O anúncio poderá ser publicado pausado no canal.',
      });
    }

    // 9. Atributos obrigatórios do canal
    if (options?.requiredAttributeSlugs && options.requiredAttributeSlugs.length > 0) {
      const existingAttrSlugs = new Set<string>();
      if (product.attributeValues && Array.isArray(product.attributeValues)) {
        for (const av of product.attributeValues) {
          if (av.attributeDefinition?.slug) {
            existingAttrSlugs.add(av.attributeDefinition.slug.toLowerCase());
          }
        }
      }

      for (const req of options.requiredAttributeSlugs) {
        if (!existingAttrSlugs.has(req.toLowerCase())) {
          warnings.push({
            field: 'attributes',
            code: 'MANDATORY_ATTRIBUTE_MISSING',
            message: `Atributo obrigatório ou recomendado do canal não preenchido: ${req}`,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info,
    };
  }
}
