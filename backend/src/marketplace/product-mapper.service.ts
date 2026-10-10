import { Injectable } from '@nestjs/common';
import { ExternalProductPayload } from './marketplace-connector.interface';

@Injectable()
export class ProductMapperService {
  /**
   * Converte um produto interno do EuSou no payload padronizado aceito pelos conectores de marketplaces.
   */
  mapToExternalPayload(
    product: any,
    options?: {
      priceOverride?: number;
      resolvedEffectivePrice?: number;
      availableStock?: number;
      externalCategoryId?: string;
      customAttributes?: Record<string, string>;
    },
  ): ExternalProductPayload {
    // 1. Extração de atributos de variantes ou dinâmicos
    const attributes: Record<string, string> = {
      ...(options?.customAttributes || {}),
    };

    if (product.attributeValues && Array.isArray(product.attributeValues)) {
      for (const attr of product.attributeValues) {
        const key =
          attr.attributeDefinition?.name ||
          attr.attributeDefinition?.slug ||
          'attr';
        attributes[key] = attr.value;
      }
    }

    // 2. Extração de imagens
    const images: string[] = [];
    if (product.media && Array.isArray(product.media)) {
      for (const m of product.media) {
        if (m.url) images.push(m.url);
      }
    }

    // 3. Preço efetivo (Prioridade: priceOverride explícito > resolvedEffectivePrice do F12 > basePrice > price)
    let price = 0;
    if (options?.priceOverride !== undefined && options?.priceOverride !== null) {
      price = Number(options.priceOverride);
    } else if (options?.resolvedEffectivePrice !== undefined && options?.resolvedEffectivePrice !== null) {
      price = Number(options.resolvedEffectivePrice);
    } else {
      price = Number(product.basePrice || product.price || 0);
    }

    // 4. Quantidade de estoque total (Prioridade: availableStock explícito > inventários F7 > stockQuantity)
    let stockQuantity = 0;
    if (options?.availableStock !== undefined && options?.availableStock !== null) {
      stockQuantity = Number(options.availableStock);
    } else if (product.inventories && Array.isArray(product.inventories)) {
      stockQuantity = product.inventories.reduce(
        (sum: number, inv: any) =>
          sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)),
        0,
      );
    } else if (product.stockQuantity !== undefined) {
      stockQuantity = Number(product.stockQuantity);
    } else {
      stockQuantity = 10; // Fallback para itens sob demanda
    }

    return {
      sku: product.sku || `SKU-${product.id}`,
      title: product.name || 'Produto sem título',
      description: product.description || '',
      price,
      currency: 'BRL',
      stockQuantity,
      categoryExternalId: options?.externalCategoryId,
      attributes,
      images,
      dimensions: {
        weight: product.weight ? Number(product.weight) : undefined,
        height: product.height ? Number(product.height) : undefined,
        width: product.width ? Number(product.width) : undefined,
        length: product.length ? Number(product.length) : undefined,
      },
      metadata: {
        internalProductId: product.id,
        status: product.status,
      },
    };
  }

  /**
   * Valida se o produto atende aos critérios prévios do Mercado Livre antes da chamada externa
   */
  validateForMercadoLivre(
    product: any,
    options?: {
      externalCategoryId?: string;
      priceOverride?: number;
    },
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!product) {
      return { isValid: false, errors: ['Produto não informado.'] };
    }

    if (product.status && product.status !== 'ACTIVE') {
      errors.push(
        `Produto não está ativo no sistema EuSou (status atual: ${product.status}).`,
      );
    }

    if (!product.name || product.name.trim().length < 5) {
      errors.push(
        'Título do produto deve possuir no mínimo 5 caracteres conforme diretrizes do Mercado Livre.',
      );
    }

    const price =
      options?.priceOverride !== undefined && options?.priceOverride !== null
        ? Number(options.priceOverride)
        : Number(product.basePrice || product.price || 0);

    if (isNaN(price) || price <= 0) {
      errors.push('Preço do produto deve ser maior que zero.');
    }

    if (!options?.externalCategoryId) {
      errors.push(
        'Categoria do Mercado Livre não mapeada para este produto. Configure o mapeamento em Categoria Mercado Livre.',
      );
    }

    const images: string[] = [];
    if (product.media && Array.isArray(product.media)) {
      for (const m of product.media) {
        if (
          m.url &&
          (m.url.startsWith('http://') || m.url.startsWith('https://'))
        ) {
          images.push(m.url);
        }
      }
    }

    if (images.length === 0) {
      errors.push(
        'O Mercado Livre exige pelo menos 1 imagem pública (HTTP/HTTPS) cadastrada no produto.',
      );
    }

    let stock = 0;
    if (product.inventories && Array.isArray(product.inventories)) {
      stock = product.inventories.reduce(
        (sum: number, inv: any) =>
          sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)),
        0,
      );
    } else if (product.stockQuantity !== undefined) {
      stock = Number(product.stockQuantity);
    } else {
      stock = 10;
    }

    if (stock < 0) {
      errors.push('Estoque disponível não pode ser negativo.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Converte o ExternalProductPayload no formato exato da API POST /items do Mercado Livre
   */
  mapToMercadoLivrePayload(
    payload: ExternalProductPayload,
  ): Record<string, any> {
    const mlAttributes: Array<{ id: string; value_name: string }> = [];

    // Mapeia atributos chave caso presentes
    if (payload.attributes) {
      for (const [key, value] of Object.entries(payload.attributes)) {
        if (value) {
          const upperKey = key.toUpperCase();
          if (upperKey === 'BRAND' || upperKey === 'MARCA') {
            mlAttributes.push({ id: 'BRAND', value_name: value });
          } else if (upperKey === 'MODEL' || upperKey === 'MODELO') {
            mlAttributes.push({ id: 'MODEL', value_name: value });
          } else {
            mlAttributes.push({ id: upperKey, value_name: value });
          }
        }
      }
    }

    // Se não houver marca, usa 'EuSou' como default profissional
    if (!mlAttributes.some((a) => a.id === 'BRAND')) {
      mlAttributes.push({ id: 'BRAND', value_name: 'EuSou' });
    }
    // Se não houver modelo, usa 'Personalizado'
    if (!mlAttributes.some((a) => a.id === 'MODEL')) {
      mlAttributes.push({ id: 'MODEL', value_name: 'Personalizado' });
    }

    return {
      title: payload.title.slice(0, 60), // Limite padrão de 60 chars do ML
      category_id: payload.categoryExternalId || 'MLB3530',
      price: payload.price,
      currency_id: payload.currency || 'BRL',
      available_quantity: Math.max(0, payload.stockQuantity),
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'new',
      description: {
        plain_text: payload.description || payload.title,
      },
      pictures: payload.images.map((img) => ({ source: img })),
      attributes: mlAttributes,
    };
  }
}
