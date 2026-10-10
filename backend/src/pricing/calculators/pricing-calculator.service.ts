import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { applyRounding, RoundingRuleType } from './rounding.util';
import {
  PricingValidatorService,
  PricingRuleTierInput,
} from '../validators/pricing-validator.service';

export interface PricingCalculatorInput {
  cost: Prisma.Decimal;
  packagingCost?: Prisma.Decimal;
  taxRate?: Prisma.Decimal;
  targetMargin?: Prisma.Decimal;
  commissionPercent?: Prisma.Decimal;
  fixedCost?: Prisma.Decimal;
  fixedCostPercent?: Prisma.Decimal;
  otherPercent?: Prisma.Decimal;
  otherFixedCost?: Prisma.Decimal;
  orderFixedCost?: Prisma.Decimal;
  paymentFeePercent?: Prisma.Decimal;
  roundingRule?: RoundingRuleType | string;
  tiers?: PricingRuleTierInput[];
  manualPrice?: Prisma.Decimal | null;
  mode?: 'AUTOMATIC' | 'MANUAL';
}

export interface PricingCalculatorOutput {
  status: 'OK' | 'INVALID' | 'NO_CONVERGENCE';
  cost: Prisma.Decimal;
  packagingCost: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  fixedCostTotal: Prisma.Decimal;
  otherCostsTotal: Prisma.Decimal;
  rawPrice: Prisma.Decimal;
  calculatedPrice: Prisma.Decimal;
  manualPrice: Prisma.Decimal | null;
  effectivePrice: Prisma.Decimal;
  netProfit: Prisma.Decimal;
  netMargin: Prisma.Decimal;
  appliedTierId: string | null;
  appliedTierName: string | null;
  appliedTierMin: Prisma.Decimal | null;
  appliedTierMax: Prisma.Decimal | null;
  roundingRule: string;
  mode: 'AUTOMATIC' | 'MANUAL';
  iterations: number;
  warnings: string[];
  errors: string[];
  calculationDetails: Record<string, any>;
}

@Injectable()
export class PricingCalculatorService {
  constructor(private readonly validator: PricingValidatorService) {}

  calculate(input: PricingCalculatorInput): PricingCalculatorOutput {
    const warnings: string[] = [];
    const errors: string[] = [];

    const cost = input.cost;
    const packagingCost = input.packagingCost ?? new Prisma.Decimal('1.00');
    const taxRate = input.taxRate ?? new Prisma.Decimal('0.04');
    const targetMargin = input.targetMargin ?? new Prisma.Decimal('0.20');
    const commissionPercent = input.commissionPercent ?? new Prisma.Decimal(0);
    const fixedCost = input.fixedCost ?? new Prisma.Decimal(0);
    const fixedCostPercent = input.fixedCostPercent ?? new Prisma.Decimal(0);
    const otherPercent = input.otherPercent ?? new Prisma.Decimal(0);
    const otherFixedCost = input.otherFixedCost ?? new Prisma.Decimal(0);
    const orderFixedCost = input.orderFixedCost ?? new Prisma.Decimal(0);
    const paymentFeePercent = input.paymentFeePercent ?? new Prisma.Decimal(0);
    const roundingRule = (input.roundingRule as RoundingRuleType) || 'ENDS_90';
    const mode = input.mode || (input.manualPrice ? 'MANUAL' : 'AUTOMATIC');

    // 1. Validação prévia
    const valResult = this.validator.validate({
      cost,
      taxRate,
      targetMargin,
      commissionPercent,
      fixedCost,
      fixedCostPercent,
      otherPercent,
      otherFixedCost,
      paymentFeePercent,
      tiers: input.tiers,
    });

    warnings.push(...valResult.warnings);

    if (!valResult.isValid) {
      errors.push(...valResult.errors);
      return this.createInvalidOutput(
        cost,
        packagingCost,
        roundingRule,
        mode,
        errors,
        warnings,
        'INVALID',
      );
    }

    // 2. Preparar faixas ativas ordenadas por prioridade
    const activeTiers = (input.tiers || [])
      .filter((t) => t.isActive !== false)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    // 3. Resolução iterativa de faixa e preço
    // Fórmula conceitual:
    // Preço = (Custo + Embalagem + Custo fixo em R$ total) / (1 - Comissão - Imposto - Margem - Custos % totais)
    let appliedTier: PricingRuleTierInput | null = null;
    let candidatePrice = new Prisma.Decimal(0);
    let roundedPrice = new Prisma.Decimal(0);
    const iterations = 0;
    let converged = false;

    // Se existirem faixas, calcula o preço candidato para cada faixa e seleciona
    // a faixa que contém o seu próprio preço resultante (idêntico à lógica da planilha).
    if (activeTiers.length > 0) {
      let matchedTier: PricingRuleTierInput | null = null;
      let matchedRawPrice = new Prisma.Decimal(0);
      let matchedRoundedPrice = new Prisma.Decimal(0);

      // Avalia cada faixa em ordem crescente de minPrice/priority
      for (const tier of activeTiers) {
        const effCommission = commissionPercent.add(
          tier.commissionPercent ?? new Prisma.Decimal(0),
        );
        const effFixedCost = fixedCost.add(
          tier.fixedCost ?? new Prisma.Decimal(0),
        );
        const effFixedPercent = fixedCostPercent.add(
          tier.fixedCostPercent ?? new Prisma.Decimal(0),
        );
        const effOtherPercent = otherPercent.add(
          tier.otherPercent ?? new Prisma.Decimal(0),
        );
        const effOtherFixed = otherFixedCost.add(
          tier.otherFixedCost ?? new Prisma.Decimal(0),
        );

        const numerator = cost
          .add(packagingCost)
          .add(effFixedCost)
          .add(effOtherFixed)
          .add(orderFixedCost);

        const denominator = new Prisma.Decimal(1)
          .sub(effCommission)
          .sub(taxRate)
          .sub(targetMargin)
          .sub(effFixedPercent)
          .sub(effOtherPercent)
          .sub(paymentFeePercent);

        if (denominator.greaterThan(0)) {
          const rawCandidate = numerator.div(denominator);
          // O preço candidato desta faixa deve ser >= minPrice da faixa
          const effectiveCandidate = rawCandidate.lessThan(tier.minPrice)
            ? tier.minPrice
            : rawCandidate;

          // Se o candidato resultante for menor que maxPrice (ou cair dentro dos limites da faixa)
          if (
            effectiveCandidate.lessThan(tier.maxPrice) ||
            tier.maxPrice.equals(new Prisma.Decimal('999999.00'))
          ) {
            matchedTier = tier;
            matchedRawPrice = rawCandidate;
            matchedRoundedPrice = applyRounding(rawCandidate, roundingRule);
            break;
          }
        }
      }

      if (matchedTier) {
        appliedTier = matchedTier;
        candidatePrice = matchedRawPrice;
        roundedPrice = matchedRoundedPrice;
        converged = true;
      }
    }

    // Fallback: se não houver faixas ou nenhuma faixa combinou diretamente, calcula com regra base
    if (!converged) {
      const numerator = cost
        .add(packagingCost)
        .add(fixedCost)
        .add(otherFixedCost)
        .add(orderFixedCost);

      const denominator = new Prisma.Decimal(1)
        .sub(commissionPercent)
        .sub(taxRate)
        .sub(targetMargin)
        .sub(fixedCostPercent)
        .sub(otherPercent)
        .sub(paymentFeePercent);

      if (denominator.lessThanOrEqualTo(0)) {
        errors.push(
          'Margem desejada incompatível com as taxas e custos configurados (denominador <= 0).',
        );
        return this.createInvalidOutput(
          cost,
          packagingCost,
          roundingRule,
          mode,
          errors,
          warnings,
          'INVALID',
        );
      }

      candidatePrice = numerator.div(denominator);
      roundedPrice = applyRounding(candidatePrice, roundingRule);
    }

    // 4. Determinação do Preço Efetivo (Modo AUTOMATIC vs MANUAL)
    const manualPrice = input.manualPrice ?? null;
    let effectivePrice = roundedPrice;

    if (
      mode === 'MANUAL' &&
      manualPrice !== null &&
      manualPrice.greaterThan(0)
    ) {
      effectivePrice = manualPrice;
    }

    // 5. Decomposição financeira com base no effectivePrice
    // Taxas calculadas sobre o preço final efetivo de venda
    const effCommission = commissionPercent.add(
      appliedTier?.commissionPercent ?? new Prisma.Decimal(0),
    );
    const effFixedCost = fixedCost.add(
      appliedTier?.fixedCost ?? new Prisma.Decimal(0),
    );
    const effFixedPercent = fixedCostPercent.add(
      appliedTier?.fixedCostPercent ?? new Prisma.Decimal(0),
    );
    const effOtherPercent = otherPercent.add(
      appliedTier?.otherPercent ?? new Prisma.Decimal(0),
    );
    const effOtherFixed = otherFixedCost.add(
      appliedTier?.otherFixedCost ?? new Prisma.Decimal(0),
    );

    const taxAmount = effectivePrice
      .mul(taxRate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const commissionAmount = effectivePrice
      .mul(effCommission)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const fixedPercentAmount = effectivePrice
      .mul(effFixedPercent)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const otherPercentAmount = effectivePrice
      .mul(effOtherPercent)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const paymentFeeAmount = effectivePrice
      .mul(paymentFeePercent)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const fixedCostTotal = effFixedCost
      .add(effOtherFixed)
      .add(orderFixedCost)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const otherCostsTotal = fixedPercentAmount
      .add(otherPercentAmount)
      .add(paymentFeeAmount)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const totalDeductions = cost
      .add(packagingCost)
      .add(taxAmount)
      .add(commissionAmount)
      .add(fixedCostTotal)
      .add(otherCostsTotal);

    const netProfit = effectivePrice
      .sub(totalDeductions)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const netMargin = effectivePrice.greaterThan(0)
      ? netProfit
          .div(effectivePrice)
          .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
      : new Prisma.Decimal(0);

    const calculationDetails = {
      formula:
        'Price = (Cost + Packaging + FixedCosts) / (1 - Commission - Tax - Margin - PercentCosts)',
      cost: cost.toString(),
      packagingCost: packagingCost.toString(),
      taxRate: taxRate.toString(),
      targetMargin: targetMargin.toString(),
      appliedTier: appliedTier
        ? {
            id: appliedTier.id,
            name: appliedTier.name,
            minPrice: appliedTier.minPrice.toString(),
            maxPrice: appliedTier.maxPrice.toString(),
            commissionPercent: (appliedTier.commissionPercent ?? 0).toString(),
            fixedCost: (appliedTier.fixedCost ?? 0).toString(),
            fixedCostPercent: (appliedTier.fixedCostPercent ?? 0).toString(),
          }
        : null,
      rawPrice: candidatePrice
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
        .toString(),
      roundedPrice: roundedPrice.toString(),
      effectivePrice: effectivePrice.toString(),
      taxAmount: taxAmount.toString(),
      commissionAmount: commissionAmount.toString(),
      fixedCostTotal: fixedCostTotal.toString(),
      otherCostsTotal: otherCostsTotal.toString(),
      netProfit: netProfit.toString(),
      netMargin: netMargin.toString(),
      iterations,
    };

    return {
      status: 'OK',
      cost,
      packagingCost,
      taxAmount,
      commissionAmount,
      fixedCostTotal,
      otherCostsTotal,
      rawPrice: candidatePrice.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      calculatedPrice: roundedPrice,
      manualPrice,
      effectivePrice,
      netProfit,
      netMargin,
      appliedTierId: appliedTier?.id ?? null,
      appliedTierName: appliedTier?.name ?? null,
      appliedTierMin: appliedTier?.minPrice ?? null,
      appliedTierMax: appliedTier?.maxPrice ?? null,
      roundingRule,
      mode,
      iterations,
      warnings,
      errors,
      calculationDetails,
    };
  }

  private createInvalidOutput(
    cost: Prisma.Decimal,
    packagingCost: Prisma.Decimal,
    roundingRule: string,
    mode: 'AUTOMATIC' | 'MANUAL',
    errors: string[],
    warnings: string[],
    status: 'INVALID' | 'NO_CONVERGENCE',
  ): PricingCalculatorOutput {
    const zero = new Prisma.Decimal(0);
    return {
      status,
      cost,
      packagingCost,
      taxAmount: zero,
      commissionAmount: zero,
      fixedCostTotal: zero,
      otherCostsTotal: zero,
      rawPrice: zero,
      calculatedPrice: zero,
      manualPrice: null,
      effectivePrice: zero,
      netProfit: zero,
      netMargin: zero,
      appliedTierId: null,
      appliedTierName: null,
      appliedTierMin: null,
      appliedTierMax: null,
      roundingRule,
      mode,
      iterations: 0,
      warnings,
      errors,
      calculationDetails: {},
    };
  }
}
