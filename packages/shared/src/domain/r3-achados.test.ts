import { describe, expect, it } from 'vitest';
import { couponSchema, bannerSchema } from '../schemas/admin';
import { calculateOrderTotals } from './cart-pricing';
import { applyCoupon, taxaEDescontoDoPedido, type CouponRule } from './coupon';
import { calculateDeliveryFee } from './delivery-fee';

/**
 * Reprodução dos achados da rodada 3 que moram em regra pura.
 *
 * `it.fails` documenta o defeito: o teste passa enquanto o comportamento errado
 * existir. Quando o `corretor` consertar, o `it.fails` quebra e deve virar `it`.
 */

const CUPOM: CouponRule = {
  id: 'c1',
  code: 'FRETEGRATIS',
  scope: 'PLATFORM',
  discountType: 'FREE_DELIVERY',
  discountValue: 0,
  minOrderCents: 0,
  usageCount: 0,
  firstOrderOnly: false,
  startsAt: new Date('2026-01-01T00:00:00Z'),
  isActive: true,
};

describe('R3-015: cupom de frete grátis', () => {
  // Mesma composição de `calcularCheckout`.
  function totalNoCheckout(subtotalCents: number, taxaCents: number) {
    const cupom = applyCoupon(CUPOM, {
      subtotalCents,
      deliveryFeeCents: taxaCents,
      storeId: 'loja',
      cityId: 'cidade',
      userRedemptionCount: 0,
      isFirstOrder: true,
    });
    if (!cupom.valid) throw new Error(cupom.reason);
    const valores = taxaEDescontoDoPedido(taxaCents, cupom);
    return calculateOrderTotals({
      items: [{ productName: 'x', unitPriceCents: subtotalCents, quantity: 1, sellingUnit: 'UNIT' }],
      deliveryFeeCents: valores.deliveryFeeCents,
      discountCents: valores.discountCents,
    });
  }

  it('o cliente paga o subtotal, sem descontar a taxa outra vez', () => {
    const totais = totalNoCheckout(8370, 500);
    expect(totais.totalCents).toBe(8370);
    expect(totais.subtotalCents).toBe(8370);
  });
});

describe('R3-017: zona de entrega sem bairro cadastrado', () => {
  it.fails('endereço sem bairro não casa com a primeira zona sem bairro', () => {
    const resultado = calculateDeliveryFee({
      mode: 'BY_ZONE',
      deliveryFeeCents: 0,
      pricePerKmCents: 0,
      deliveryRadiusMeters: 5000,
      subtotalCents: 5000,
      neighborhoodId: null,
      zones: [
        { id: 'z1', name: 'Centro', neighborhoodId: null, feeCents: 300, isActive: true },
        { id: 'z2', name: 'Vila Rural', neighborhoodId: null, feeCents: 900, isActive: true },
      ],
    });
    expect(resultado.available).toBe(false);
  });
});

describe('R3-019: data do formulário e fuso de Brasília', () => {
  const brasilia = (data: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
    }).format(data);

  it.fails('cupom com fim em 10/11 ainda vale no dia 10 em Brasília', () => {
    const cupom = couponSchema.parse({
      code: 'DATA',
      scope: 'PLATFORM',
      discountType: 'FIXED_AMOUNT',
      discountValue: 500,
      endsAt: '2026-11-10',
    });
    expect(brasilia(cupom.endsAt!)).toBe('2026-11-10');
  });

  it.fails('banner com início em 10/11 não entra no ar no dia 9', () => {
    const banner = bannerSchema.parse({
      title: 'Campanha',
      imageId: 'cmvzhxtjc0016cbm0r61sgdn1',
      startsAt: '2026-11-10',
    });
    expect(brasilia(banner.startsAt!)).toBe('2026-11-10');
  });
});
