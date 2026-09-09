/**
 * Preço de pizza com múltiplos sabores.
 *
 * Duas regras convivem no mercado e a loja escolhe a sua:
 *  - HIGHEST_PRICE: paga-se o sabor mais caro (padrão da maioria);
 *  - AVERAGE_PRICE: média dos sabores escolhidos.
 */

export type PizzaPricingRule = 'HIGHEST_PRICE' | 'AVERAGE_PRICE';

export interface PizzaFlavorChoice {
  flavorId: string;
  name: string;
  priceCents: number;
}

export interface PizzaPriceInput {
  rule: PizzaPricingRule;
  flavors: PizzaFlavorChoice[];
  maxFlavors: number;
  extraPriceCents?: number;
}

export type PizzaPriceResult =
  | { valid: true; basePriceCents: number; totalCents: number }
  | { valid: false; reason: string };

export function calculatePizzaPrice(input: PizzaPriceInput): PizzaPriceResult {
  if (input.flavors.length === 0) {
    return { valid: false, reason: 'Escolha pelo menos um sabor' };
  }

  if (input.flavors.length > input.maxFlavors) {
    return {
      valid: false,
      reason: `Este tamanho aceita no máximo ${input.maxFlavors} ${
        input.maxFlavors === 1 ? 'sabor' : 'sabores'
      }`,
    };
  }

  const prices = input.flavors.map((flavor) => flavor.priceCents);

  const basePriceCents =
    input.rule === 'AVERAGE_PRICE'
      ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
      : Math.max(...prices);

  return {
    valid: true,
    basePriceCents,
    totalCents: basePriceCents + (input.extraPriceCents ?? 0),
  };
}
