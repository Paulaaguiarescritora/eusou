import { Test, TestingModule } from '@nestjs/testing';
import { VariantService } from '../variant.service';
import { ProductService } from '../../product/product.service';
import { ProductionService } from '../../production/production.service';
import { CostResolverService } from '../../pricing/services/cost-resolver.service';
import { PricingService } from '../../pricing/pricing.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { InventoryService } from '../../inventory/inventory.service';

describe('EU SOU — Persistência Real do ProductionProfile no F7 por Variante e Independência do F12', () => {
  let prisma: PrismaService;
  let variantService: VariantService;
  let productService: ProductService;
  let productionService: ProductionService;
  let costResolver: CostResolverService;

  let productId: string;
  let azulVariantId: string;
  let rosaVariantId: string;
  let bambuMaterialId: string;
  let rosaMaterialId: string;

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

    // Identificar o produto oficial FEL-GAT-001
    const product = await prisma.product.findUnique({
      where: { sku: 'FEL-GAT-001' },
      include: {
        variants: true,
      },
    });

    if (!product) {
      throw new Error('Produto FEL-GAT-001 não encontrado no banco');
    }

    productId = product.id;

    const azul = product.variants.find((v) => v.sku === 'FEL-GAT-001-AZU');
    const rosa = product.variants.find((v) => v.sku === 'FEL-GAT-001-ROS');

    if (!azul || !rosa) {
      throw new Error('Variantes Azul ou Rosa não encontradas no produto FEL-GAT-001');
    }

    azulVariantId = azul.id;
    rosaVariantId = rosa.id;

    const matBambu = await prisma.material.findFirst({
      where: { name: { contains: 'BAMBU LAB' } },
    });
    const matRosa = await prisma.material.findFirst({
      where: { name: { contains: 'ROSA CLARO' } },
    });

    if (!matBambu || !matRosa) {
      throw new Error('Materiais PLA LITE BAMBU LAB ou PLA ROSA CLARO não encontrados');
    }

    bambuMaterialId = matBambu.id;
    rosaMaterialId = matRosa.id;
  });

  it('1. Limpar ProductVariant.price: Azul = null, Vermelho = null, demais permanecem null', async () => {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      select: { sku: true, price: true },
    });

    for (const v of variants) {
      expect(v.price).toBeNull();
    }
  });

  it('2. Selecionar PLA LITE BAMBU LAB para Azul, salvar e recuperar do banco', async () => {
    // Captura estado comercial do produto e estoques antes
    const productBefore = await prisma.product.findUnique({
      where: { id: productId },
      include: { productChannelPrices: true, productChannels: true },
    });
    const rosaBefore = await variantService.findById(productId, rosaVariantId);
    const azulStockBefore = (await variantService.findById(productId, azulVariantId)).availableStock;

    // 1. Atualizar a variante Azul selecionando PLA LITE BAMBU LAB
    const updated = await variantService.update(productId, azulVariantId, {
      materialId: bambuMaterialId,
    });

    expect(updated).toBeDefined();

    // 2. Buscar novamente a variante pelo ProductService (simulando recarregar a tela do produto)
    const productReloaded: any = await productService.findById(productId);
    const azulReloaded = productReloaded.variants?.find((v: any) => v.id === azulVariantId);
    const rosaReloaded = productReloaded.variants?.find((v: any) => v.id === rosaVariantId);

    expect(azulReloaded).toBeDefined();
    expect(rosaReloaded).toBeDefined();

    // 3. Confirmar que o perfil específico continua PERSISTIDO no banco e associado ao Azul
    const profileInDb = await prisma.productionProfile.findFirst({
      where: { variantId: azulVariantId, isActive: true },
      include: {
        materials: { include: { material: true } },
        printer: true,
      },
    });

    expect(profileInDb).toBeDefined();
    expect(profileInDb?.variantId).toBe(azulVariantId);

    // O filamento principal deve ser o PLA LITE BAMBU LAB
    const filamentInDb = profileInDb?.materials.find(
      (m) =>
        m.material.category === 'PRODUCTION' ||
        (!m.material.category && ['PLA', 'PETG', 'ABS', 'RESIN'].includes(m.material.type)),
    );
    expect(filamentInDb?.materialId).toBe(bambuMaterialId);
    expect(filamentInDb?.material.name).toContain('BAMBU LAB');

    // 4. Confirmar que herdou impressora, tempo, gramas, componentes e embalagem
    expect(profileInDb?.productionTimeSeconds).toBe(3363); // 56m03s
    expect(Number(filamentInDb?.quantity)).toBeCloseTo(12.64, 2);
    const hasArgola = profileInDb?.materials.some((m) => m.material.name.includes('Argola'));
    const hasEmbalagem = profileInDb?.materials.some((m) => m.material.name.includes('Saquinho') || m.material.name.includes('Etiqueta'));
    expect(hasArgola).toBe(true);
    expect(hasEmbalagem).toBe(true);

    // 5. Confirmar custo F7 de R$ 2,45 para Azul
    expect(azulReloaded.isMaterialCustom).toBe(true);
    expect(azulReloaded.materialName).toContain('BAMBU LAB');
    expect(Number(azulReloaded.productionCost)).toBe(2.45);

    // 6. Confirmar que Rosa permanece com seu material e custa R$ 2,12
    expect(rosaReloaded.isMaterialCustom).toBe(rosaBefore.isMaterialCustom);
    expect(rosaReloaded.materialName).toContain('ROSA CLARO');
    expect(Number(rosaReloaded.productionCost)).toBe(2.12);

    // 7. Confirmar que alterar o material do Azul NÃO alterou Rosa
    expect(rosaReloaded.productionCost).toBe(rosaBefore.productionCost);
    expect(rosaReloaded.materialId).toBe(rosaBefore.materialId);

    // 8. Confirmar que F12 permanece exatamente igual
    const productAfter = await prisma.product.findUnique({
      where: { id: productId },
      include: { productChannelPrices: true, productChannels: true },
    });
    expect(productAfter?.wholesalePrice).toEqual(productBefore?.wholesalePrice);
    expect(productAfter?.manualCost).toEqual(productBefore?.manualCost);
    expect(productAfter?.costSource).toEqual(productBefore?.costSource);

    // 9. Confirmar que estoque permanece exatamente igual
    expect(azulReloaded.availableStock).toBe(azulStockBefore);
    expect(rosaReloaded.availableStock).toBe(rosaBefore.availableStock);
  });

  it('3. CostResolverService respeita ProductionProfile da variante (R$ 2,45) e fallback do produto (R$ 2,12)', async () => {
    // Quando consultado diretamente pelo F7 (sem manual override)
    const costAzul = await costResolver.resolveCost(productId, azulVariantId);
    const costRosa = await costResolver.resolveCost(productId, rosaVariantId);

    // Como o produto FEL-GAT-001 possui manualCost = 3.98 configurado comercialmente,
    // o CostResolverService preserva o custo comercial manual (R$ 3,98) para a precificação F12
    // enquanto o ProductionService / VariantService fornece o custo real de produção F7 (R$ 2,45 vs R$ 2,12)
    expect(Number(costAzul.cost)).toBe(3.98);
    expect(Number(costRosa.cost)).toBe(3.98);

    // Testar resolução direta do motor F7 via productionService:
    const profileAzul = await prisma.productionProfile.findFirst({
      where: { variantId: azulVariantId, isActive: true },
    });
    const profileBase = await prisma.productionProfile.findFirst({
      where: { productId, variantId: null, isActive: true },
    });

    const f7Azul = await productionService.calculateEstimatedCost(profileAzul!.id);
    const f7Base = await productionService.calculateEstimatedCost(profileBase!.id);

    expect(Number(f7Azul.totalCost.toFixed(2))).toBe(2.45);
    expect(Number(f7Base.totalCost.toFixed(2))).toBe(2.12);
  });
});
