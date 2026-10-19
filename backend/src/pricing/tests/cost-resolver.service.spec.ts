import { Test, TestingModule } from '@nestjs/testing';
import { CostResolverService } from '../services/cost-resolver.service';
import { ProductionService } from '../../production/production.service';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';

describe('CostResolverService', () => {
  let service: CostResolverService;
  let prisma: any;
  let productionService: any;

  beforeEach(async () => {
    prisma = {
      productionProfile: {
        findFirst: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };

    productionService = {
      calculateEstimatedCost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostResolverService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductionService, useValue: productionService },
      ],
    }).compile();

    service = module.get<CostResolverService>(CostResolverService);
  });

  it('Prioridade 2: deve retornar custo manual explícito quando fornecido', async () => {
    const res = await service.resolveCost('prod-1', null, 15.5);
    expect(res.source).toBe('MANUAL');
    expect(res.cost.toString()).toBe('15.5');
    expect(res.isPartial).toBe(false);
    expect(productionService.calculateEstimatedCost).not.toHaveBeenCalled();
  });

  it('Prioridade 1: deve consumir custo do F7 via ProductionProfile ativo', async () => {
    prisma.productionProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 12.85,
      isPartial: false,
    });

    const res = await service.resolveCost('prod-1');
    expect(res.source).toBe('PRODUCTION');
    expect(res.cost.toString()).toBe('12.85');
    expect(res.isPartial).toBe(false);
    expect(productionService.calculateEstimatedCost).toHaveBeenCalledWith(
      'prof-1',
      1,
    );
  });

  it('Prioridade 1 (Variante): deve buscar primeiro perfil específico da variante', async () => {
    prisma.productionProfile.findFirst.mockResolvedValueOnce({
      id: 'prof-var',
    });
    productionService.calculateEstimatedCost.mockResolvedValue({
      totalCost: 18.2,
      isPartial: false,
    });

    const res = await service.resolveCost('prod-1', 'var-1');
    expect(res.source).toBe('PRODUCTION');
    expect(res.cost.toString()).toBe('18.2');
    expect(prisma.productionProfile.findFirst).toHaveBeenCalledWith({
      where: { variantId: 'var-1', isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('Regra Oficial: nunca utilizar basePrice do produto como custo quando F7 e manual não existirem', async () => {
    prisma.productionProfile.findFirst.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      basePrice: new Prisma.Decimal('29.90'),
    });

    const res = await service.resolveCost('prod-1');
    expect(res.source).toBe('NONE');
    expect(res.cost.toString()).toBe('0');
    expect(res.warnings).toContain(
      'Nenhuma fonte de custo de produção F7 encontrada para o produto/variante. Precificação comercial retida.',
    );
  });

  it('Fallback final: define custo como zero e adiciona warning se nenhuma fonte existir', async () => {
    prisma.productionProfile.findFirst.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      basePrice: null,
    });

    const res = await service.resolveCost('prod-1');
    expect(res.source).toBe('NONE');
    expect(res.cost.toString()).toBe('0');
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});
