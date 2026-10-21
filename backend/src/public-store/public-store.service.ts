import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { QueryProductsDto } from '../product/dto/query-products.dto';
import { CatalogType } from '@prisma/client';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class PublicStoreService {
  private cache = new Map<string, CacheEntry<any>>();
  private ownStoreChannelCache: { channel: any; expiresAt: number } | null = null;

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setInCache<T>(key: string, data: T, ttlMs = 60000): void {
    if (this.cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now > v.expiresAt) this.cache.delete(k);
      }
    }
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnStoreChannel() {
    return this.prisma.channel.findFirst({
      where: { type: 'OWN_STORE', isActive: true },
    });
  }

  private resolveProductPrice(product: any, ownStoreChannelId?: string | null): string | null {
    if (ownStoreChannelId && product.productChannelPrices && product.productChannelPrices.length > 0) {
      const pcp = product.productChannelPrices.find(
        (p: any) => p.channelId === ownStoreChannelId && !p.variantId,
      );
      if (pcp) {
        const effective =
          pcp.mode === 'MANUAL' && pcp.manualPrice !== null
            ? pcp.manualPrice
            : pcp.effectivePrice || pcp.calculatedPrice;
        if (effective !== null && effective !== undefined && Number(effective) > 0) {
          return Number(effective).toFixed(2);
        }
      }
    }
    // Regra oficial: Não utilizar Product.basePrice como fallback comercial da Loja Própria.
    // Se não há ProductChannelPrice válido para OWN_STORE, o produto não possui preço de venda configurado.
    return null;
  }

  private formatProductWithStock(product: any, ownStoreChannelId?: string | null) {
    const activeVariants = (product.variants || []).map((v: any) => {
      const inv = v.inventories?.find((i: any) => i.variantId === v.id) || v.inventories?.[0];
      const qty = inv?.quantity ?? 0;
      const reserved = inv?.reservedQuantity ?? 0;
      const availableStock = Math.max(0, qty - reserved);

      // Limpa dados brutos de inventário para não vazar números do armazém ao cliente público
      const { inventories, ...variantClean } = v;

      return {
        ...variantClean,
        inStock: availableStock > 0,
        isOutOfStock: availableStock <= 0,
        availableStock,
      };
    });

    const hasActiveVariants = activeVariants.length > 0;
    let availableStock = 0;

    if (hasActiveVariants) {
      // Regra de negócio: Produto com variantes ativas utiliza EXCLUSIVAMENTE o estoque das variantes
      availableStock = activeVariants.reduce((sum: number, v: any) => sum + (v.availableStock || 0), 0);
    } else {
      // Produto sem variantes: utiliza registro de estoque próprio (variantId: null)
      const parentInv = product.inventories?.find((i: any) => !i.variantId);
      const qty = parentInv?.quantity ?? 0;
      const reserved = parentInv?.reservedQuantity ?? 0;
      availableStock = Math.max(0, qty - reserved);
    }

    const { inventories, ...productClean } = product;

    return {
      ...productClean,
      variants: activeVariants,
      basePrice: this.resolveProductPrice(product, ownStoreChannelId),
      inStock: availableStock > 0,
      isOutOfStock: availableStock <= 0,
      availableStock,
    };
  }

  async getHomeData() {
    const ownStore = await this.getOwnStoreChannel();

    const [categories, featuredProductsRaw, catalogs, collections] =
      await Promise.all([
        this.prisma.category.findMany({
          where: { status: 'ACTIVE', parentId: null },
          orderBy: { name: 'asc' },
          take: 8,
        }),
        this.prisma.product.findMany({
          where: {
            status: 'ACTIVE',
            ...(ownStore
              ? {
                  productChannels: {
                    some: {
                      channelId: ownStore.id,
                      isEnabled: true,
                    },
                  },
                }
              : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            media: { orderBy: { sortOrder: 'asc' }, take: 1 },
            variants: { where: { isActive: true }, include: { inventories: true }, take: 4 },
            inventories: true,
            productChannelPrices: ownStore ? { where: { channelId: ownStore.id } } : false,
          },
        }),
        this.prisma.catalog.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 4,
          include: {
            theme: true,
            _count: { select: { items: true, collections: true } },
          },
        }),
        this.prisma.collection.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 4,
          include: {
            items: {
              take: 4,
              include: {
                product: {
                  include: {
                    media: { orderBy: { sortOrder: 'asc' }, take: 1 },
                  },
                },
              },
            },
          },
        }),
      ]);

    const featuredProducts = featuredProductsRaw.map((p) =>
      this.formatProductWithStock(p, ownStore?.id),
    );

    return {
      categories,
      featuredProducts,
      catalogs,
      collections,
    };
  }

  async getProducts(query: QueryProductsDto) {
    const ownStore = await this.getOwnStoreChannel();
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE', // Strictly public: only ACTIVE
      ...(ownStore
        ? {
            productChannels: {
              some: {
                channelId: ownStore.id,
                isEnabled: true,
              },
            },
          }
        : {}),
    };

    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        {
          shortDescription: {
            contains: query.search.trim(),
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.categoryId) {
      where.categories = { some: { categoryId: query.categoryId } };
    }

    if (query.nicheId) {
      where.niches = { some: { nicheId: query.nicheId } };
    }

    if (query.tagId) {
      where.tags = { some: { tagId: query.tagId } };
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [rawProducts, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          media: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 2,
          },
          variants: {
            where: { isActive: true },
            include: {
              inventories: true,
              variantAttributeValues: {
                include: {
                  productAttributeValue: {
                    include: { attributeDefinition: true },
                  },
                },
              },
            },
          },
          inventories: true,
          categories: { include: { category: true } },
          productChannelPrices: ownStore ? { where: { channelId: ownStore.id } } : false,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = rawProducts.map((p) =>
      this.formatProductWithStock(p, ownStore?.id),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getProductBySlug(slug: string) {
    const ownStore = await this.getOwnStoreChannel();

    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: 'ACTIVE',
        ...(ownStore
          ? {
              productChannels: {
                some: {
                  channelId: ownStore.id,
                  isEnabled: true,
                },
              },
            }
          : {}),
      },
      include: {
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        attributeValues: {
          include: { attributeDefinition: true },
        },
        variants: {
          where: { isActive: true },
          include: {
            media: true,
            inventories: true,
            variantAttributeValues: {
              include: {
                productAttributeValue: {
                  include: { attributeDefinition: true },
                },
              },
            },
          },
        },
        inventories: true,
        categories: { include: { category: true } },
        niches: { include: { niche: true } },
        tags: { include: { tag: true } },
        productChannelPrices: ownStore ? { where: { channelId: ownStore.id } } : false,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product not found or not available in store`);
    }

    return this.formatProductWithStock(product, ownStore?.id);
  }

  async getEmbedProductById(id: string) {
    const ownStore = await this.getOwnStoreChannel();

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        ...(ownStore
          ? {
              productChannels: {
                some: {
                  channelId: ownStore.id,
                  isEnabled: true,
                },
              },
            }
          : {}),
      },
      include: {
        media: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, url: true, altText: true, isPrimary: true },
        },
        inventories: true,
        productChannelPrices: ownStore ? { where: { channelId: ownStore.id } } : false,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            isActive: true,
            inventories: true,
            variantAttributeValues: {
              select: {
                productAttributeValue: {
                  select: {
                    value: true,
                    attributeDefinition: {
                      select: { name: true, slug: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product not found or not active`);
    }

    return this.formatProductWithStock(product, ownStore?.id);
  }

  async validateCart(items: Array<{ productId: string; variantId?: string | null; quantity: number }>) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { isValid: true, items: [] };
    }

    let isValid = true;
    const validatedItems = await Promise.all(
      items.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: {
            variants: { where: { isActive: true } },
            inventories: true,
          },
        });

        if (!product || product.status !== 'ACTIVE') {
          isValid = false;
          return {
            productId: item.productId,
            variantId: item.variantId || null,
            requestedQuantity: item.quantity,
            availableStock: 0,
            inStock: false,
            error: product ? 'Produto indisponível.' : 'Produto não encontrado.',
          };
        }

        const activeVariants = product.variants || [];
        const hasActiveVariants = activeVariants.length > 0;

        if (hasActiveVariants) {
          // Regra de negócio: Produto com variantes ativas utiliza EXCLUSIVAMENTE o estoque da variante
          if (!item.variantId) {
            isValid = false;
            return {
              productId: item.productId,
              variantId: null,
              requestedQuantity: item.quantity,
              availableStock: 0,
              inStock: false,
              error: 'O produto possui variantes. É obrigatório selecionar uma opção válida.',
            };
          }

          const variant = activeVariants.find((v) => v.id === item.variantId);
          if (!variant) {
            isValid = false;
            return {
              productId: item.productId,
              variantId: item.variantId,
              requestedQuantity: item.quantity,
              availableStock: 0,
              inStock: false,
              error: 'Esta variante não está disponível.',
            };
          }

          const inv = await this.prisma.inventory.findFirst({
            where: {
              productId: product.id,
              variantId: variant.id,
            },
          });

          const qty = inv?.quantity ?? 0;
          const reserved = inv?.reservedQuantity ?? 0;
          const availableStock = Math.max(0, qty - reserved);

          if (availableStock <= 0) {
            isValid = false;
            return {
              productId: item.productId,
              variantId: item.variantId,
              requestedQuantity: item.quantity,
              availableStock: 0,
              inStock: false,
              error: 'Esta variante está esgotada.',
            };
          }

          if (item.quantity > availableStock) {
            isValid = false;
            return {
              productId: item.productId,
              variantId: item.variantId,
              requestedQuantity: item.quantity,
              availableStock,
              inStock: false,
              error: 'Quantidade solicitada indisponível em estoque.',
            };
          }

          return {
            productId: item.productId,
            variantId: item.variantId,
            requestedQuantity: item.quantity,
            availableStock,
            inStock: true,
            error: null,
          };
        } else {
          // Produto sem variantes: usa estoque do produto-pai (variantId: null)
          const inv = await this.prisma.inventory.findFirst({
            where: {
              productId: product.id,
              variantId: null,
            },
          });

          const qty = inv?.quantity ?? 0;
          const reserved = inv?.reservedQuantity ?? 0;
          const availableStock = Math.max(0, qty - reserved);

          if (availableStock <= 0) {
            isValid = false;
            return {
              productId: item.productId,
              variantId: null,
              requestedQuantity: item.quantity,
              availableStock: 0,
              inStock: false,
              error: 'Este produto está esgotado.',
            };
          }

          if (item.quantity > availableStock) {
            isValid = false;
            return {
              productId: item.productId,
              variantId: null,
              requestedQuantity: item.quantity,
              availableStock,
              inStock: false,
              error: 'Quantidade solicitada indisponível em estoque.',
            };
          }

          return {
            productId: item.productId,
            variantId: null,
            requestedQuantity: item.quantity,
            availableStock,
            inStock: true,
            error: null,
          };
        }
      }),
    );

    return {
      isValid,
      items: validatedItems,
    };
  }

  async getCatalogBySlug(slug: string) {
    const catalog = await this.prisma.catalog.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        theme: true,
        rules: true,
        items: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              include: {
                media: { orderBy: { sortOrder: 'asc' }, take: 1 },
                variants: { where: { isActive: true } },
              },
            },
          },
        },
        collections: {
          orderBy: { position: 'asc' },
          include: {
            collection: {
              include: {
                items: {
                  orderBy: { position: 'asc' },
                  include: {
                    product: {
                      include: {
                        media: { orderBy: { sortOrder: 'asc' }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!catalog) {
      throw new NotFoundException('Catalog not found or not active');
    }

    let products: any[] = [];
    if (catalog.type === CatalogType.MANUAL) {
      products = catalog.items
        .filter((i) => i.product.status === 'ACTIVE')
        .map((i) => ({ ...i.product, position: i.position }));
    } else {
      // Automatic rules resolution
      const rules = catalog.rules || [];
      const orConditions: any[] = [];
      for (const rule of rules) {
        if (rule.type === 'NICHE')
          orConditions.push({ niches: { some: { nicheId: rule.value } } });
        if (rule.type === 'CATEGORY')
          orConditions.push({
            categories: { some: { categoryId: rule.value } },
          });
        if (rule.type === 'TAG')
          orConditions.push({ tags: { some: { tagId: rule.value } } });
      }

      if (orConditions.length > 0) {
        products = await this.prisma.product.findMany({
          where: { status: 'ACTIVE', OR: orConditions },
          include: {
            media: { orderBy: { sortOrder: 'asc' }, take: 1 },
            variants: { where: { isActive: true } },
          },
        });
      } else if (catalog.nicheId) {
        products = await this.prisma.product.findMany({
          where: {
            status: 'ACTIVE',
            niches: { some: { nicheId: catalog.nicheId } },
          },
          include: {
            media: { orderBy: { sortOrder: 'asc' }, take: 1 },
            variants: { where: { isActive: true } },
          },
        });
      }
    }

    return {
      ...catalog,
      resolvedProducts: products,
    };
  }

  async getCollectionBySlug(slug: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              include: {
                media: { orderBy: { sortOrder: 'asc' }, take: 1 },
                variants: { where: { isActive: true } },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or not active');
    }

    return {
      ...collection,
      products: collection.items
        .filter((i) => i.product.status === 'ACTIVE')
        .map((i) => ({ ...i.product, position: i.position })),
    };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: {
        children: { where: { status: 'ACTIVE' } },
      },
    });
  }

  // Consolidação Arquitetural: Identidade pública contextualizada pelo Nicho
  async getStoreContext(identifier?: string) {
    let niche = null;

    if (identifier?.trim()) {
      niche = await this.prisma.niche.findFirst({
        where: {
          OR: [{ id: identifier.trim() }, { slug: identifier.trim() }],
          status: 'ACTIVE',
        },
        include: {
          defaultTheme: true,
          catalogs: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: { theme: true },
          },
        },
      });
    }

    if (!niche) {
      // Fallback para primeiro nicho ativo
      niche = await this.prisma.niche.findFirst({
        where: { status: 'ACTIVE' },
        include: {
          defaultTheme: true,
          catalogs: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: { theme: true },
          },
        },
      });
    }

    if (!niche) {
      return {
        brandName: null,
        nicheId: null,
        nicheSlug: null,
        logoUrl: null,
        faviconUrl: null,
        theme: null,
      };
    }

    const theme = niche.defaultTheme || niche.catalogs?.[0]?.theme || null;

    return {
      nicheId: niche.id,
      nicheSlug: niche.slug,
      nicheName: niche.name,
      brandName: niche.brandName || niche.name,
      logoUrl: niche.logoUrl || theme?.logo || null,
      faviconUrl: niche.faviconUrl || null,
      theme,
    };
  }
}
