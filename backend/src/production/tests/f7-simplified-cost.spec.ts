import { Test, TestingModule } from '@nestjs/testing';
import { ProductionService } from '../production.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { InventoryService } from '../../inventory/inventory.service';
import { CostResolverService } from '../../pricing/services/cost-resolver.service';
import { MaterialCategory, MaterialUnit, MaterialType } from '@prisma/client';

describe('F7 — Simplificação do Custo de Produção + Materiais Adicionais + Embalagem', () => {
  let productionService: ProductionService;
  let costResolverService: CostResolverService;
  let prisma: PrismaService;

  let testPrinterId: string;
  let plaRosaId: string;
  let argolaId: string;
  let saquinhoId: string;
  let etiquetaId: string;
  let fitaMetroId: string;
  let gatinhoProduct: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        CostResolverService,
        PrismaService,
        AuditLogService,
        {
          provide: InventoryService,
          useValue: {
            adjustStock: jest.fn(),
          },
        },
      ],
    }).compile();

    productionService = module.get<ProductionService>(ProductionService);
    costResolverService = module.get<CostResolverService>(CostResolverService);
    prisma = module.get<PrismaService>(PrismaService);

    // 1. Impressora Bambu Lab A1 Mini com custo de R$ 0,35/h
    let printer = await prisma.printer.findFirst({
      where: { model: { contains: 'A1 Mini', mode: 'insensitive' } },
    });
    if (!printer) {
      printer = await prisma.printer.create({
        data: {
          name: 'Bambu Lab',
          model: 'A1 Mini',
          machineCostPerHour: 0.35,
          status: 'AVAILABLE',
        },
      });
    } else {
      printer = await prisma.printer.update({
        where: { id: printer.id },
        data: { machineCostPerHour: 0.35, status: 'AVAILABLE' },
      });
    }
    testPrinterId = printer.id;

    // 2. Material: PLA Rosa Claro (R$ 0,0900/g)
    let plaRosa = await prisma.material.findFirst({
      where: { name: { contains: 'ROSA CLARO', mode: 'insensitive' } },
    });
    if (!plaRosa) {
      plaRosa = await prisma.material.create({
        data: {
          name: 'PLA ROSA CLARO',
          category: MaterialCategory.PRODUCTION,
          type: MaterialType.PLA,
          unit: MaterialUnit.GRAM,
          costPerUnit: 0.09,
          currentQuantity: 1000,
        },
      });
    } else {
      plaRosa = await prisma.material.update({
        where: { id: plaRosa.id },
        data: { costPerUnit: 0.09, category: MaterialCategory.PRODUCTION, unit: MaterialUnit.GRAM },
      });
    }
    plaRosaId = plaRosa.id;

    // 3. Material adicional: Argola de chaveiro (R$ 0,35/unidade)
    let argola = await prisma.material.findFirst({
      where: { name: { contains: 'Argola', mode: 'insensitive' } },
    });
    if (!argola) {
      argola = await prisma.material.create({
        data: {
          name: 'Argola de chaveiro',
          category: MaterialCategory.COMPONENT,
          type: MaterialType.OTHER,
          unit: MaterialUnit.PIECE,
          costPerUnit: 0.35,
          currentQuantity: 500,
        },
      });
    }
    argolaId = argola.id;

    // 4. Embalagens: Saquinho plástico (R$ 0,18) e Etiqueta (R$ 0,12)
    let saquinho = await prisma.material.findFirst({
      where: { name: { contains: 'Saquinho', mode: 'insensitive' } },
    });
    if (!saquinho) {
      saquinho = await prisma.material.create({
        data: {
          name: 'Saquinho plástico',
          category: MaterialCategory.PACKAGING,
          type: MaterialType.OTHER,
          unit: MaterialUnit.PIECE,
          costPerUnit: 0.18,
          currentQuantity: 1000,
        },
      });
    }
    saquinhoId = saquinho.id;

    let etiqueta = await prisma.material.findFirst({
      where: { name: { contains: 'Etiqueta', mode: 'insensitive' } },
    });
    if (!etiqueta) {
      etiqueta = await prisma.material.create({
        data: {
          name: 'Etiqueta Felinodelia',
          category: MaterialCategory.PACKAGING,
          type: MaterialType.OTHER,
          unit: MaterialUnit.PIECE,
          costPerUnit: 0.12,
          currentQuantity: 1000,
        },
      });
    } else {
      etiqueta = await prisma.material.update({
        where: { id: etiqueta.id },
        data: { costPerUnit: 0.12 },
      });
    }
    etiquetaId = etiqueta.id;

    // 5. Material por metro para teste de unidade METER
    let fita = await prisma.material.findFirst({
      where: { name: 'Fita Cetim Teste' },
    });
    if (!fita) {
      fita = await prisma.material.create({
        data: {
          name: 'Fita Cetim Teste',
          category: MaterialCategory.COMPONENT,
          type: MaterialType.OTHER,
          unit: MaterialUnit.METER,
          costPerUnit: 0.20,
          currentQuantity: 100,
        },
      });
    }
    fitaMetroId = fita.id;

    // 6. Produto Porta Chaves Gatinho (FEL-GAT-001)
    gatinhoProduct = await prisma.product.findUnique({
      where: { sku: 'FEL-GAT-001' },
    });
    if (!gatinhoProduct) {
      gatinhoProduct = await prisma.product.create({
        data: {
          name: 'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
          sku: 'FEL-GAT-001',
          slug: 'porta-chaves-gatinho-felinodelia',
          basePrice: 39.9,
          status: 'ACTIVE',
        },
      });
    }
  }, 30000);

  afterAll(async () => {
    // Limpeza de testes pontuais (mantendo materiais oficiais)
    await prisma.material.deleteMany({ where: { name: { startsWith: 'TEST_MAT_' } } });
  }, 30000);

  describe('1. Unidades de Medida e Precisão de Custo', () => {
    it('deve calcular material por grama mantendo precisão de 4 casas decimais', async () => {
      // 12.64 g × R$ 0.09 = R$ 1.1376
      const tempProd = await prisma.product.create({
        data: {
          name: 'TEST_PROD_GRAMA_' + Date.now(),
          slug: 'test-prod-grama-' + Date.now(),
          sku: 'SKU-TEST-G-' + Date.now(),
          status: 'ACTIVE',
        },
      });

      const profile = await productionService.createProductionProfile({
        productId: tempProd.id,
        productionTimeMinutes: 0,
        productionTimeSeconds: 0,
        materials: [{ materialId: plaRosaId, quantity: 12.64, unit: MaterialUnit.GRAM }],
      });

      const estimate = await productionService.calculateEstimatedCost(profile.id);
      expect(estimate.filamentCost).toBe(1.14); // Exibir arredondado para R$ 1,14
      expect(estimate.breakdown.filament[0].totalCost).toBeCloseTo(1.1376, 3);

      // Limpeza
      await prisma.productionMaterial.deleteMany({ where: { productionProfileId: profile.id } });
      await prisma.productionProfile.delete({ where: { id: profile.id } });
      await prisma.product.delete({ where: { id: tempProd.id } });
    });

    it('deve calcular material por unidade (PIECE/unidade)', async () => {
      const tempProd = await prisma.product.create({
        data: {
          name: 'TEST_PROD_UN_' + Date.now(),
          slug: 'test-prod-un-' + Date.now(),
          sku: 'SKU-TEST-UN-' + Date.now(),
          status: 'ACTIVE',
        },
      });

      const profile = await productionService.createProductionProfile({
        productId: tempProd.id,
        materials: [{ materialId: argolaId, quantity: 2, unit: MaterialUnit.PIECE }],
      });

      const estimate = await productionService.calculateEstimatedCost(profile.id);
      expect(estimate.additionalMaterialsCost).toBe(0.70); // 2 × R$ 0,35 = R$ 0,70

      await prisma.productionMaterial.deleteMany({ where: { productionProfileId: profile.id } });
      await prisma.productionProfile.delete({ where: { id: profile.id } });
      await prisma.product.delete({ where: { id: tempProd.id } });
    });

    it('deve calcular material por metro (METER)', async () => {
      const tempProd = await prisma.product.create({
        data: {
          name: 'TEST_PROD_METRO_' + Date.now(),
          slug: 'test-prod-metro-' + Date.now(),
          sku: 'SKU-TEST-M-' + Date.now(),
          status: 'ACTIVE',
        },
      });

      // 0.30 m × R$ 0.20 = R$ 0.06
      const profile = await productionService.createProductionProfile({
        productId: tempProd.id,
        materials: [{ materialId: fitaMetroId, quantity: 0.30, unit: MaterialUnit.METER }],
      });

      const estimate = await productionService.calculateEstimatedCost(profile.id);
      expect(estimate.additionalMaterialsCost).toBe(0.06);

      await prisma.productionMaterial.deleteMany({ where: { productionProfileId: profile.id } });
      await prisma.productionProfile.delete({ where: { id: profile.id } });
      await prisma.product.delete({ where: { id: tempProd.id } });
    });
  });

  describe('2. Gestão Segura de Materiais: Edição, Arquivamento e Exclusão', () => {
    it('deve permitir editar dados do material (nome, custo, categoria, unidade)', async () => {
      const mat = await productionService.createMaterial({
        name: 'TEST_MAT_EDIT_' + Date.now(),
        category: MaterialCategory.COMPONENT,
        type: MaterialType.OTHER,
        unit: MaterialUnit.PIECE,
        costPerUnit: 0.50,
      });

      const updated = await productionService.updateMaterial(mat.id, {
        name: mat.name + '_EDITED',
        costPerUnit: 0.75,
        category: MaterialCategory.PACKAGING,
      });

      expect(updated.name).toContain('_EDITED');
      expect(Number(updated.costPerUnit)).toBe(0.75);
      expect(updated.category).toBe(MaterialCategory.PACKAGING);

      await prisma.material.delete({ where: { id: mat.id } });
    });

    it('deve permitir exclusão física se o material nunca tiver sido utilizado', async () => {
      const mat = await productionService.createMaterial({
        name: 'TEST_MAT_DELETE_' + Date.now(),
        category: MaterialCategory.COMPONENT,
        costPerUnit: 1.00,
        currentQuantity: 0,
      });

      const res = await productionService.deleteMaterial(mat.id);
      expect(res.deleted).toBe(true);
      expect(res.archived).toBe(false);

      const check = await prisma.material.findUnique({ where: { id: mat.id } });
      expect(check).toBeNull();
    });

    it('NÃO deve apagar fisicamente material que já foi utilizado em ficha técnica (arquivamento seguro)', async () => {
      const mat = await productionService.createMaterial({
        name: 'TEST_MAT_IN_USE_' + Date.now(),
        category: MaterialCategory.COMPONENT,
        costPerUnit: 1.50,
      });

      const tempProd = await prisma.product.create({
        data: {
          name: 'TEST_PROD_USE_' + Date.now(),
          slug: 'test-prod-use-' + Date.now(),
          sku: 'SKU-USE-' + Date.now(),
          status: 'ACTIVE',
        },
      });

      const profile = await productionService.createProductionProfile({
        productId: tempProd.id,
        materials: [{ materialId: mat.id, quantity: 1 }],
      });

      // Tentativa de deleção do material em uso
      const res = await productionService.deleteMaterial(mat.id);
      expect(res.deleted).toBe(false);
      expect(res.archived).toBe(true);

      const check = await prisma.material.findUnique({ where: { id: mat.id } });
      expect(check).not.toBeNull();
      expect(check!.isActive).toBe(false); // Desativado/arquivado com segurança

      // Limpeza
      await prisma.productionMaterial.deleteMany({ where: { productionProfileId: profile.id } });
      await prisma.productionProfile.delete({ where: { id: profile.id } });
      await prisma.product.delete({ where: { id: tempProd.id } });
      await prisma.material.delete({ where: { id: mat.id } });
    });
  });

  describe('3. Múltiplos Cenários de Produção', () => {
    it('deve calcular corretamente produto que possui apenas Filamento + Máquina', async () => {
      const tempProd = await prisma.product.create({
        data: {
          name: 'TEST_PROD_ONLY_PRINT_' + Date.now(),
          slug: 'test-prod-only-print-' + Date.now(),
          sku: 'SKU-ONLY-PRINT-' + Date.now(),
          status: 'ACTIVE',
        },
      });

      // 10g Rosa Claro (R$ 0,90) + 1 hora de máquina a R$ 0,35 = R$ 1,25
      const profile = await productionService.createProductionProfile({
        productId: tempProd.id,
        printerId: testPrinterId,
        productionTimeSeconds: 3600, // 1 hora
        materials: [{ materialId: plaRosaId, quantity: 10, unit: MaterialUnit.GRAM }],
      });

      const estimate = await productionService.calculateEstimatedCost(profile.id);
      expect(estimate.filamentCost).toBe(0.90);
      expect(estimate.machineCost).toBe(0.35);
      expect(estimate.additionalMaterialsCost).toBe(0);
      expect(estimate.packagingCost).toBe(0);
      expect(estimate.totalCost).toBe(1.25);

      await prisma.productionMaterial.deleteMany({ where: { productionProfileId: profile.id } });
      await prisma.productionProfile.delete({ where: { id: profile.id } });
      await prisma.product.delete({ where: { id: tempProd.id } });
    });

    it('deve suportar múltiplos filamentos somando os custos separadamente', async () => {
      const plaBranco = await prisma.material.create({
        data: {
          name: 'TEST_MAT_PLA_BRANCO_' + Date.now(),
          category: MaterialCategory.PRODUCTION,
          type: MaterialType.PLA,
          unit: MaterialUnit.GRAM,
          costPerUnit: 0.10, // R$ 0,10/g
        },
      });

      const tempProd = await prisma.product.create({
        data: {
          name: 'TEST_PROD_MULTI_FIL_' + Date.now(),
          slug: 'test-prod-multi-fil-' + Date.now(),
          sku: 'SKU-MULTI-FIL-' + Date.now(),
          status: 'ACTIVE',
        },
      });

      // PLA Rosa: 12g × 0.09 = 1.08
      // PLA Branco: 2g × 0.10 = 0.20
      // Filamento total = 1.28
      const profile = await productionService.createProductionProfile({
        productId: tempProd.id,
        printerId: testPrinterId,
        productionTimeSeconds: 0,
        materials: [
          { materialId: plaRosaId, quantity: 12, unit: MaterialUnit.GRAM },
          { materialId: plaBranco.id, quantity: 2, unit: MaterialUnit.GRAM },
        ],
      });

      const estimate = await productionService.calculateEstimatedCost(profile.id);
      expect(estimate.filamentCost).toBe(1.28);
      expect(estimate.breakdown.filament.length).toBe(2);

      await prisma.productionMaterial.deleteMany({ where: { productionProfileId: profile.id } });
      await prisma.productionProfile.delete({ where: { id: profile.id } });
      await prisma.product.delete({ where: { id: tempProd.id } });
      await prisma.material.delete({ where: { id: plaBranco.id } });
    });
  });

  describe('4. Homologação Oficial do Porta Chaves Gatinho (FEL-GAT-001)', () => {
    it('deve calcular exatamente a Ficha Técnica especificada pelo usuário: Filamento R$ 1,14 + Máquina R$ 0,33 + Argola R$ 0,35 + Embalagem R$ 0,30 = Total R$ 2,12', async () => {
      // 56m03s = 56 * 60 + 3 = 3363 segundos
      // Horas: 3363 / 3600 = 0.9341666... h
      // Custo Máquina: 0.9341666... × R$ 0.35/h = R$ 0.326958... -> Exibir R$ 0,33
      // PLA Rosa Claro: 12.64 g × R$ 0.09 = R$ 1.1376 -> Exibir R$ 1,14
      // Argola de chaveiro: 1 un × R$ 0.35 = R$ 0.35
      // Saquinho plástico: 1 un × R$ 0.18 = R$ 0.18
      // Etiqueta Felinodelia: 1 un × R$ 0.12 = R$ 0.12
      // Embalagem total: R$ 0,30
      // Limpa fichas técnicas anteriores do produto para garantir teste limpo
      const oldProfiles = await prisma.productionProfile.findMany({
        where: { productId: gatinhoProduct.id },
      });
      for (const op of oldProfiles) {
        await prisma.productionMaterial.deleteMany({ where: { productionProfileId: op.id } });
        await prisma.productionProfile.delete({ where: { id: op.id } });
      }

      // Cria ou atualiza a Ficha Técnica oficial do Porta-Chaves Gatinho
      const profile = await productionService.createProductionProfile({
        productId: gatinhoProduct.id,
        printerId: testPrinterId,
        productionTimeSeconds: 3363, // 56m03s
        materials: [
          { materialId: plaRosaId, quantity: 12.64, unit: MaterialUnit.GRAM },
          { materialId: argolaId, quantity: 1, unit: MaterialUnit.PIECE },
          { materialId: saquinhoId, quantity: 1, unit: MaterialUnit.PIECE },
          { materialId: etiquetaId, quantity: 1, unit: MaterialUnit.PIECE },
        ],
      });

      expect(profile).toBeDefined();
      expect(profile.productId).toBe(gatinhoProduct.id);

      const estimate = await productionService.calculateEstimatedCost(profile.id);

      expect(estimate.filamentCost).toBe(1.14);
      expect(estimate.machineCost).toBe(0.33);
      expect(estimate.additionalMaterialsCost).toBe(0.35);
      expect(estimate.packagingCost).toBe(0.30);
      expect(estimate.totalCost).toBe(2.12);

      expect(estimate.breakdown.machine.timeFormatted).toBe('56m03s');
      expect(estimate.breakdown.machine.ratePerHour).toBe(0.35);

      // Garante costSource COST_FROM_F7 para testar resolução direta do F7
      await prisma.product.update({
        where: { id: gatinhoProduct.id },
        data: { costSource: 'COST_FROM_F7' },
      });

      // Validação da integração com CostResolverService:
      // O CostResolver deve retornar 2.12 e source = 'PRODUCTION'
      const costRes = await costResolverService.resolveCost(gatinhoProduct.id);
      expect(costRes.source).toBe('PRODUCTION');
      expect(Number(costRes.cost)).toBe(2.12);
      expect(costRes.isPartial).toBe(false);

      // Restaura para MANUAL R$ 3,98 / Atacado R$ 7,27 conforme homologação comercial
      await prisma.product.update({
        where: { id: gatinhoProduct.id },
        data: { costSource: 'MANUAL', manualCost: 3.98, wholesalePrice: 7.27 },
      });

      // Confirmação de que Product.basePrice (39.90) NÃO É USADO como custo
      expect(Number(costRes.cost)).not.toBe(Number(gatinhoProduct.basePrice));
    });

    it('deve recalcular automaticamente ao alterar tempo ou quantidades na ficha técnica', async () => {
      const existing = await prisma.productionProfile.findFirst({
        where: { productId: gatinhoProduct.id },
      });
      expect(existing).toBeDefined();

      // Altera o tempo para 1h30 (5400 segundos) e adiciona 2 argolas
      const updated = await productionService.updateProductionProfile(existing!.id, {
        productionTimeSeconds: 5400,
        materials: [
          { materialId: plaRosaId, quantity: 12.64, unit: MaterialUnit.GRAM },
          { materialId: argolaId, quantity: 2, unit: MaterialUnit.PIECE },
          { materialId: saquinhoId, quantity: 1, unit: MaterialUnit.PIECE },
          { materialId: etiquetaId, quantity: 1, unit: MaterialUnit.PIECE },
        ],
      });

      const newEstimate = await productionService.calculateEstimatedCost(updated.id);
      // 1.5h * 0.35 = 0.525 -> R$ 0,53 de máquina
      // 2 argolas * 0.35 = R$ 0,70
      // Filamento = 1.14
      // Embalagem = 0.30
      // Total = 1.14 + 0.53 + 0.70 + 0.30 = 2.67
      expect(newEstimate.machineCost).toBe(0.53);
      expect(newEstimate.additionalMaterialsCost).toBe(0.70);
      expect(newEstimate.totalCost).toBe(2.67); // 1.14 + 0.53 + 0.70 + 0.30 = 2.67

      // Restaura para a especificação original do Gatinho (R$ 2,12)
      await productionService.updateProductionProfile(existing!.id, {
        productionTimeSeconds: 3363,
        materials: [
          { materialId: plaRosaId, quantity: 12.64, unit: MaterialUnit.GRAM },
          { materialId: argolaId, quantity: 1, unit: MaterialUnit.PIECE },
          { materialId: saquinhoId, quantity: 1, unit: MaterialUnit.PIECE },
          { materialId: etiquetaId, quantity: 1, unit: MaterialUnit.PIECE },
        ],
      });

      const restoredEstimate = await productionService.calculateEstimatedCost(existing!.id);
      expect(restoredEstimate.totalCost).toBe(2.12);
    });
  });
});
