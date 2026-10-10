import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PricingRuleTierInput {
  id?: string;
  name?: string | null;
  minPrice: Prisma.Decimal;
  maxPrice: Prisma.Decimal;
  commissionPercent?: Prisma.Decimal;
  fixedCost?: Prisma.Decimal;
  fixedCostPercent?: Prisma.Decimal;
  otherPercent?: Prisma.Decimal;
  otherFixedCost?: Prisma.Decimal;
  priority?: number;
  isActive?: boolean;
}

export interface PricingValidationInput {
  cost: Prisma.Decimal;
  taxRate?: Prisma.Decimal;
  targetMargin?: Prisma.Decimal;
  commissionPercent?: Prisma.Decimal;
  fixedCost?: Prisma.Decimal;
  fixedCostPercent?: Prisma.Decimal;
  otherPercent?: Prisma.Decimal;
  otherFixedCost?: Prisma.Decimal;
  paymentFeePercent?: Prisma.Decimal;
  tiers?: PricingRuleTierInput[];
}

@Injectable()
export class PricingValidatorService {
  validate(input: PricingValidationInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Custo negativo ou zero
    if (input.cost.lessThan(0)) {
      errors.push('Custo do produto não pode ser negativo.');
    } else if (input.cost.equals(0)) {
      warnings.push('Custo do produto está configurado como zero.');
    }

    // 2. Percentuais não podem ser negativos
    const taxRate = input.taxRate ?? new Prisma.Decimal(0);
    const targetMargin = input.targetMargin ?? new Prisma.Decimal(0);
    const commissionPercent = input.commissionPercent ?? new Prisma.Decimal(0);
    const fixedCostPercent = input.fixedCostPercent ?? new Prisma.Decimal(0);
    const otherPercent = input.otherPercent ?? new Prisma.Decimal(0);
    const paymentFeePercent = input.paymentFeePercent ?? new Prisma.Decimal(0);

    if (taxRate.lessThan(0)) errors.push('Imposto não pode ser negativo.');
    if (targetMargin.lessThan(0))
      errors.push('Margem desejada não pode ser negativa.');
    if (commissionPercent.lessThan(0))
      errors.push('Comissão não pode ser negativa.');
    if (fixedCostPercent.lessThan(0))
      errors.push('Custo fixo percentual não pode ser negativo.');
    if (otherPercent.lessThan(0))
      errors.push('Outros custos percentuais não podem ser negativos.');
    if (paymentFeePercent.lessThan(0))
      errors.push('Taxa de pagamento não pode ser negativa.');

    // 3. Custos fixos em R$ não podem ser negativos
    const fixedCost = input.fixedCost ?? new Prisma.Decimal(0);
    const otherFixedCost = input.otherFixedCost ?? new Prisma.Decimal(0);
    if (fixedCost.lessThan(0))
      errors.push('Custo fixo (R$) não pode ser negativo.');
    if (otherFixedCost.lessThan(0))
      errors.push('Outros custos fixos (R$) não podem ser negativos.');

    // 4. Soma dos percentuais da regra base não pode ser >= 100% (denominador <= 0)
    const sumPercentages = taxRate
      .add(targetMargin)
      .add(commissionPercent)
      .add(fixedCostPercent)
      .add(otherPercent)
      .add(paymentFeePercent);

    if (sumPercentages.greaterThanOrEqualTo(1)) {
      errors.push(
        `A soma das taxas percentuais e margem (${sumPercentages.mul(100).toFixed(2)}%) deve ser estritamente inferior a 100%.`,
      );
    }

    // 5. Validação de faixas (tiers)
    if (input.tiers && input.tiers.length > 0) {
      const activeTiers = input.tiers.filter((t) => t.isActive !== false);

      for (const tier of activeTiers) {
        if (tier.minPrice.greaterThan(tier.maxPrice)) {
          errors.push(
            `Faixa inválida: preço mínimo (R$ ${tier.minPrice}) maior que preço máximo (R$ ${tier.maxPrice}).`,
          );
        }
        if (tier.minPrice.lessThan(0) || tier.maxPrice.lessThan(0)) {
          errors.push('Os limites de preço da faixa não podem ser negativos.');
        }

        // Validação da soma de percentuais combinando a base com o tier
        const tierCommission = tier.commissionPercent ?? new Prisma.Decimal(0);
        const tierFixedPercent = tier.fixedCostPercent ?? new Prisma.Decimal(0);
        const tierOtherPercent = tier.otherPercent ?? new Prisma.Decimal(0);

        const combinedPercentages = sumPercentages
          .add(tierCommission)
          .add(tierFixedPercent)
          .add(tierOtherPercent);

        if (combinedPercentages.greaterThanOrEqualTo(1)) {
          errors.push(
            `A soma dos percentuais com a faixa "${tier.name || 'Tier'}" (${combinedPercentages.mul(100).toFixed(2)}%) atinge ou excede 100%.`,
          );
        }
      }

      // 6. Detecção de faixas sobrepostas com mesma prioridade
      for (let i = 0; i < activeTiers.length; i++) {
        for (let j = i + 1; j < activeTiers.length; j++) {
          const t1 = activeTiers[i];
          const t2 = activeTiers[j];
          const p1 = t1.priority ?? 0;
          const p2 = t2.priority ?? 0;

          if (p1 === p2) {
            const overlap =
              t1.minPrice.lessThan(t2.maxPrice) &&
              t2.minPrice.lessThan(t1.maxPrice);
            if (overlap) {
              errors.push(
                `Faixas sobrepostas detectadas com mesma prioridade: "${t1.name || 'Tier 1'}" e "${t2.name || 'Tier 2'}".`,
              );
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
