import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { QueryProductsDto } from '../product/dto/query-products.dto';
import { CatalogType } from '@prisma/client';

@Injectable()
export class PublicStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getHomeData() {
    const [categories, featuredProducts, catalogs, collections] =
      await Promise.all([
        this.prisma.category.findMany({
          where: { status: 'ACTIVE', parentId: null },
          orderBy: { name: 'asc' },
          take: 8,
        }),
        this.prisma.product.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            media: { orderBy: { sortOrder: 'asc' }, take: 1 },
            variants: { where: { isActive: true }, take: 4 },
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

    return {
      categories,
      featuredProducts,
      catalogs,
      collections,
    };
  }

  async getProducts(query: QueryProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE', // Strictly public: only ACTIVE
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

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          media: { orderBy: { sortOrder: 'asc' }, take: 2 },
          variants: {
            where: { isActive: true },
            include: {
              variantAttributeValues: {
                include: {
                  productAttributeValue: {
                    include: { attributeDefinition: true },
                  },
                },
              },
            },
          },
          categories: { include: { category: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

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
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        attributeValues: {
          include: { attributeDefinition: true },
        },
        variants: {
          where: { isActive: true },
          include: {
            media: true,
            variantAttributeValues: {
              include: {
                productAttributeValue: {
                  include: { attributeDefinition: true },
                },
              },
            },
          },
        },
        categories: { include: { category: true } },
        niches: { include: { niche: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product not found or not active`);
    }

    return product;
  }

  async getEmbedProductById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        shortDescription: true,
        description: true,
        basePrice: true,
        status: true,
        media: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, url: true, altText: true, isPrimary: true },
        },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            isActive: true,
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

    return product;
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
}
