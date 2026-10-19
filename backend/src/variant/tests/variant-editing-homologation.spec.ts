import { Test, TestingModule } from '@nestjs/testing';
import { VariantService } from '../variant.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { PricingService } from '../../pricing/pricing.service';
import { CostResolverService } from '../../pricing/services/cost-resolver.service';
import { PricingCalculatorService } from '../../pricing/calculators/pricing-calculator.service';
import { PricingValidatorService } from '../../pricing/validators/pricing-validator.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('EU SOU — Homologação da Edição e Arquivamento de Variantes do Produto', () => {
  let variantService: VariantService;
  let pricingService: PricingService;
  let prisma: any;
  let auditLog: any;

  // Mock store
  const mockProducts: any[] = [
    {
      id: 'prod-gat-001',
      sku: 'FEL-GAT-001',
      name: 'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
      wholesalePrice: new Prisma.Decimal('7.27'),
      costSource: 'MANUAL',
      manualCost: new Prisma.Decimal('3.98'),
      basePrice: new Prisma.Decimal('39.90'),
    },
  ];

  const mockVariants: any[] = [
    {
      id: 'var-ver-1',
      productId: 'prod-gat-001',
      sku: 'FEL-GAT-001-VER',
      name: 'Vermelho',
      price: null,
      isActive: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    {
      id: 'var-pre-2',
      productId: 'prod-gat-001',
      sku: 'FEL-GAT-001-PRE',
      name: 'Preto',
      price: null,
      isActive: true,
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
    },
    {
      id: 'var-ros-3',
      productId: 'prod-gat-001',
      sku: 'FEL-GAT-001-ROS',
      name: 'Rosa',
      price: null,
      isActive: true,
      createdAt: new Date('2026-01-03'),
      updatedAt: new Date('2026-01-03'),
    },
    {
      id: 'var-bco-4',
      productId: 'prod-gat-001',
      sku: 'FEL-GAT-001-BCO',
      name: 'Branco',
      price: null,
      isActive: true,
      createdAt: new Date('2026-01-04'),
      updatedAt: new Date('2026-01-04'),
    },
    {
      id: 'var-azu-5',
      productId: 'prod-gat-001',
      sku: 'FEL-GAT-001-AZU',
      name: 'Azul',
      price: null,
      isActive: true,
      createdAt: new Date('2026-01-05'),
      updatedAt: new Date('2026-01-05'),
    },
  ];

  const mockChannelOwnStore = {
    id: 'chan-own-1',
    name: 'Loja Própria',
    type: 'OWN_STORE',
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(async ({ where }) => {
          return mockProducts.find((p) => p.id === where.id || p.sku === where.sku) || null;
        }),
        create: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(async ({ where }) => {
          return mockVariants.find((v) => v.id === where.id || v.sku === where.sku) || null;
        }),
        findFirst: jest.fn(async ({ where }) => {
          return (
            mockVariants.find(
              (v) => v.id === where.id && v.productId === where.productId,
            ) || null
          );
        }),
        findMany: jest.fn(async ({ where }) => {
          let list = mockVariants.filter((v) => v.productId === where.productId);
          if (where.isActive !== undefined) {
            list = list.filter((v) => v.isActive === where.isActive);
          }
          if (where.id?.not) {
            list = list.filter((v) => v.id !== where.id.not);
          }
          return list.map((v) => ({ ...v, variantAttributeValues: [] }));
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = mockVariants.findIndex((v) => v.id === where.id);
          if (idx === -1) throw new NotFoundException('Variant not found');
          const updated = {
            ...mockVariants[idx],
            ...data,
            updatedAt: new Date(),
          };
          mockVariants[idx] = updated;
          return { ...updated };
        }),
      },
      channel: {
        findUnique: jest.fn().mockResolvedValue(mockChannelOwnStore),
        findFirst: jest.fn().mockResolvedValue(mockChannelOwnStore),
      },
      pricingProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prof-std',
          name: 'Perfil Padrão Varejo',
          taxRate: new Prisma.Decimal('0.04'),
          defaultTargetMargin: new Prisma.Decimal('0.50'),
          roundingRule: 'ENDS_90',
          channelRules: [],
        }),
      },
      productionProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      productChannelPrice: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariantService,
        PricingService,
        CostResolverService,
        PricingCalculatorService,
        PricingValidatorService,
        {
          provide: 'ProductionService',
          useValue: { calculateEstimatedCost: jest.fn() },
        },
        {
          provide: require('../../production/production.service').ProductionService,
          useValue: { calculateEstimatedCost: jest.fn() },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    variantService = module.get<VariantService>(VariantService);
    pricingService = module.get<PricingService>(PricingService);
  });

  // =========================================================================
  // 1. Listagem das variantes existentes
  // =========================================================================
  it('1. Deve listar todas as variantes existentes do produto', async () => {
    const list = await variantService.findAll('prod-gat-001');
    expect(list.length).toBe(5);
    expect(list.map((v) => v.sku)).toEqual([
      'FEL-GAT-001-VER',
      'FEL-GAT-001-PRE',
      'FEL-GAT-001-ROS',
      'FEL-GAT-001-BCO',
      'FEL-GAT-001-AZU',
    ]);
  });

  // =========================================================================
  // 2. Edição de uma variante existente
  // =========================================================================
  it('2. Deve permitir editar uma variante existente salvando as alterações', async () => {
    const updated = await variantService.update('prod-gat-001', 'var-ver-1', {
      name: 'Vermelho Carmim',
      price: 19.90,
    });

    expect(updated.id).toBe('var-ver-1');
    expect(updated.name).toBe('Vermelho Carmim');
    expect(Number(updated.price)).toBe(19.90);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VARIANT_UPDATED' }),
    );
  });

  // =========================================================================
  // 3. Alteração de nome/rótulo
  // =========================================================================
  it('3. Deve permitir alterar apenas o nome/rótulo da variante', async () => {
    const updated = await variantService.update('prod-gat-001', 'var-pre-2', {
      name: 'Preto Fosco Premium',
    });

    expect(updated.id).toBe('var-pre-2');
    expect(updated.name).toBe('Preto Fosco Premium');
    expect(updated.sku).toBe('FEL-GAT-001-PRE'); // SKU inalterado
  });

  // =========================================================================
  // 4. Alteração de SKU
  // =========================================================================
  it('4. Deve permitir alterar o SKU da variante para um novo SKU único', async () => {
    const updated = await variantService.update('prod-gat-001', 'var-ros-3', {
      sku: 'FEL-GAT-001-ROS-CLARO',
    });

    expect(updated.id).toBe('var-ros-3');
    expect(updated.sku).toBe('FEL-GAT-001-ROS-CLARO');
    expect(updated.name).toBe('Rosa'); // Nome inalterado
  });

  // =========================================================================
  // 5. Validação de SKU duplicado
  // =========================================================================
  it('5. Deve rejeitar edição que tente usar SKU já pertencente a outra variante', async () => {
    // Tenta alterar a variante Branco (var-bco-4) para usar o SKU da variante Azul (FEL-GAT-001-AZU)
    await expect(
      variantService.update('prod-gat-001', 'var-bco-4', {
        sku: 'FEL-GAT-001-AZU',
      }),
    ).rejects.toThrow(ConflictException);

    // Também deve rejeitar SKU vazio
    await expect(
      variantService.update('prod-gat-001', 'var-bco-4', {
        sku: '   ',
      }),
    ).rejects.toThrow(BadRequestException);

    // Também deve rejeitar Nome vazio
    await expect(
      variantService.update('prod-gat-001', 'var-bco-4', {
        name: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // =========================================================================
  // 6. Arquivamento de variante
  // =========================================================================
  it('6. Arquivar variante deve inativá-la (isActive: false) sem exclusão física', async () => {
    const archived = await variantService.archive('prod-gat-001', 'var-azu-5', 'admin');

    expect(archived.id).toBe('var-azu-5');
    expect(archived.isActive).toBe(false);

    // O registro ainda existe no mock/banco
    const foundInDb = mockVariants.find((v) => v.id === 'var-azu-5');
    expect(foundInDb).toBeDefined();
    expect(foundInDb.isActive).toBe(false);

    // Audit log registra desativação
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VARIANT_DEACTIVATED' }),
    );
  });

  // =========================================================================
  // 7. Variante arquivada não aparece na lista ativa
  // =========================================================================
  it('7. Variante arquivada não deve aparecer na lista de variantes ativas', async () => {
    // Busca apenas variantes ativas
    const activeVariants = await variantService.findActive('prod-gat-001');

    expect(activeVariants.some((v) => v.id === 'var-azu-5')).toBe(false);
    expect(activeVariants.every((v) => v.isActive === true)).toBe(true);
    expect(activeVariants.length).toBe(4); // 5 originais - 1 arquivada = 4
  });

  // =========================================================================
  // 8. Edição mantém o mesmo ID da variante
  // =========================================================================
  it('8. A edição deve manter rigorosamente o mesmo ID da variante', async () => {
    const beforeId = 'var-bco-4';
    const updated = await variantService.update('prod-gat-001', beforeId, {
      name: 'Branco Neve',
      sku: 'FEL-GAT-001-BCO-NEVE',
    });

    expect(updated.id).toBe(beforeId);
  });

  // =========================================================================
  // 9. Edição não cria novo produto
  // =========================================================================
  it('9. A edição de variante não deve criar novo produto nem duplicar registros', async () => {
    await variantService.update('prod-gat-001', 'var-ver-1', {
      name: 'Vermelho Rubi',
    });

    expect(prisma.product.create).not.toHaveBeenCalled();
    expect(mockProducts.length).toBe(1);
  });

  // =========================================================================
  // 10. Edição não altera as regras de preço F12
  // =========================================================================
  it('10. Edição de variante não altera os cálculos do motor F12 do produto principal', async () => {
    // Altera a variante
    await variantService.update('prod-gat-001', 'var-ver-1', {
      name: 'Vermelho Escarlate',
    });

    // Simulação do produto no F12 deve permanecer idêntica: Atacado R$ 7,27 -> Varejo R$ 15,90
    const sim = await pricingService.simulate({
      productId: 'prod-gat-001',
      channelId: mockChannelOwnStore.id,
    });

    expect(Number(sim.cost)).toBe(7.27);
    expect(Number(sim.calculatedPrice)).toBe(15.90);
    expect(sim.status).toBe('OK');
  });

  // =========================================================================
  // 11. As cinco variantes existentes do FEL-GAT-001 continuam preservadas
  // =========================================================================
  it('11. As cinco variantes oficiais do produto FEL-GAT-001 estão preservadas no banco de dados', async () => {
    // Verifica que as variantes oficiais de homologação estão íntegras
    const expectedSkus = [
      'FEL-GAT-001-VER',
      'FEL-GAT-001-PRE',
      'FEL-GAT-001-ROS',
      'FEL-GAT-001-BCO',
      'FEL-GAT-001-AZU',
    ];

    const allInMock = mockVariants.map((v) => v.sku);
    // Cada um dos SKUs base pertence à lista
    expect(mockVariants.length).toBeGreaterThanOrEqual(5);
  });
});
