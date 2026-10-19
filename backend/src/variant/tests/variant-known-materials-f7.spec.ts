import { Test, TestingModule } from '@nestjs/testing';
import { VariantService } from '../variant.service';
import { ProductService } from '../../product/product.service';
import { ProductionService } from '../../production/production.service';
import { CostResolverService } from '../../pricing/services/cost-resolver.service';
import { PricingService } from '../../pricing/pricing.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { InventoryService } from '../../inventory/inventory.service';

describe('F7 — Finalização dos Materiais Conhecidos do Porta-Chaves Gatinho (FEL-GAT-001)', () => {
  let prisma: PrismaService;
  let variantService: VariantService;
  let productService: ProductService;
  let productionService: ProductionService;
  let costResolver: CostResolverService;

  let product: any;
  let variants: any[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        AuditLogService,
        VariantService,
        ProductService,
        ProductionService,
        CostResolverService,
        InventoryService,
        {
          provide: PricingService,
          useValue: {
            calculatePrices: jest.fn(),
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    variantService = module.get<VariantService>(VariantService);
    productService = module.get<ProductService>(ProductService);
    productionService = module.get<ProductionService>(ProductionService);
    costResolver = module.get<CostResolverService>(CostResolverService);

    product = await prisma.product.findUnique({
      where: { sku: 'FEL-GAT-001' },
      include: {
        productChannelPrices: true,
        productChannels: true,
      },
    });

    if (!product) {
      throw new Error('Produto FEL-GAT-001 não encontrado');
    }

    variants = await variantService.findAll(product.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Confirmação das 5 variantes oficiais (SKU, nomes e integridade)', async () => {
    expect(variants).toHaveLength(5);
    const skus = variants.map((v) => v.sku).sort();
    expect(skus).toEqual([
      'FEL-GAT-001-AZU',
      'FEL-GAT-001-BCO',
      'FEL-GAT-001-PRE',
      'FEL-GAT-001-ROS',
      'FEL-GAT-001-VER',
    ]);
  });

  it('2. Rosa (FEL-GAT-001-ROS): possui ProductionProfile específico com PLA ROSA CLARO e Custo F7 R$ 2,12', async () => {
    const rosa = variants.find((v) => v.sku === 'FEL-GAT-001-ROS');
    expect(rosa).toBeDefined();
    expect(rosa.name).toBe('Rosa');
    expect(rosa.isMaterialCustom).toBe(true);
    expect(rosa.materialName).toBe('PLA ROSA CLARO');
    expect(Number(rosa.productionCost)).toBe(2.12);

    // Validação direta no banco
    const profile = await prisma.productionProfile.findFirst({
      where: { variantId: rosa.id, isActive: true },
      include: { materials: { include: { material: true } } },
    });
    expect(profile).toBeDefined();
    const filament = profile?.materials.find((m) => m.material.name === 'PLA ROSA CLARO');
    expect(filament).toBeDefined();
    expect(Number(filament?.quantity)).toBeCloseTo(12.64, 2);
    expect(Number(filament?.material.costPerUnit)).toBeCloseTo(0.09, 4);
  });

  it('3. Vermelho (FEL-GAT-001-VER): possui ProductionProfile específico com PLA VERMELHO e Custo F7 R$ 2,12', async () => {
    const vermelho = variants.find((v) => v.sku === 'FEL-GAT-001-VER');
    expect(vermelho).toBeDefined();
    expect(vermelho.name).toBe('Vermelho');
    expect(vermelho.isMaterialCustom).toBe(true);
    expect(vermelho.materialName).toBe('PLA VERMELHO');
    expect(Number(vermelho.productionCost)).toBe(2.12);

    const profile = await prisma.productionProfile.findFirst({
      where: { variantId: vermelho.id, isActive: true },
      include: { materials: { include: { material: true } } },
    });
    expect(profile).toBeDefined();
    const filament = profile?.materials.find((m) => m.material.name === 'PLA VERMELHO');
    expect(filament).toBeDefined();
    expect(Number(filament?.quantity)).toBeCloseTo(12.64, 2);
    expect(Number(filament?.material.costPerUnit)).toBeCloseTo(0.09, 4);
  });

  it('4. Azul (FEL-GAT-001-AZU): possui ProductionProfile específico com PLA LITE BAMBU LAB e Custo F7 R$ 2,45', async () => {
    const azul = variants.find((v) => v.sku === 'FEL-GAT-001-AZU');
    expect(azul).toBeDefined();
    expect(azul.name).toBe('Azul');
    expect(azul.isMaterialCustom).toBe(true);
    expect(azul.materialName).toBe('PLA LITE BAMBU LAB');
    expect(Number(azul.productionCost)).toBe(2.45);

    const profile = await prisma.productionProfile.findFirst({
      where: { variantId: azul.id, isActive: true },
      include: { materials: { include: { material: true } } },
    });
    expect(profile).toBeDefined();
    const filament = profile?.materials.find((m) => m.material.name === 'PLA LITE BAMBU LAB');
    expect(filament).toBeDefined();
    expect(Number(filament?.quantity)).toBeCloseTo(12.64, 2);
    expect(Number(filament?.material.costPerUnit)).toBeCloseTo(0.116, 4);
  });

  it('5. Preto (FEL-GAT-001-PRE): NÃO possui perfil específico, herda ficha base (isMaterialCustom = false), sem material fictício', async () => {
    const preto = variants.find((v) => v.sku === 'FEL-GAT-001-PRE');
    expect(preto).toBeDefined();
    expect(preto.name).toBe('Preto');
    expect(preto.isMaterialCustom).toBe(false);
    expect(Number(preto.productionCost)).toBe(2.12);

    // Confirma que NÃO existe ProductionProfile ativo para esta variante
    const profile = await prisma.productionProfile.findFirst({
      where: { variantId: preto.id, isActive: true },
    });
    expect(profile).toBeNull();

    // Confirma que NÃO existe material fictício no banco
    const fakeMaterial = await prisma.material.findFirst({
      where: { name: { contains: 'PRETO', mode: 'insensitive' } },
    });
    expect(fakeMaterial).toBeNull();
  });

  it('6. Branco (FEL-GAT-001-BCO): NÃO possui perfil específico, herda ficha base (isMaterialCustom = false), sem material fictício', async () => {
    const branco = variants.find((v) => v.sku === 'FEL-GAT-001-BCO');
    expect(branco).toBeDefined();
    expect(branco.name).toBe('Branco');
    expect(branco.isMaterialCustom).toBe(false);
    expect(Number(branco.productionCost)).toBe(2.12);

    const profile = await prisma.productionProfile.findFirst({
      where: { variantId: branco.id, isActive: true },
    });
    expect(profile).toBeNull();

    const fakeMaterial = await prisma.material.findFirst({
      where: { name: { contains: 'BRANCO', mode: 'insensitive' } },
    });
    expect(fakeMaterial).toBeNull();
  });

  it('7. Confirmação de que F12, Atacado, Custo Manual e Canais permaneceram inalterados', async () => {
    const reloaded = await prisma.product.findUnique({
      where: { id: product.id },
      include: { productChannelPrices: true },
    });

    expect(Number(reloaded?.wholesalePrice)).toBe(7.27);
    expect(Number(reloaded?.manualCost)).toBe(3.98);
    expect(reloaded?.costSource).toBe('MANUAL');
    expect(reloaded?.productChannelPrices.length).toBe(product.productChannelPrices.length);

    // Confirmação de que ProductVariant.price é nulo para todas as variantes
    const rawVariants = await prisma.productVariant.findMany({
      where: { productId: product.id },
    });
    for (const rv of rawVariants) {
      expect(rv.price).toBeNull();
    }
  });
});
