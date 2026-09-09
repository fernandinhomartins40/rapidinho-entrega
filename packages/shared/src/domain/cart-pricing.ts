import { percentOfCents, weightPriceCents } from '../utils/money';
import {
  calculatePizzaPrice,
  type PizzaFlavorChoice,
  type PizzaPricingRule,
} from './pizza-pricing';

/**
 * Preço de um item e total do pedido.
 *
 * Esta é a única fonte de verdade de cálculo: o carrinho do cliente, a
 * pré-visualização do checkout e a criação do pedido no servidor passam todos
 * por aqui, para que o valor mostrado e o valor cobrado nunca divirjam.
 */

export interface ComplementChoice {
  optionId: string;
  groupName: string;
  optionName: string;
  priceCents: number;
  quantity: number;
}

export interface CartItemPricingInput {
  productName: string;
  /// Preço unitário; para venda por peso, o preço do quilo.
  unitPriceCents: number;
  quantity: number;
  sellingUnit: 'UNIT' | 'WEIGHT_KG';
  weightGrams?: number | null;
  complements?: ComplementChoice[];
  /// Pizza
  pizza?: {
    rule: PizzaPricingRule;
    flavors: PizzaFlavorChoice[];
    maxFlavors: number;
    extraPriceCents?: number;
  };
}

export interface CartItemPrice {
  /// Preço de uma unidade já com complementos e extras.
  unitTotalCents: number;
  /// unitTotal * quantidade.
  totalCents: number;
  complementsCents: number;
}

export function calculateCartItem(item: CartItemPricingInput): CartItemPrice {
  const complementsCents = (item.complements ?? []).reduce(
    (sum, complement) => sum + complement.priceCents * complement.quantity,
    0,
  );

  let baseCents: number;

  if (item.pizza) {
    const pizza = calculatePizzaPrice({
      rule: item.pizza.rule,
      flavors: item.pizza.flavors,
      maxFlavors: item.pizza.maxFlavors,
      ...(item.pizza.extraPriceCents ? { extraPriceCents: item.pizza.extraPriceCents } : {}),
    });
    // O preço inválido é barrado pela validação antes de chegar aqui; se
    // chegar, cobra-se o sabor mais caro para nunca cobrar a menos.
    baseCents = pizza.valid
      ? pizza.totalCents
      : Math.max(...item.pizza.flavors.map((flavor) => flavor.priceCents), 0);
  } else if (item.sellingUnit === 'WEIGHT_KG') {
    baseCents = weightPriceCents(item.unitPriceCents, item.weightGrams ?? 0);
  } else {
    baseCents = item.unitPriceCents;
  }

  const unitTotalCents = baseCents + complementsCents;

  return {
    unitTotalCents,
    totalCents: unitTotalCents * item.quantity,
    complementsCents,
  };
}

export interface OrderTotalsInput {
  items: CartItemPricingInput[];
  deliveryFeeCents: number;
  discountCents?: number;
  surchargeCents?: number;
  /// Percentual de comissão da plataforma aplicado sobre o subtotal.
  commissionRate?: number;
}

export interface OrderTotals {
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  surchargeCents: number;
  totalCents: number;
  commissionCents: number;
  /// Quanto sobra para a loja depois da comissão da plataforma.
  storeNetCents: number;
}

export function calculateOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotalCents = input.items.reduce(
    (sum, item) => sum + calculateCartItem(item).totalCents,
    0,
  );

  const discountCents = Math.min(input.discountCents ?? 0, subtotalCents + input.deliveryFeeCents);
  const surchargeCents = input.surchargeCents ?? 0;

  const totalCents = Math.max(
    0,
    subtotalCents + input.deliveryFeeCents + surchargeCents - discountCents,
  );

  // A comissão incide sobre a mercadoria, não sobre a taxa de entrega:
  // a entrega é custo do lojista ou do entregador, não receita da loja.
  const commissionCents = percentOfCents(subtotalCents, input.commissionRate ?? 0);

  return {
    subtotalCents,
    deliveryFeeCents: input.deliveryFeeCents,
    discountCents,
    surchargeCents,
    totalCents,
    commissionCents,
    storeNetCents: subtotalCents - commissionCents,
  };
}
