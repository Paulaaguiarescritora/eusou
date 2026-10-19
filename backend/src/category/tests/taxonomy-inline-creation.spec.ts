import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { NicheService } from '../../niche/niche.service';
import { CategoryService } from '../category.service';
import { ProductService } from '../../product/product.service';
import { NicheController } from '../../niche/niche.controller';
import { CategoryController } from '../category.controller';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { CostResolverService } from '../../pricing/services/cost-resolver.service';
import { PricingCalculatorService } from '../../pricing/calculators/pricing-calculator.service';
import { PricingValidatorService } from '../../pricing/validators/pricing-validator.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { ProductStatus, CategoryStatus, NicheStatus } from '@prisma/client';

describe('EU SOU — Taxonomia Inline no Cadastro de Produto (Nicho, Categoria, Subcategoria)', () => {
  let nicheService: NicheService;
  let categoryService: CategoryService;
  let productService: ProductService;
  let reflector: Reflector;
  let prisma: any;
  let auditLog: any;

  // In-memory mock storage
  let nichesDb: any[] = [];
  let categoriesDb: any[] = [];
  let productsDb: any[] = [];
  let productNichesDb: any[] = [];
  let productCategoriesDb: any[] = [];

  beforeEach(async () => {
    nichesDb = [
      { id: 'niche-pet', name: 'Pet Shop', slug: 'pet-shop', status: NicheStatus.ACTIVE },
      { id: 'niche-decor', name: 'Decoração', slug: 'decoracao', status: NicheStatus.ACTIVE },
    ];

    categoriesDb = [
      { id: 'cat-acessorios', name: 'Acessórios', slug: 'acessorios', nicheId: 'niche-pet', parentId: null, status: CategoryStatus.ACTIVE },
      { id: 'subcat-portachaves', name: 'Porta-Chaves', slug: 'porta-chaves', nicheId: 'niche-pet', parentId: 'cat-acessorios', status: CategoryStatus.ACTIVE },
      { id: 'cat-quadros', name: 'Quadros', slug: 'quadros', nicheId: 'niche-decor', parentId: null, status: CategoryStatus.ACTIVE },
    ];

    productsDb = [];
    productNichesDb = [];
    productCategoriesDb = [];

    prisma = {
      niche: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) return Promise.resolve(nichesDb.find((n) => n.id === where.id) || null);
          if (where.slug) return Promise.resolve(nichesDb.find((n) => n.slug === where.slug) || null);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.name?.equals) {
            const queryName = where.name.equals.toLowerCase();
            return Promise.resolve(nichesDb.find((n) => n.name.toLowerCase() === queryName) || null);
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = { id: `niche-${Date.now()}`, ...data };
          nichesDb.push(created);
          return Promise.resolve(created);
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          if (where.id?.in) {
            return Promise.resolve(where.id.in.filter((id: string) => nichesDb.some((n) => n.id === id)).length);
          }
          return Promise.resolve(nichesDb.length);
        }),
      },
      category: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) return Promise.resolve(categoriesDb.find((c) => c.id === where.id) || null);
          if (where.slug) return Promise.resolve(categoriesDb.find((c) => c.slug === where.slug) || null);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            categoriesDb.find((c) => {
              let match = true;
              if (where.parentId !== undefined) {
                match = match && c.parentId === where.parentId;
              }
              if (where.nicheId !== undefined) {
                match = match && c.nicheId === where.nicheId;
              }
              if (where.name?.equals) {
                match = match && c.name.toLowerCase() === where.name.equals.toLowerCase();
              }
              return match;
            }) || null
          );
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where?.id?.in) {
            return Promise.resolve(categoriesDb.filter((c) => where.id.in.includes(c.id)));
          }
          return Promise.resolve(categoriesDb);
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          if (where.id?.in) {
            return Promise.resolve(where.id.in.filter((id: string) => categoriesDb.some((c) => c.id === id)).length);
          }
          return Promise.resolve(categoriesDb.length);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = { id: `cat-${Date.now()}`, ...data };
          categoriesDb.push(created);
          return Promise.resolve(created);
        }),
      },
      product: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const prod = productsDb.find((p) => p.id === where.id || p.sku === where.sku || p.slug === where.slug);
          if (!prod) return Promise.resolve(null);
          return Promise.resolve({
            ...prod,
            niches: productNichesDb.filter((pn) => pn.productId === prod.id).map((pn) => ({
              niche: nichesDb.find((n) => n.id === pn.nicheId),
            })),
            categories: productCategoriesDb.filter((pc) => pc.productId === prod.id).map((pc) => ({
              category: categoriesDb.find((c) => c.id === pc.categoryId),
            })),
            media: [],
            tags: [],
            productChannels: [],
            productChannelPrices: [],
          });
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = { id: `prod-${Date.now()}`, ...data };
          productsDb.push(created);
          return Promise.resolve(created);
        }),
      },
      productNiche: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(productNichesDb.filter((pn) => pn.productId === where.productId));
        }),
        deleteMany: jest.fn().mockImplementation(({ where }) => {
          productNichesDb = productNichesDb.filter((pn) => pn.productId !== where.productId);
          return Promise.resolve({ count: 1 });
        }),
        createMany: jest.fn().mockImplementation(({ data }) => {
          productNichesDb.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
      productCategory: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(productCategoriesDb.filter((pc) => pc.productId === where.productId));
        }),
        deleteMany: jest.fn().mockImplementation(({ where }) => {
          productCategoriesDb = productCategoriesDb.filter((pc) => pc.productId !== where.productId);
          return Promise.resolve({ count: 1 });
        }),
        createMany: jest.fn().mockImplementation(({ data }) => {
          productCategoriesDb.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
      $transaction: jest.fn().mockImplementation((actions) => {
        if (Array.isArray(actions)) return Promise.all(actions);
        return actions(prisma);
      }),
    };

    auditLog = { log: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NicheService,
        CategoryService,
        ProductService,
        Reflector,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: CostResolverService, useValue: { resolveProductionCost: jest.fn().mockResolvedValue(null) } },
        { provide: PricingCalculatorService, useValue: { calculatePrice: jest.fn().mockReturnValue(39.9) } },
        { provide: PricingValidatorService, useValue: { validateMarginSafety: jest.fn() } },
      ],
    }).compile();

    nicheService = module.get<NicheService>(NicheService);
    categoryService = module.get<CategoryService>(CategoryService);
    productService = module.get<ProductService>(ProductService);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Cenários 1, 2 e 3 — Criar produto usando taxonomia existente', () => {
    it('1. deve criar produto e associar ao nicho existente', async () => {
      const prod = await productService.create({
        name: 'Gatinho Felinodelia',
        sku: 'GAT-FEL-01',
      });
      await productService.assignNiches(prod.id, ['niche-pet']);

      const assigned = await prisma.productNiche.findMany({ where: { productId: prod.id } });
      expect(assigned).toHaveLength(1);
      expect(assigned[0].nicheId).toBe('niche-pet');
    });

    it('2. deve associar produto à categoria principal existente compatível', async () => {
      const prod = await productService.create({
        name: 'Gatinho Felinodelia',
        sku: 'GAT-FEL-02',
      });
      await productService.assignNiches(prod.id, ['niche-pet']);
      await productService.assignCategories(prod.id, ['cat-acessorios']);

      const assigned = await prisma.productCategory.findMany({ where: { productId: prod.id } });
      expect(assigned).toHaveLength(1);
      expect(assigned[0].categoryId).toBe('cat-acessorios');
    });

    it('3. deve associar produto à subcategoria existente compatível', async () => {
      const prod = await productService.create({
        name: 'Porta Chaves Gatinho',
        sku: 'GAT-FEL-03',
      });
      await productService.assignNiches(prod.id, ['niche-pet']);
      await productService.assignCategories(prod.id, ['cat-acessorios', 'subcat-portachaves']);

      const assigned = await prisma.productCategory.findMany({ where: { productId: prod.id } });
      expect(assigned).toHaveLength(2);
      expect(assigned.map((a: any) => a.categoryId)).toEqual(
        expect.arrayContaining(['cat-acessorios', 'subcat-portachaves'])
      );
    });
  });

  describe('Cenários 4, 5 e 6 — Criação inline de novos nós taxonômicos', () => {
    it('4. deve permitir criar novo nicho durante cadastro com slug automático', async () => {
      const newNiche = await nicheService.create({ name: 'Geek & Colecionáveis' }, 'admin-1');
      expect(newNiche.name).toBe('Geek & Colecionáveis');
      expect(newNiche.slug).toBe('geek-colecionaveis');
      expect(nichesDb.some((n) => n.id === newNiche.id)).toBe(true);
    });

    it('5. deve permitir criar nova categoria vinculada ao nicho', async () => {
      const newCat = await categoryService.create(
        { name: 'Chaveiros Especiais', nicheId: 'niche-pet' },
        'admin-1'
      );
      expect(newCat.name).toBe('Chaveiros Especiais');
      expect(newCat.nicheId).toBe('niche-pet');
      expect(newCat.parentId).toBeNull();
      expect(categoriesDb.some((c) => c.id === newCat.id)).toBe(true);
    });

    it('6. deve permitir criar nova subcategoria vinculada à categoria pai e nicho', async () => {
      const newSubcat = await categoryService.create(
        { name: 'Chaveiro de Parede', parentId: 'cat-acessorios', nicheId: 'niche-pet' },
        'admin-1'
      );
      expect(newSubcat.name).toBe('Chaveiro de Parede');
      expect(newSubcat.parentId).toBe('cat-acessorios');
      expect(newSubcat.nicheId).toBe('niche-pet');
      expect(categoriesDb.some((c) => c.id === newSubcat.id)).toBe(true);
    });
  });

  describe('Cenários 7, 8 e 9 — Seleção automática imediata após criação', () => {
    it('7. novo nicho criado deve poder ser imediatamente selecionado e vinculado ao produto', async () => {
      const createdNiche = await nicheService.create({ name: 'Utilidades Domésticas' }, 'admin-1');
      const prod = await productService.create({ name: 'Gancho Prático', sku: 'GAN-01' });

      // Simulação do comportamento do formulário que seleciona automaticamente o id recém-criado
      await productService.assignNiches(prod.id, [createdNiche.id]);
      const assigned = await prisma.productNiche.findMany({ where: { productId: prod.id } });
      expect(assigned[0].nicheId).toBe(createdNiche.id);
    });

    it('8. nova categoria criada deve poder ser imediatamente selecionada e vinculada ao produto', async () => {
      const createdCat = await categoryService.create({ name: 'Camas Pet', nicheId: 'niche-pet' }, 'admin-1');
      const prod = await productService.create({ name: 'Cama Pelúcia', sku: 'CAM-01' });

      await productService.assignNiches(prod.id, ['niche-pet']);
      await productService.assignCategories(prod.id, [createdCat.id]);

      const assigned = await prisma.productCategory.findMany({ where: { productId: prod.id } });
      expect(assigned[0].categoryId).toBe(createdCat.id);
    });

    it('9. nova subcategoria criada deve poder ser imediatamente selecionada e vinculada ao produto', async () => {
      const createdSubcat = await categoryService.create(
        { name: 'Porta-Chaves Magnético', parentId: 'cat-acessorios', nicheId: 'niche-pet' },
        'admin-1'
      );
      const prod = await productService.create({ name: 'Porta Chaves Magnético Gato', sku: 'MAG-01' });

      await productService.assignNiches(prod.id, ['niche-pet']);
      await productService.assignCategories(prod.id, ['cat-acessorios', createdSubcat.id]);

      const assigned = await prisma.productCategory.findMany({ where: { productId: prod.id } });
      expect(assigned.some((a: any) => a.categoryId === createdSubcat.id)).toBe(true);
    });
  });

  describe('Cenários 10 e 11 — Impedimento de duplicidade dentro do mesmo escopo', () => {
    it('10. deve impedir criação de categoria com nome duplicado dentro do mesmo nicho', async () => {
      await expect(
        categoryService.create({ name: 'Acessórios', nicheId: 'niche-pet' }, 'admin-1')
      ).rejects.toThrow(ConflictException);

      await expect(
        categoryService.create({ name: 'acessórios', nicheId: 'niche-pet' }, 'admin-1')
      ).rejects.toThrow('Já existe uma categoria com esse nome neste nicho.');
    });

    it('11. deve impedir criação de subcategoria com nome duplicado dentro da mesma categoria', async () => {
      await expect(
        categoryService.create({ name: 'Porta-Chaves', parentId: 'cat-acessorios', nicheId: 'niche-pet' }, 'admin-1')
      ).rejects.toThrow(ConflictException);

      await expect(
        categoryService.create({ name: 'porta-chaves', parentId: 'cat-acessorios', nicheId: 'niche-pet' }, 'admin-1')
      ).rejects.toThrow('Já existe uma subcategoria com esse nome nesta categoria.');
    });
  });

  describe('Cenários 12 e 13 — Integridade da cascata e coerência taxonômica', () => {
    it('12. deve manter a coerência da hierarquia Nicho → Categoria → Subcategoria', async () => {
      const parent = categoriesDb.find((c) => c.id === 'cat-acessorios');
      const child = categoriesDb.find((c) => c.id === 'subcat-portachaves');

      expect(parent.nicheId).toBe('niche-pet');
      expect(parent.parentId).toBeNull();

      expect(child.parentId).toBe('cat-acessorios');
      expect(child.nicheId).toBe(parent.nicheId);
    });

    it('13. deve impedir associação incompatível (categoria pertencente a outro nicho)', async () => {
      const prod = await productService.create({
        name: 'Gatinho Pet',
        sku: 'GAT-INCOMP-01',
      });
      // Atribui nicho Pet Shop
      await productService.assignNiches(prod.id, ['niche-pet']);

      // Tenta atribuir a categoria "cat-quadros", que pertence ao nicho "Decoração"
      await expect(
        productService.assignCategories(prod.id, ['cat-quadros'])
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Cenário 14 — Segurança: apenas ADMINISTRADOR pode criar taxonomia', () => {
    it('14. deve confirmar que os controladores de Niche e Category exigem a role "admin"', () => {
      const nicheRoles = reflector.get<string[]>('roles', NicheController);
      expect(nicheRoles).toBeDefined();
      expect(nicheRoles).toContain('admin');

      const categoryRoles = reflector.get<string[]>('roles', CategoryController);
      expect(categoryRoles).toBeDefined();
      expect(categoryRoles).toContain('admin');
    });
  });
});
