import { Prisma } from '@prisma/client';

export type RoundingRuleType = 'NONE' | 'DECIMAL_TWO' | 'ENDS_90' | 'ENDS_99';

/**
 * Aplica a regra de arredondamento definida.
 * Conforme deliberação D3:
 * ENDS_90 e ENDS_99 devem sempre arredondar PARA CIMA (>= preço calculado),
 * garantindo que a margem nunca seja reduzida pelo arredondamento.
 */
export function applyRounding(
  price: Prisma.Decimal,
  rule: RoundingRuleType | string = 'ENDS_90',
): Prisma.Decimal {
  if (rule === 'NONE') {
    return price;
  }

  if (rule === 'DECIMAL_TWO') {
    return price.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  if (rule === 'ENDS_90') {
    return roundCeilingEnding(price, '0.90');
  }

  if (rule === 'ENDS_99') {
    return roundCeilingEnding(price, '0.99');
  }

  // Fallback seguro
  return price.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Arredonda para o próximo .90 ou .99 maior ou igual ao preço.
 * Exemplo para ending '0.90':
 * 38.47 -> 38.90
 * 38.90 -> 38.90
 * 38.91 -> 39.90
 * 0.50  -> 0.90
 * -1.00 -> preserva ou calcula com segurança
 */
function roundCeilingEnding(
  price: Prisma.Decimal,
  endingStr: string,
): Prisma.Decimal {
  const ending = new Prisma.Decimal(endingStr);
  const floorInt = price.floor();
  let candidate = floorInt.add(ending);

  // Se o candidato ficou menor que o preço original (ex: 38.91 contra candidato 38.90),
  // soma mais 1 ao inteiro para garantir candidate >= price
  if (candidate.lessThan(price)) {
    candidate = floorInt.add(1).add(ending);
  }

  return candidate.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
