import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportParserService } from './import-parser.service';
import { PrismaService } from '../prisma.service';
import { ProductService } from '../product/product.service';
import { VariantService } from '../variant/variant.service';
import { InventoryService } from '../inventory/inventory.service';
import { MediaService } from '../media/media.service';
import { AuditLogService } from '../audit-log.service';
import { ProductStatus } from '@prisma/client';
import { ParsedImportPackage } from './interfaces/import.interfaces';

describe('FASE 2 — Execução Transacional da Importação em Massa', () => {
  let importService: ImportService;
  let prisma: any;
  let productService: any;
  let variantService: any;
  let inventoryService: any;
  let mediaService: any;
  let auditLogService: any;

  beforeEach(async () => {
    prisma = {
      channel: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ch-own', name: 'Loja Própria', type: 'OWN_STORE', isActive: true },
          { id: 'ch-ml', name: 'Mercado Livre Oficial', type: 'MERCADO_LIVRE', isActive: true },
        ]),
      },
      niche: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'niche-pet', name: 'Pet Shop', slug: 'pet-shop', status: 'ACTIVE' },
        ]),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cat-gatos',
            name: 'Gatos',
            slug: 'gatos',
            parentId: null,
            nicheId: 'niche-pet',
            status: 'ACTIVE',
          },
          {
            id: 'subcat-brinquedos',
            name: 'Brinquedos',
            slug: 'brinquedos',
            parentId: 'cat-gatos',
            nicheId: 'niche-pet',
            status: 'ACTIVE',
          },
        ]),
      },
      tag: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where?.OR?.some((o: any) => o.slug === 'arranhador' || o.name?.equals === 'Arranhador')) {
            return Promise.resolve({ id: 'tag-arranhador', name: 'Arranhador', slug: 'arranhador' });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `tag-${data.slug}`, name: data.name, slug: data.slug }),
        ),
      },
      inventory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return await callback(prisma);
        }
        return callback;
      }),
      media: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      stockMovement: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      variantAttributeValue: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productVariant: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productChannelPrice: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productChannel: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productNiche: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productCategory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productTag: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      product: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    productService = {
      create: jest.fn().mockImplementation((dto) =>
        Promise.resolve({
          id: `prod-${dto.sku.toLowerCase()}`,
          ...dto,
        }),
      ),
      assignNiches: jest.fn().mockResolvedValue({ success: true }),
      assignCategories: jest.fn().mockResolvedValue({ success: true }),
      assignTags: jest.fn().mockResolvedValue({ success: true }),
      assignChannels: jest.fn().mockResolvedValue({ success: true }),
      recalculateEnabledChannelPrices: jest.fn().mockResolvedValue({ success: true }),
    };

    variantService = {
      create: jest.fn().mockImplementation((productId, dto) =>
        Promise.resolve({
          id: `var-${dto.sku.toLowerCase()}`,
          productId,
          ...dto,
        }),
      ),
    };

    inventoryService = {
      adjustStock: jest.fn().mockResolvedValue({ success: true }),
    };

    mediaService = {
      create: jest.fn().mockResolvedValue({ id: 'med-created-1' }),
      uploadBase64: jest.fn().mockResolvedValue({ id: 'med-upload-1' }),
      update: jest.fn().mockResolvedValue({ id: 'med-upload-1' }),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: ImportParserService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: ProductService, useValue: productService },
        { provide: VariantService, useValue: variantService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: MediaService, useValue: mediaService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    importService = module.get<ImportService>(ImportService);
  });

  afterEach(() => {
    importService.onModuleDestroy();
  });

  // Helper para injetar um pacote diretamente no cache em memória
  function seedImportCache(
    token: string,
    pkg: ParsedImportPackage,
    status: any = 'PENDING',
    createdAt: number = Date.now(),
  ) {
    (importService as any).importCache.set(token, {
      packageData: pkg,
      createdAt,
      status,
      actorId: 'admin-user-1',
    });
  }

  describe('1. Validações do Token de Importação', () => {
    it('deve rejeitar execução quando o importToken não for encontrado', async () => {
      await expect(
        importService.execute({ importToken: 'token-inexistente' }, 'admin-user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve rejeitar execução quando o importToken estiver expirado (> 30 min)', async () => {
      const expiredToken = 'token-expirado';
      const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
      seedImportCache(
        expiredToken,
        { products: [], variants: [], images: [] },
        'PENDING',
        thirtyOneMinutesAgo,
      );

      await expect(
        importService.execute({ importToken: expiredToken }, 'admin-user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar execução quando o token já foi executado (status COMPLETED)', async () => {
      const usedToken = 'token-ja-usado';
      seedImportCache(
        usedToken,
        { products: [], variants: [], images: [] },
        'COMPLETED',
      );

      await expect(
        importService.execute({ importToken: usedToken }, 'admin-user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar execução concorrente do mesmo token (status EXECUTING)', async () => {
      const runningToken = 'token-em-execucao';
      seedImportCache(
        runningToken,
        { products: [], variants: [], images: [] },
        'EXECUTING',
      );

      await expect(
        importService.execute({ importToken: runningToken }, 'admin-user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. Execução de Produto Simples (sem variantes)', () => {
    it('deve criar produto simples, associar taxonomia, tags, canais, estoque inicial no produto pai e calcular F12', async () => {
      const token = 'token-simple-prod';
      const pkg: ParsedImportPackage = {
        products: [
          {
            rowNumber: 2,
            sku: 'SIM-PET-001',
            name: 'Ratinho de Pelúcia',
            brand: 'PetCare',
            slug: 'ratinho-de-pelucia',
            nicheName: 'Pet Shop',
            categoryName: 'Gatos',
            subcategoryName: 'Brinquedos',
            tags: ['Arranhador', 'Nova Tag'],
            costSource: 'MANUAL',
            manualCost: 15.5,
            wholesalePrice: 35.0,
            channels: ['Mercado Livre Oficial'],
            initialStock: 40,
            shortDescription: 'Brinquedo divertido',
            description: 'Descrição longa do brinquedo',
          },
        ],
        variants: [],
        images: [
          {
            rowNumber: 2,
            productSku: 'SIM-PET-001',
            fileOrUrl: 'https://cdn.example.com/ratinho.png',
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      };

      seedImportCache(token, pkg);

      const result = await importService.execute({ importToken: token }, 'admin-123');

      expect(result.success).toBe(true);
      expect(result.totalProductsCreated).toBe(1);
      expect(result.totalVariantsCreated).toBe(0);
      expect(result.totalImagesProcessed).toBe(1);
      expect(result.totalStockMovements).toBe(1);

      // 1. ProductService.create chamado com os dados corretos
      expect(productService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'SIM-PET-001',
          name: 'Ratinho de Pelúcia',
          brand: 'PetCare',
          slug: 'ratinho-de-pelucia',
          costSource: 'MANUAL',
          manualCost: 15.5,
          wholesalePrice: 35.0,
        }),
        'admin-123',
      );

      // 2. Taxonomia associada
      expect(productService.assignNiches).toHaveBeenCalledWith(
        'prod-sim-pet-001',
        ['niche-pet'],
        'admin-123',
      );
      expect(productService.assignCategories).toHaveBeenCalledWith(
        'prod-sim-pet-001',
        ['cat-gatos', 'subcat-brinquedos'],
        'admin-123',
      );

      // 3. Tags associadas (reutilizou tag existente e criou a nova)
      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Nova Tag', slug: 'nova-tag' }),
      });
      expect(productService.assignTags).toHaveBeenCalledWith(
        'prod-sim-pet-001',
        ['tag-arranhador', 'tag-nova-tag'],
        'admin-123',
      );

      // 4. Canais associados (OWN_STORE obrigatório + Mercado Livre)
      expect(productService.assignChannels).toHaveBeenCalledWith(
        'prod-sim-pet-001',
        {
          channels: [
            { channelId: 'ch-own', isEnabled: true },
            { channelId: 'ch-ml', isEnabled: true },
          ],
        },
        'admin-123',
      );

      // 5. Estoque inicial do produto sem variantes (variantId: undefined)
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        {
          productId: 'prod-sim-pet-001',
          variantId: undefined,
          quantity: 40,
          mode: 'SET',
          reason: expect.stringContaining(token.slice(0, 8)),
        },
        'admin-123',
      );

      // 6. F12 disparado
      expect(productService.recalculateEnabledChannelPrices).toHaveBeenCalledWith(
        'prod-sim-pet-001',
        'admin-123',
      );

      // 7. Imagem associada
      expect(mediaService.create).toHaveBeenCalledWith(
        'prod-sim-pet-001',
        expect.objectContaining({
          url: 'https://cdn.example.com/ratinho.png',
          isPrimary: true,
          variantId: undefined,
        }),
        'admin-123',
      );

      // 8. Audit logs gerados
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'IMPORT_STARTED' }),
      );
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'IMPORT_COMPLETED' }),
      );
    });
  });

  describe('3. Execução de Produto com Variantes', () => {
    it('deve remover inventory do produto pai, criar variantes, associar estoque por variante e vincular imagens por variante', async () => {
      const token = 'token-var-prod';
      const pkg: ParsedImportPackage = {
        products: [
          {
            rowNumber: 2,
            sku: 'VAR-PET-001',
            name: 'Coleira Ajustável',
            brand: 'PetCare',
            slug: 'coleira-ajustavel',
            nicheName: 'Pet Shop',
            categoryName: 'Gatos',
            tags: [],
            costSource: 'MANUAL',
            manualCost: 10.0,
            wholesalePrice: 25.0,
            channels: [],
          },
        ],
        variants: [
          {
            rowNumber: 2,
            productSku: 'VAR-PET-001',
            sku: 'VAR-PET-001-AZU',
            name: 'Azul',
            initialStock: 15,
          },
          {
            rowNumber: 3,
            productSku: 'VAR-PET-001',
            sku: 'VAR-PET-001-VER',
            name: 'Vermelho',
            initialStock: 25,
          },
        ],
        images: [
          {
            rowNumber: 2,
            productSku: 'VAR-PET-001',
            variantSku: 'VAR-PET-001-AZU',
            fileOrUrl: 'https://cdn.example.com/coleira-azul.png',
            isPrimary: true,
            sortOrder: 0,
          },
          {
            rowNumber: 3,
            productSku: 'VAR-PET-001',
            fileOrUrl: 'https://cdn.example.com/coleira-geral.png',
            isPrimary: false,
            sortOrder: 1,
          },
        ],
      };

      seedImportCache(token, pkg);

      const result = await importService.execute({ importToken: token }, 'admin-user');

      expect(result.success).toBe(true);
      expect(result.totalProductsCreated).toBe(1);
      expect(result.totalVariantsCreated).toBe(2);
      expect(result.totalStockMovements).toBe(2);
      expect(result.totalImagesProcessed).toBe(2);

      // REGRA CRÍTICA: Deletar inventário do pai (variantId: null)
      expect(prisma.inventory.deleteMany).toHaveBeenCalledWith({
        where: {
          productId: 'prod-var-pet-001',
          variantId: null,
        },
      });

      // Criação das duas variantes
      expect(variantService.create).toHaveBeenCalledWith(
        'prod-var-pet-001',
        { sku: 'VAR-PET-001-AZU', name: 'Azul', isActive: true },
        'admin-user',
      );
      expect(variantService.create).toHaveBeenCalledWith(
        'prod-var-pet-001',
        { sku: 'VAR-PET-001-VER', name: 'Vermelho', isActive: true },
        'admin-user',
      );

      // Estoque aplicado a cada variante
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        {
          productId: 'prod-var-pet-001',
          variantId: 'var-var-pet-001-azu',
          quantity: 15,
          mode: 'SET',
          reason: expect.stringContaining(token.slice(0, 8)),
        },
        'admin-user',
      );
      expect(inventoryService.adjustStock).toHaveBeenCalledWith(
        {
          productId: 'prod-var-pet-001',
          variantId: 'var-var-pet-001-ver',
          quantity: 25,
          mode: 'SET',
          reason: expect.stringContaining(token.slice(0, 8)),
        },
        'admin-user',
      );

      // Imagem da variante vinculada ao ID da variante
      expect(mediaService.create).toHaveBeenCalledWith(
        'prod-var-pet-001',
        expect.objectContaining({
          url: 'https://cdn.example.com/coleira-azul.png',
          variantId: 'var-var-pet-001-azu',
        }),
        'admin-user',
      );

      // Imagem geral vinculada sem variantId
      expect(mediaService.create).toHaveBeenCalledWith(
        'prod-var-pet-001',
        expect.objectContaining({
          url: 'https://cdn.example.com/coleira-geral.png',
          variantId: undefined,
        }),
        'admin-user',
      );
    });
  });

  describe('4. Rollback Atômico e Auditoria em caso de Falha', () => {
    it('deve reverter 100% dos produtos e dependências se qualquer etapa falhar durante a importação', async () => {
      const token = 'token-com-falha';
      const pkg: ParsedImportPackage = {
        products: [
          {
            rowNumber: 2,
            sku: 'PROD-OK-001',
            name: 'Produto Válido 1',
            brand: 'Marca',
            costSource: 'COST_FROM_F7',
            wholesalePrice: 50.0,
            nicheName: 'Pet Shop',
            categoryName: 'Gatos',
            channels: [],
            tags: [],
          },
          {
            rowNumber: 3,
            sku: 'PROD-FAIL-002',
            name: 'Produto com Falha',
            brand: 'Marca',
            costSource: 'COST_FROM_F7',
            wholesalePrice: 60.0,
            nicheName: 'Pet Shop',
            categoryName: 'Gatos',
            channels: [],
            tags: [],
          },
        ],
        variants: [],
        images: [],
      };

      seedImportCache(token, pkg);

      // Simula erro ao processar o segundo produto (ex: falha no cálculo F12)
      productService.recalculateEnabledChannelPrices.mockImplementation((productId: string) => {
        if (productId === 'prod-prod-fail-002') {
          return Promise.reject(new Error('Simulação de falha catastrófica no motor de precificação F12'));
        }
        return Promise.resolve({ success: true });
      });

      await expect(
        importService.execute({ importToken: token }, 'admin-executor'),
      ).rejects.toThrow(BadRequestException);

      // Verifica que o rollback atômico executou a transação de exclusão de tudo o que foi criado
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.product.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['prod-prod-ok-001', 'prod-prod-fail-002'] },
        },
      });

      // Verifica que o status no cache foi atualizado para FAILED
      const cached = (importService as any).importCache.get(token);
      expect(cached.status).toBe('FAILED');
      expect(cached.errorMessage).toContain('Simulação de falha catastrófica');

      // Verifica que o AuditLog gravou IMPORT_FAILED_ROLLED_BACK
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'IMPORT_FAILED_ROLLED_BACK',
          metadata: expect.objectContaining({
            importToken: token,
            failedStage: 'PRICING_F12',
            failedSku: 'PROD-FAIL-002',
            rolledBackCount: 2,
          }),
        }),
      );
    });
  });
});
