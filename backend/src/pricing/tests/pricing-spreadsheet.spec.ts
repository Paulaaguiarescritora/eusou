import { PricingCalculatorService } from '../calculators/pricing-calculator.service';
import { PricingValidatorService } from '../validators/pricing-validator.service';
import { Prisma } from '@prisma/client';

describe('Pricing Spreadsheet Comparison (Planilha1 vs EuSou)', () => {
  let calculator: PricingCalculatorService;

  beforeEach(() => {
    const validator = new PricingValidatorService();
    calculator = new PricingCalculatorService(validator);
  });

  // ========================================================
  // REGRAS EXTRAÍDAS DA ABA 'Parametros' DA PLANILHA
  // ========================================================

  const TAX_RATE = new Prisma.Decimal('0.04');
  const PACKAGING_COST = new Prisma.Decimal('1.00');

  // MERCADO LIVRE
  const ML_MARGIN = new Prisma.Decimal('0.20');
  const ML_COMMISSION = new Prisma.Decimal('0.14');
  const ML_TIERS = [
    {
      name: 'Abaixo de R$ 12,50',
      minPrice: new Prisma.Decimal('0.00'),
      maxPrice: new Prisma.Decimal('12.50'),
      commissionPercent: new Prisma.Decimal('0.00'),
      fixedCost: new Prisma.Decimal('0.00'),
      fixedCostPercent: new Prisma.Decimal('0.50'),
    },
    {
      name: 'R$ 12,50 a 28,99',
      minPrice: new Prisma.Decimal('12.50'),
      maxPrice: new Prisma.Decimal('29.00'),
      commissionPercent: new Prisma.Decimal('0.00'),
      fixedCost: new Prisma.Decimal('6.25'),
      fixedCostPercent: new Prisma.Decimal('0.00'),
    },
    {
      name: 'R$ 29,00 a 49,99',
      minPrice: new Prisma.Decimal('29.00'),
      maxPrice: new Prisma.Decimal('50.00'),
      commissionPercent: new Prisma.Decimal('0.00'),
      fixedCost: new Prisma.Decimal('6.50'),
      fixedCostPercent: new Prisma.Decimal('0.00'),
    },
    {
      name: 'R$ 50,00 a 78,99',
      minPrice: new Prisma.Decimal('50.00'),
      maxPrice: new Prisma.Decimal('79.00'),
      commissionPercent: new Prisma.Decimal('0.00'),
      fixedCost: new Prisma.Decimal('6.75'),
      fixedCostPercent: new Prisma.Decimal('0.00'),
    },
    {
      name: 'R$ 79,00 ou mais',
      minPrice: new Prisma.Decimal('79.00'),
      maxPrice: new Prisma.Decimal('999999.00'),
      commissionPercent: new Prisma.Decimal('0.00'),
      fixedCost: new Prisma.Decimal('0.00'),
      fixedCostPercent: new Prisma.Decimal('0.00'),
    },
  ];

  // SHOPEE
  const SHOPEE_MARGIN = new Prisma.Decimal('0.20');
  const SHOPEE_COMMISSION = new Prisma.Decimal('0.20');
  const SHOPEE_TIERS = [
    {
      name: 'Abaixo de R$ 8,00',
      minPrice: new Prisma.Decimal('0.00'),
      maxPrice: new Prisma.Decimal('8.00'),
      fixedCost: new Prisma.Decimal('0.00'),
      fixedCostPercent: new Prisma.Decimal('0.50'),
    },
    {
      name: 'R$ 8,00 a 79,99',
      minPrice: new Prisma.Decimal('8.00'),
      maxPrice: new Prisma.Decimal('999999.00'),
      fixedCost: new Prisma.Decimal('4.00'),
      fixedCostPercent: new Prisma.Decimal('0.00'),
    },
  ];

  // TIKTOK SHOP
  const TIKTOK_MARGIN = new Prisma.Decimal('0.20');
  const TIKTOK_TIERS = [
    {
      name: 'Abaixo de R$ 50,00',
      minPrice: new Prisma.Decimal('0.00'),
      maxPrice: new Prisma.Decimal('50.00'),
      commissionPercent: new Prisma.Decimal('0.10'),
      fixedCost: new Prisma.Decimal('4.00'),
    },
    {
      name: 'R$ 50,00 ou mais',
      minPrice: new Prisma.Decimal('50.00'),
      maxPrice: new Prisma.Decimal('999999.00'),
      commissionPercent: new Prisma.Decimal('0.06'),
      fixedCost: new Prisma.Decimal('6.00'),
    },
  ];

  // VAREJO / FACEBOOK
  const RETAIL_MARGIN = new Prisma.Decimal('0.50');

  // PRODUTOS DE REFERÊNCIA DA PLANILHA (Linhas 4 a 8 da Planilha1)
  const products = [
    {
      cod: 1,
      name: 'Aplicador de Comprimidos',
      cost: new Prisma.Decimal('3.07'),
      packaging: PACKAGING_COST,
      expected: {
        varejo: '8.9',
        mercadolivre: '16.9',
        shopee: '14.9',
        tiktok: '12.9',
        facebook: '8.9',
      },
    },
    {
      cod: 2,
      name: 'Bolinha de Petiscos Peixe',
      cost: new Prisma.Decimal('3.06'),
      packaging: PACKAGING_COST,
      expected: {
        varejo: '8.9',
        mercadolivre: '16.9',
        shopee: '14.9',
        tiktok: '12.9',
        facebook: '8.9',
      },
    },
    {
      cod: 3,
      name: 'Bolinha de Purga',
      cost: new Prisma.Decimal('3.47'),
      packaging: PACKAGING_COST,
      expected: {
        varejo: '9.9',
        mercadolivre: '17.9',
        shopee: '15.9',
        tiktok: '12.9',
        facebook: '9.9',
      },
    },
    {
      cod: 4,
      name: 'Brinquedo Rato médio',
      cost: new Prisma.Decimal('2.49'),
      packaging: PACKAGING_COST,
      expected: {
        varejo: '7.9',
        mercadolivre: '15.9',
        shopee: '13.9',
        tiktok: '11.9',
        facebook: '7.9',
      },
    },
    {
      cod: 5,
      name: 'Brinquedo Rato articulado',
      cost: new Prisma.Decimal('2.81'),
      packaging: PACKAGING_COST,
      expected: {
        varejo: '8.9',
        mercadolivre: '16.9',
        shopee: '14.9',
        tiktok: '11.9',
        facebook: '8.9',
      },
    },
    {
      // Produto com base de custo que na planilha possui valor fixo Custo+Emb = 4.50
      cod: 23,
      name: 'Chaveiro Gato dourado da sorte (com Custo+Emb da aba Calculos: 4.50)',
      cost: new Prisma.Decimal('3.50'),
      packaging: PACKAGING_COST, // 3.50 + 1.00 = 4.50
      expected: {
        varejo: '9.9',
        mercadolivre: '17.9',
        shopee: '15.9',
        tiktok: '12.9',
        facebook: '9.9',
      },
    },
  ];

  for (const p of products) {
    describe(`Produto: ${p.name}`, () => {
      it('calcula VAREJO exatamente igual à planilha', () => {
        const res = calculator.calculate({
          cost: p.cost,
          packagingCost: p.packaging,
          taxRate: TAX_RATE,
          targetMargin: RETAIL_MARGIN,
          roundingRule: 'ENDS_90',
        });
        expect(res.calculatedPrice.toString()).toBe(p.expected.varejo);
      });

      it('calcula FACEBOOK exatamente igual à planilha', () => {
        const res = calculator.calculate({
          cost: p.cost,
          packagingCost: p.packaging,
          taxRate: TAX_RATE,
          targetMargin: RETAIL_MARGIN,
          roundingRule: 'ENDS_90',
        });
        expect(res.calculatedPrice.toString()).toBe(p.expected.facebook);
      });

      it('calcula MERCADO LIVRE por faixas exatamente igual à planilha', () => {
        const res = calculator.calculate({
          cost: p.cost,
          packagingCost: p.packaging,
          taxRate: TAX_RATE,
          targetMargin: ML_MARGIN,
          commissionPercent: ML_COMMISSION,
          roundingRule: 'ENDS_90',
          tiers: ML_TIERS,
        });
        expect(res.calculatedPrice.toString()).toBe(p.expected.mercadolivre);
        expect(res.netMargin.toNumber()).toBeGreaterThanOrEqual(0.2);
      });

      it('calcula SHOPEE por faixas exatamente igual à planilha', () => {
        const res = calculator.calculate({
          cost: p.cost,
          packagingCost: p.packaging,
          taxRate: TAX_RATE,
          targetMargin: SHOPEE_MARGIN,
          commissionPercent: SHOPEE_COMMISSION,
          roundingRule: 'ENDS_90',
          tiers: SHOPEE_TIERS,
        });
        expect(res.calculatedPrice.toString()).toBe(p.expected.shopee);
        expect(res.netMargin.toNumber()).toBeGreaterThanOrEqual(0.2);
      });

      it('calcula TIKTOK SHOP por faixas exatamente igual à planilha', () => {
        const res = calculator.calculate({
          cost: p.cost,
          packagingCost: p.packaging,
          taxRate: TAX_RATE,
          targetMargin: TIKTOK_MARGIN,
          commissionPercent: new Prisma.Decimal(0),
          roundingRule: 'ENDS_90',
          tiers: TIKTOK_TIERS,
        });
        expect(res.calculatedPrice.toString()).toBe(p.expected.tiktok);
        expect(res.netMargin.toNumber()).toBeGreaterThanOrEqual(0.2);
      });
    });
  }
});
