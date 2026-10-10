import { applyRounding } from '../calculators/rounding.util';
import { Prisma } from '@prisma/client';

describe('applyRounding', () => {
  it('should round correctly with ENDS_90 (always upwards >= original)', () => {
    expect(
      applyRounding(new Prisma.Decimal('38.47'), 'ENDS_90').toString(),
    ).toBe('38.9');
    expect(
      applyRounding(new Prisma.Decimal('38.90'), 'ENDS_90').toString(),
    ).toBe('38.9');
    expect(
      applyRounding(new Prisma.Decimal('38.91'), 'ENDS_90').toString(),
    ).toBe('39.9');
    expect(
      applyRounding(new Prisma.Decimal('49.01'), 'ENDS_90').toString(),
    ).toBe('49.9');
    expect(
      applyRounding(new Prisma.Decimal('0.50'), 'ENDS_90').toString(),
    ).toBe('0.9');
    expect(
      applyRounding(new Prisma.Decimal('100.00'), 'ENDS_90').toString(),
    ).toBe('100.9');
  });

  it('should round correctly with ENDS_99 (always upwards >= original)', () => {
    expect(
      applyRounding(new Prisma.Decimal('38.47'), 'ENDS_99').toString(),
    ).toBe('38.99');
    expect(
      applyRounding(new Prisma.Decimal('38.99'), 'ENDS_99').toString(),
    ).toBe('38.99');
    expect(
      applyRounding(new Prisma.Decimal('39.00'), 'ENDS_99').toString(),
    ).toBe('39.99');
    expect(
      applyRounding(new Prisma.Decimal('48.96'), 'ENDS_99').toString(),
    ).toBe('48.99');
  });

  it('should round correctly with DECIMAL_TWO', () => {
    expect(
      applyRounding(new Prisma.Decimal('12.345'), 'DECIMAL_TWO').toString(),
    ).toBe('12.35');
    expect(
      applyRounding(new Prisma.Decimal('12.344'), 'DECIMAL_TWO').toString(),
    ).toBe('12.34');
    expect(
      applyRounding(new Prisma.Decimal('16.64516'), 'DECIMAL_TWO').toString(),
    ).toBe('16.65');
  });

  it('should round correctly with NONE', () => {
    expect(
      applyRounding(new Prisma.Decimal('38.47123'), 'NONE').toString(),
    ).toBe('38.47123');
  });
});
