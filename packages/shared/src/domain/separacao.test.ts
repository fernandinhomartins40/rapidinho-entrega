import { describe, expect, it } from 'vitest';
import {
  fecharContaDaSeparacao,
  lerPesoDigitado,
  valorDoItemSeparado,
  type ItemDaSeparacao,
} from './separacao';

// Patinho pedido com 500 g → R$ 20,00 estimado (R$ 40,00 o kg).
const patinho: ItemDaSeparacao = {
  totalCents: 2000,
  quantity: 1,
  weightGrams: 500,
  pickStatus: 'PICKED',
  pickedWeightGrams: 500,
  replacementPriceCents: null,
  replacementAccepted: null,
};

const arroz: ItemDaSeparacao = {
  totalCents: 2500,
  quantity: 1,
  weightGrams: null,
  pickStatus: 'PICKED',
  pickedWeightGrams: null,
  replacementPriceCents: null,
  replacementAccepted: null,
};

describe('pesagem justa — item', () => {
  it('cobra o peso real quando vem mais leve', () => {
    expect(valorDoItemSeparado({ ...patinho, pickedWeightGrams: 460 })).toEqual({
      finalCents: 1840,
      cortesiaCents: 0,
    });
  });

  it('cobra o peso real até +10%', () => {
    expect(valorDoItemSeparado({ ...patinho, pickedWeightGrams: 540 }).finalCents).toBe(2160);
  });

  it('acima de +10% o excedente é cortesia da loja', () => {
    expect(valorDoItemSeparado({ ...patinho, pickedWeightGrams: 700 })).toEqual({
      finalCents: 2200,
      cortesiaCents: 600,
    });
  });

  it('usa o valor da porção do pedido, como o checkout grava', () => {
    // Banana: 500 g por R$ 3,00; pesou 600 g → R$ 3,60, teto R$ 3,30.
    const banana = { ...patinho, totalCents: 300, pickedWeightGrams: 600 };
    expect(valorDoItemSeparado(banana)).toEqual({ finalCents: 330, cortesiaCents: 30 });
  });

  it('item em falta sai da conta', () => {
    expect(valorDoItemSeparado({ ...arroz, pickStatus: 'MISSING' }).finalCents).toBe(0);
  });

  it('troca da loja nunca custa mais que o original', () => {
    const troca = { ...arroz, pickStatus: 'REPLACED' as const, replacementPriceCents: 2900 };
    expect(valorDoItemSeparado(troca)).toEqual({ finalCents: 2500, cortesiaCents: 400 });
    expect(valorDoItemSeparado({ ...troca, replacementPriceCents: 2200 }).finalCents).toBe(2200);
  });

  it('troca aceita pelo cliente sai pelo preço aceito', () => {
    expect(
      valorDoItemSeparado({
        ...arroz,
        pickStatus: 'REPLACED',
        replacementPriceCents: 2900,
        replacementAccepted: true,
      }).finalCents,
    ).toBe(2900);
  });
});

describe('pesagem justa — conta', () => {
  const base = {
    totalEstimadoCents: 5000,
    deliveryFeeCents: 500,
    surchargeCents: 0,
    discountCents: 0,
    commissionRate: 10,
  };

  it('na entrega, o total acompanha o peso', () => {
    const conta = fecharContaDaSeparacao({
      ...base,
      itens: [{ ...patinho, pickedWeightGrams: 540 }, arroz],
      pagoOnlineCents: null,
    });
    expect(conta.totalCents).toBe(5160);
    expect(conta.diferencaCents).toBe(160);
    expect(conta.estornoCents).toBe(0);
    expect(conta.commissionCents).toBe(466);
  });

  it('pago online: mais leve vira estorno', () => {
    const conta = fecharContaDaSeparacao({
      ...base,
      itens: [{ ...patinho, pickedWeightGrams: 450 }, arroz],
      pagoOnlineCents: 5000,
    });
    expect(conta.totalCents).toBe(4800);
    expect(conta.estornoCents).toBe(200);
  });

  it('pago online: nunca cobra acima do pago', () => {
    const conta = fecharContaDaSeparacao({
      ...base,
      itens: [{ ...patinho, pickedWeightGrams: 540 }, arroz],
      pagoOnlineCents: 5000,
    });
    expect(conta.totalCents).toBe(5000);
    expect(conta.estornoCents).toBe(0);
    expect(conta.cortesiaCents).toBe(160);
  });

  it('desconto não passa da compra', () => {
    const conta = fecharContaDaSeparacao({
      ...base,
      discountCents: 3000,
      itens: [{ ...arroz, pickStatus: 'MISSING' }, { ...patinho }],
      pagoOnlineCents: null,
    });
    expect(conta.discountCents).toBe(2000);
    expect(conta.totalCents).toBe(500);
  });
});

describe('peso digitado', () => {
  it.each([
    ['0,520', 520],
    ['0.52', 520],
    ['520', 520],
    ['1,2 kg', 1200],
    ['2', 2000],
    ['350g', 350],
  ])('%s → %i g', (texto, gramas) => {
    expect(lerPesoDigitado(texto)).toBe(gramas);
  });

  it.each(['', 'abc', '0', '-1', '99999'])('recusa %s', (texto) => {
    expect(lerPesoDigitado(texto)).toBeNull();
  });
});
