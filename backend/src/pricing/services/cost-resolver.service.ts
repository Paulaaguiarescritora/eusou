import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ProductionService } from '../../production/production.service';

export interface CostResolution {
  source: 'PRODUCTION' | 'MANUAL' | 'BASE_PRICE' | 'NONE';
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
   * Resolve o custo do produto/variante conforme prioridades do F12:
   * 1. Custo calculado pelo ProductionProfile / Cost Engine do F7 quando disponível;
   * 2. Custo manual explícito fornecido (costOverride);
   * 3. Custo base disponível no produto (Product.basePrice) quando aplicável;
   * 4. Fallback seguro com warning.
   */
  async resolveCost(
    productId: string,
    variantId?: string | null,
    costOverride?: number | Prisma.Decimal | null,
  ): Promise<CostResolution> {
    const warnings: string[] = [];

    // Prioridade 2: Custo manual explícito via parâmetro
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

    // Prioridade 1: Custo calculado pelo F7 via ProductionProfile ativo
    try {
      // Procura primeiro perfil para a variante específica (se houver)
      let profile = null;
      if (variantId) {
        profile = await this.prisma.productionProfile.findFirst({
          where: {
            variantId,
            isActive: true,
          },
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

    // Prioridade 3: Fallback para basePrice do produto ou da variante
    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (
        variant &&
        variant.price &&
        new Prisma.Decimal(variant.price).greaterThan(0)
      ) {
        return {
          source: 'BASE_PRICE',
          cost: new Prisma.Decimal(variant.price),
          isPartial: false,
          warnings: [
            ...warnings,
            'Utilizado preço da variante como base de custo.',
          ],
        };
      }
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (
      product &&
      product.basePrice &&
      new Prisma.Decimal(product.basePrice).greaterThan(0)
    ) {
      return {
        source: 'BASE_PRICE',
        cost: new Prisma.Decimal(product.basePrice),
        isPartial: false,
        warnings: [
          ...warnings,
          'Utilizado basePrice do produto como base de custo.',
        ],
      };
    }

    // Fallback: Nenhum custo encontrado
    warnings.push(
      'Nenhuma fonte de custo encontrada para o produto/variante. Custo definido como zero.',
    );
    return {
      source: 'NONE',
      cost: new Prisma.Decimal(0),
      isPartial: true,
      warnings,
    };
  }
}
