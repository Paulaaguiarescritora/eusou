import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ProductionService } from '../../production/production.service';

export interface CostResolution {
  source: 'PRODUCTION' | 'MANUAL' | 'NONE';
  cost: Prisma.Decimal;
  isPartial: boolean;
  productionProfileId?: string;
  warnings: string[];
}

@Injectable()
export class CostResolverService {
  private readonly logger = new Logger(CostResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productionService: ProductionService,
  ) {}

  /**
   * Resolve o custo comercial do produto/variante conforme regras oficiais:
   * 1. Custo manual explícito fornecido via parâmetro (costOverride);
   * 2. Se product.costSource === 'MANUAL', utiliza product.manualCost;
   * 3. Se product.costSource === 'COST_FROM_F7', consome o custo de produção F7 (ProductionProfile ativo);
   * 4. Ausência de custo: retorna 'NONE' e custo 0 (não inventa custo nem usa basePrice).
   */
  async resolveCost(
    productId: string,
    variantId?: string | null,
    costOverride?: number | Prisma.Decimal | null,
  ): Promise<CostResolution> {
    const warnings: string[] = [];

    // Prioridade 1: Custo manual explícito via parâmetro
    if (costOverride !== undefined && costOverride !== null) {
      const manualCost = new Prisma.Decimal(costOverride.toString());
      if (manualCost.greaterThan(0)) {
        return {
          source: 'MANUAL',
          cost: manualCost,
          isPartial: false,
          warnings,
        };
      }
    }

    // Consulta configuração de Custo Comercial do Produto (F7 vs MANUAL)
    let product: any = null;
    if (this.prisma.product?.findUnique) {
      try {
        product = await this.prisma.product.findUnique({
          where: { id: productId },
          select: { costSource: true, manualCost: true },
        });
      } catch (err: any) {
        this.logger.warn(`Erro ao consultar dados de custo do produto ${productId}: ${err?.message}`);
      }
    }

    // Se o produto estiver configurado explicitamente com custo comercial MANUAL
    if (product && product.costSource === 'MANUAL') {
      if (product.manualCost !== null && product.manualCost !== undefined) {
        const manualDecimal = new Prisma.Decimal(product.manualCost.toString());
        if (manualDecimal.greaterThan(0)) {
          return {
            source: 'MANUAL',
            cost: manualDecimal,
            isPartial: false,
            warnings,
          };
        }
      }
      warnings.push(
        'Custo comercial manual não foi informado ou é zero. Precificação comercial retida.',
      );
      return {
        source: 'NONE',
        cost: new Prisma.Decimal(0),
        isPartial: true,
        warnings,
      };
    }

    // Prioridade 2: Custo calculado pelo F7 via ProductionProfile ativo
    try {
      // Procura primeiro perfil para a variante específica (se houver)
      let profile = null;
      if (variantId) {
        profile = await this.prisma.productionProfile.findFirst({
          where: {
            variantId,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      // Se não encontrou para variante, procura para o produto
      if (!profile) {
        profile = await this.prisma.productionProfile.findFirst({
          where: {
            productId,
            variantId: null,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (profile) {
        const estimate = await this.productionService.calculateEstimatedCost(
          profile.id,
          1,
        );
        if (estimate && estimate.totalCost > 0) {
          if (estimate.isPartial) {
            warnings.push(
              'Custo de produção do F7 é parcial (ausência de configuração de energia ou impressora).',
            );
          }
          return {
            source: 'PRODUCTION',
            cost: new Prisma.Decimal(estimate.totalCost.toFixed(2)),
            isPartial: estimate.isPartial,
            productionProfileId: profile.id,
            warnings,
          };
        }
      }
    } catch (err: any) {
      this.logger.warn(`Erro ao resolver custo F7: ${err?.message}`);
      warnings.push(
        `Falha ao consultar custo de produção do F7: ${err?.message}`,
      );
    }

    // REGRA DE NEGÓCIO OFICIAL:
    // Não interpretar Product.basePrice ou variant.price como custo.
    // Se não houver custo F7 válido e nem override/manual, o custo é ausente ('NONE').
    warnings.push(
      'Nenhuma fonte de custo de produção F7 encontrada para o produto/variante. Precificação comercial retida.',
    );
    return {
      source: 'NONE',
      cost: new Prisma.Decimal(0),
      isPartial: true,
      warnings,
    };
  }

  /**
   * Retorna exclusivamente o custo de produção F7 calculado (para fins de exibição/comparação)
   */
  async getProductionCostOnly(
    productId: string,
    variantId?: string | null,
  ): Promise<number | null> {
    try {
      let profile = null;
      if (variantId) {
        profile = await this.prisma.productionProfile.findFirst({
          where: { variantId, isActive: true },
        });
      }
      if (!profile) {
        profile = await this.prisma.productionProfile.findFirst({
          where: { productId, variantId: null, isActive: true },
        });
      }
      if (profile) {
        const estimate = await this.productionService.calculateEstimatedCost(profile.id, 1);
        if (estimate && estimate.totalCost > 0) {
          return Number(estimate.totalCost.toFixed(2));
        }
      }
    } catch (e) {
      // Ignora erro auxiliar
    }
    return null;
  }
}
