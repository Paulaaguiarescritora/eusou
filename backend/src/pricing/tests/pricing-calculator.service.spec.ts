import { PricingCalculatorService } from '../calculators/pricing-calculator.service';
import { PricingValidatorService } from '../validators/pricing-validator.service';
import { Prisma } from '@prisma/client';

describe('PricingCalculatorService', () => {
  let calculator: PricingCalculatorService;

  beforeEach(() => {
    const validator = new PricingValidatorService();
    calculator = new PricingCalculatorService(validator);
  });

  it('calculates retail price with ENDS_90 rounding correctly', () => {
    // Exemplo: Custo 3.07 + embalagem 1.00 = 4.07. Imposto 4%, Margem 50%
    // Denominador = 1 - 0.04 - 0.50 = 0.46
    // Candidato = 4.07 / 0.46 = 8.8478
    // ENDS_90 -> 8.90
    const res = calculator.calculate({
      cost: new Prisma.Decimal('3.07'),
      packagingCost: new Prisma.Decimal('1.00'),
      taxRate: new Prisma.Decimal('0.04'),
      targetMargin: new Prisma.Decimal('0.50'),
      roundingRule: 'ENDS_90',
    });

    expect(res.status).toBe('OK');
    expect(res.calculatedPrice.toString()).toBe('8.9');
    expect(res.effectivePrice.toString()).toBe('8.9');
    expect(res.netMargin.toNumber()).toBeGreaterThanOrEqual(0.5);
  });

  it('resolves Mercado Livre tiers dynamically', () => {
    // Regras ML Clássico: Comissão 14%, Imposto 4%, Margem 20%
    // Faixa 1 (< 12.50): custo fixo % 50%
    // Faixa 2 (12.50 a 29.00): custo fixo R$ 6.25
    // Faixa 3 (29.00 a 50.00): custo fixo R$ 6.50
    const mlTiers = [
      {
        name: '< 12.50',
        minPrice: new Prisma.Decimal('0.00'),
        maxPrice: new Prisma.Decimal('12.49'),
        fixedCostPercent: new Prisma.Decimal('0.50'),
      },
      {
        name: '12.50 a 28.99',
        minPrice: new Prisma.Decimal('12.50'),
        maxPrice: new Prisma.Decimal('28.99'),
        fixedCost: new Prisma.Decimal('6.25'),
      },
      {
        name: '29.00 a 49.99',
        minPrice: new Prisma.Decimal('29.00'),
        maxPrice: new Prisma.Decimal('49.99'),
        fixedCost: new Prisma.Decimal('6.50'),
      },
    ];

    // Custo 3.07 + emb 1.00 = 4.07
    // Se cair na faixa 2: (4.07 + 6.25) / (1 - 0.14 - 0.04 - 0.20) = 10.32 / 0.62 = 16.645 -> ENDS_90 -> 16.90
    // 16.90 está na faixa 2 (12.50 a 28.99). Convergência garantida!
    const res = calculator.calculate({
      cost: new Prisma.Decimal('3.07'),
      packagingCost: new Prisma.Decimal('1.00'),
      taxRate: new Prisma.Decimal('0.04'),
      targetMargin: new Prisma.Decimal('0.20'),
      commissionPercent: new Prisma.Decimal('0.14'),
      roundingRule: 'ENDS_90',
      tiers: mlTiers,
    });

    expect(res.status).toBe('OK');
    expect(res.appliedTierName).toBe('12.50 a 28.99');
    expect(res.calculatedPrice.toString()).toBe('16.9');
    expect(res.effectivePrice.toString()).toBe('16.9');
    expect(res.netMargin.toNumber()).toBeGreaterThanOrEqual(0.2);
  });

  it('handles MANUAL price mode preserving calculatedPrice', () => {
    const res = calculator.calculate({
      cost: new Prisma.Decimal('10.00'),
      packagingCost: new Prisma.Decimal('1.00'),
      taxRate: new Prisma.Decimal('0.04'),
      targetMargin: new Prisma.Decimal('0.20'),
      roundingRule: 'ENDS_90',
      mode: 'MANUAL',
      manualPrice: new Prisma.Decimal('25.00'),
    });

    expect(res.status).toBe('OK');
    expect(res.mode).toBe('MANUAL');
    expect(res.effectivePrice.toString()).toBe('25');
    expect(res.manualPrice?.toString()).toBe('25');
    expect(res.calculatedPrice.toNumber()).toBeGreaterThan(0);
  });

  it('returns INVALID when denominator <= 0', () => {
    const res = calculator.calculate({
      cost: new Prisma.Decimal('10.00'),
      taxRate: new Prisma.Decimal('0.10'),
      targetMargin: new Prisma.Decimal('0.50'),
      commissionPercent: new Prisma.Decimal('0.45'), // Total 1.05 >= 1
    });

    expect(res.status).toBe('INVALID');
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.effectivePrice.toString()).toBe('0');
  });
});
