import { describe, expect, it } from 'vitest';
import { isStoreOpen, minuteToTime, timeToMinute } from './store-hours';
import { calculateDeliveryFee } from './delivery-fee';
import { calculatePizzaPrice } from './pizza-pricing';
import { calculateCartItem, calculateOrderTotals } from './cart-pricing';
import { applyCoupon, type CouponRule } from './coupon';
import { canTransition, isFinalStatus } from './order-status';

/** 2025-03-10 é uma segunda-feira. Horários em America/Sao_Paulo (UTC-3). */
const monday = (hour: number, minute = 0) =>
  new Date(Date.UTC(2025, 2, 10, hour + 3, minute));

describe('horário de funcionamento', () => {
  const hours = [
    { weekday: 1, opensAt: timeToMinute('18:00'), closesAt: timeToMinute('23:00'), isActive: true },
  ];

  it('abre e fecha conforme o dia da semana', () => {
    expect(isStoreOpen({ hours, now: monday(19) }).isOpen).toBe(true);
    expect(isStoreOpen({ hours, now: monday(17, 59) }).isOpen).toBe(false);
    expect(isStoreOpen({ hours, now: monday(23) }).isOpen).toBe(false);
  });

  it('informa quantos minutos faltam para fechar', () => {
    const result = isStoreOpen({ hours, now: monday(22, 30) });
    expect(result.isOpen).toBe(true);
    expect(result.closesInMinutes).toBe(30);
  });

  it('mantém aberta na madrugada quando o fechamento vira o dia', () => {
    // Segunda 18:00 → terça 02:00 (1560 minutos).
    const overnight = [{ weekday: 1, opensAt: 1080, closesAt: 1560, isActive: true }];

    // Terça 01:00 — ainda é a janela da segunda.
    const tuesdayEarly = new Date(Date.UTC(2025, 2, 11, 4));
    expect(isStoreOpen({ hours: overnight, now: tuesdayEarly }).isOpen).toBe(true);

    // Terça 03:00 — já fechou.
    const tuesdayLater = new Date(Date.UTC(2025, 2, 11, 6));
    expect(isStoreOpen({ hours: overnight, now: tuesdayLater }).isOpen).toBe(false);
  });

  it('pausa de emergência fecha mesmo dentro do horário', () => {
    const result = isStoreOpen({
      hours,
      now: monday(19),
      pausedUntil: monday(20),
      pauseReason: 'Cozinha lotada',
    });
    expect(result.isOpen).toBe(false);
    expect(result.reason).toBe('Cozinha lotada');
  });

  it('feriado fecha mesmo dentro do horário', () => {
    const result = isStoreOpen({
      hours,
      now: monday(19),
      closures: [{ startsAt: monday(0), endsAt: monday(23, 59), reason: 'Feriado municipal' }],
    });
    expect(result.isOpen).toBe(false);
    expect(result.reason).toBe('Feriado municipal');
  });

  it('converte minuto e horário nos dois sentidos', () => {
    expect(minuteToTime(1080)).toBe('18:00');
    expect(timeToMinute('18:30')).toBe(1110);
    expect(minuteToTime(1560)).toBe('02:00');
  });
});

describe('taxa de entrega', () => {
  const base = {
    deliveryFeeCents: 500,
    pricePerKmCents: 150,
    deliveryRadiusMeters: 8000,
    subtotalCents: 3000,
  };

  it('taxa fixa', () => {
    const result = calculateDeliveryFee({ ...base, mode: 'FIXED' });
    expect(result).toMatchObject({ available: true, feeCents: 500 });
  });

  it('frete grátis acima do valor configurado', () => {
    const result = calculateDeliveryFee({
      ...base,
      mode: 'FIXED',
      freeDeliveryAboveCents: 2500,
    });
    expect(result).toMatchObject({ available: true, feeCents: 0, isFreeByThreshold: true });
  });

  it('por distância cobra o maior entre taxa base e preço por km', () => {
    const result = calculateDeliveryFee({
      ...base,
      mode: 'BY_DISTANCE',
      storeCoordinates: { latitude: -24.8886, longitude: -52.2094 },
      addressCoordinates: { latitude: -24.8706, longitude: -52.2094 },
    });
    // ~2 km em linha reta * 1.3 = ~2,6 km → ~R$ 3,90, menor que a taxa base.
    expect(result).toMatchObject({ available: true, feeCents: 500 });
  });

  it('recusa endereço fora do raio', () => {
    const result = calculateDeliveryFee({
      ...base,
      mode: 'BY_DISTANCE',
      deliveryRadiusMeters: 1000,
      storeCoordinates: { latitude: -24.8886, longitude: -52.2094 },
      addressCoordinates: { latitude: -24.8706, longitude: -52.2094 },
    });
    expect(result.available).toBe(false);
  });

  it('sem coordenadas cai na taxa fixa em vez de recusar o pedido', () => {
    const result = calculateDeliveryFee({ ...base, mode: 'BY_DISTANCE' });
    expect(result).toMatchObject({ available: true, feeCents: 500 });
  });

  it('por bairro usa a zona cadastrada', () => {
    const result = calculateDeliveryFee({
      ...base,
      mode: 'BY_ZONE',
      neighborhoodId: 'bairro-centro',
      zones: [
        {
          id: 'zona-1',
          name: 'Centro',
          neighborhoodId: 'bairro-centro',
          feeCents: 300,
          isActive: true,
        },
      ],
    });
    expect(result).toMatchObject({ available: true, feeCents: 300, zoneId: 'zona-1' });
  });

  it('recusa bairro sem zona cadastrada', () => {
    const result = calculateDeliveryFee({
      ...base,
      mode: 'BY_ZONE',
      neighborhoodId: 'bairro-desconhecido',
      zones: [],
    });
    expect(result.available).toBe(false);
  });
});

describe('preço de pizza', () => {
  const flavors = [
    { flavorId: '1', name: 'Calabresa', priceCents: 4000 },
    { flavorId: '2', name: 'Portuguesa', priceCents: 5000 },
  ];

  it('regra do maior valor', () => {
    const result = calculatePizzaPrice({ rule: 'HIGHEST_PRICE', flavors, maxFlavors: 2 });
    expect(result).toMatchObject({ valid: true, basePriceCents: 5000 });
  });

  it('regra da média', () => {
    const result = calculatePizzaPrice({ rule: 'AVERAGE_PRICE', flavors, maxFlavors: 2 });
    expect(result).toMatchObject({ valid: true, basePriceCents: 4500 });
  });

  it('soma a borda recheada', () => {
    const result = calculatePizzaPrice({
      rule: 'HIGHEST_PRICE',
      flavors,
      maxFlavors: 2,
      extraPriceCents: 800,
    });
    expect(result).toMatchObject({ valid: true, totalCents: 5800 });
  });

  it('recusa mais sabores do que o tamanho permite', () => {
    const result = calculatePizzaPrice({ rule: 'HIGHEST_PRICE', flavors, maxFlavors: 1 });
    expect(result.valid).toBe(false);
  });
});

describe('cálculo do carrinho', () => {
  it('soma complementos ao preço unitário', () => {
    const item = calculateCartItem({
      productName: 'X-Salada',
      unitPriceCents: 2000,
      quantity: 2,
      sellingUnit: 'UNIT',
      complements: [
        {
          optionId: '1',
          groupName: 'Adicionais',
          optionName: 'Bacon',
          priceCents: 500,
          quantity: 2,
        },
      ],
    });
    // (2000 + 500*2) * 2
    expect(item.unitTotalCents).toBe(3000);
    expect(item.totalCents).toBe(6000);
  });

  it('cobra por peso quando o produto é vendido por quilo', () => {
    const item = calculateCartItem({
      productName: 'Picanha',
      unitPriceCents: 8990,
      quantity: 1,
      sellingUnit: 'WEIGHT_KG',
      weightGrams: 700,
    });
    expect(item.totalCents).toBe(6293);
  });

  it('comissão incide sobre a mercadoria, não sobre a entrega', () => {
    const totals = calculateOrderTotals({
      items: [
        { productName: 'Pizza', unitPriceCents: 5000, quantity: 1, sellingUnit: 'UNIT' },
      ],
      deliveryFeeCents: 700,
      commissionRate: 10,
    });

    expect(totals.subtotalCents).toBe(5000);
    expect(totals.totalCents).toBe(5700);
    expect(totals.commissionCents).toBe(500);
    expect(totals.storeNetCents).toBe(4500);
  });

  it('desconto nunca deixa o total negativo', () => {
    const totals = calculateOrderTotals({
      items: [
        { productName: 'Refri', unitPriceCents: 800, quantity: 1, sellingUnit: 'UNIT' },
      ],
      deliveryFeeCents: 500,
      discountCents: 99999,
    });
    expect(totals.totalCents).toBe(0);
  });
});

describe('cupom', () => {
  const baseCoupon: CouponRule = {
    id: 'c1',
    code: 'BEMVINDO',
    scope: 'PLATFORM',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minOrderCents: 2000,
    usageCount: 0,
    firstOrderOnly: false,
    startsAt: new Date('2025-01-01'),
    isActive: true,
    maxDiscountCents: null,
    usageLimit: null,
    usagePerUser: 1,
  };

  const context = {
    subtotalCents: 5000,
    deliveryFeeCents: 700,
    storeId: 'loja-1',
    cityId: 'cidade-1',
    userRedemptionCount: 0,
    isFirstOrder: true,
    now: new Date('2025-03-10'),
  };

  it('aplica desconto percentual', () => {
    const result = applyCoupon(baseCoupon, context);
    expect(result).toMatchObject({ valid: true, discountCents: 1000 });
  });

  it('respeita o teto de desconto', () => {
    const result = applyCoupon({ ...baseCoupon, maxDiscountCents: 500 }, context);
    expect(result).toMatchObject({ valid: true, discountCents: 500 });
  });

  it('frete grátis desconta exatamente a entrega', () => {
    const result = applyCoupon(
      { ...baseCoupon, discountType: 'FREE_DELIVERY', discountValue: 0 },
      context,
    );
    expect(result).toMatchObject({ valid: true, discountCents: 700, freeDelivery: true });
  });

  it('recusa abaixo do pedido mínimo', () => {
    const result = applyCoupon(baseCoupon, { ...context, subtotalCents: 1000 });
    expect(result.valid).toBe(false);
  });

  it('recusa cupom de outra loja', () => {
    const result = applyCoupon(
      { ...baseCoupon, scope: 'STORE', storeId: 'outra-loja' },
      context,
    );
    expect(result.valid).toBe(false);
  });

  it('recusa cupom já usado pelo cliente', () => {
    const result = applyCoupon(baseCoupon, { ...context, userRedemptionCount: 1 });
    expect(result.valid).toBe(false);
  });

  it('recusa cupom expirado', () => {
    const result = applyCoupon({ ...baseCoupon, endsAt: new Date('2025-02-01') }, context);
    expect(result.valid).toBe(false);
  });
});

describe('status do pedido', () => {
  it('permite o fluxo normal', () => {
    expect(canTransition('RECEIVED', 'ACCEPTED')).toBe(true);
    expect(canTransition('ACCEPTED', 'PREPARING')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });

  it('bloqueia salto de etapa e volta atrás', () => {
    expect(canTransition('RECEIVED', 'DELIVERED')).toBe(false);
    expect(canTransition('DELIVERED', 'PREPARING')).toBe(false);
    expect(canTransition('CANCELLED', 'ACCEPTED')).toBe(false);
  });

  it('reconhece status finais', () => {
    expect(isFinalStatus('DELIVERED')).toBe(true);
    expect(isFinalStatus('PREPARING')).toBe(false);
  });
});
