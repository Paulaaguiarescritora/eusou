import { PricingValidatorService } from '../validators/pricing-validator.service';
import { Prisma } from '@prisma/client';

describe('PricingValidatorService', () => {
  let validator: PricingValidatorService;

  beforeEach(() => {
    validator = new PricingValidatorService();
  });

  it('should validate successfully a valid pricing input', () => {
    const res = validator.validate({
      cost: new Prisma.Decimal('10.00'),
      taxRate: new Prisma.Decimal('0.04'),
      targetMargin: new Prisma.Decimal('0.20'),
      commissionPercent: new Prisma.Decimal('0.14'),
      fixedCost: new Prisma.Decimal('6.50'),
    });
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('should reject negative cost', () => {
    const res = validator.validate({
      cost: new Prisma.Decimal('-5.00'),
    });
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain('Custo do produto não pode ser negativo.');
  });

  it('should warn when cost is zero', () => {
    const res = validator.validate({
      cost: new Prisma.Decimal('0.00'),
      targetMargin: new Prisma.Decimal('0.20'),
    });
    expect(res.isValid).toBe(true);
    expect(res.warnings).toContain(
      'Custo do produto está configurado como zero.',
    );
  });

  it('should reject when percentages sum is >= 100%', () => {
    const res = validator.validate({
      cost: new Prisma.Decimal('10.00'),
      taxRate: new Prisma.Decimal('0.10'),
      targetMargin: new Prisma.Decimal('0.50'),
      commissionPercent: new Prisma.Decimal('0.25'),
      fixedCostPercent: new Prisma.Decimal('0.20'), // Total: 1.05 >= 1.00
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('inferior a 100%'))).toBe(true);
  });

  it('should reject negative tax or commission', () => {
    const res = validator.validate({
      cost: new Prisma.Decimal('10.00'),
      taxRate: new Prisma.Decimal('-0.04'),
      commissionPercent: new Prisma.Decimal('-0.10'),
    });
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain('Imposto não pode ser negativo.');
    expect(res.errors).toContain('Comissão não pode ser negativa.');
  });

  it('should reject inverted tier (minPrice > maxPrice)', () => {
    const res = validator.validate({
      cost: new Prisma.Decimal('10.00'),
      tiers: [
        {
          name: 'Faixa Invertida',
          minPrice: new Prisma.Decimal('50.00'),
          maxPrice: new Prisma.Decimal('20.00'),
        },
      ],
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('preço mínimo'))).toBe(true);
  });

  it('should reject overlapping tiers with same priority', () => {
    const res = validator.validate({
      cost: new Prisma.Decimal('10.00'),
      tiers: [
        {
          name: 'Faixa A',
          minPrice: new Prisma.Decimal('10.00'),
          maxPrice: new Prisma.Decimal('30.00'),
          priority: 0,
        },
        {
          name: 'Faixa B',
          minPrice: new Prisma.Decimal('25.00'),
          maxPrice: new Prisma.Decimal('50.00'),
          priority: 0,
        },
      ],
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('Faixas sobrepostas'))).toBe(true);
  });
});
