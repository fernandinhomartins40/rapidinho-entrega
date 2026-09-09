import { describe, expect, it } from 'vitest';
import { formatCents, parseCurrencyToCents, percentOfCents, weightPriceCents } from './money';
import { formatPhoneBR, isValidPhoneBR, normalizePhoneBR } from './phone';
import { isValidCNPJ, isValidCPF, isValidDocument } from './document';
import { distanceInMeters } from './geo';
import { slugify } from './slug';

describe('money', () => {
  it('formata centavos em reais', () => {
    expect(formatCents(1250)).toBe('R$ 12,50');
    expect(formatCents(0)).toBe('R$ 0,00');
    expect(formatCents(100000)).toBe('R$ 1.000,00');
  });

  it('converte texto digitado em centavos', () => {
    expect(parseCurrencyToCents('R$ 12,50')).toBe(1250);
    expect(parseCurrencyToCents('12,50')).toBe(1250);
    expect(parseCurrencyToCents('12.50')).toBe(1250);
    expect(parseCurrencyToCents('1.234,56')).toBe(123456);
    expect(parseCurrencyToCents('')).toBe(0);
    expect(parseCurrencyToCents('abc')).toBe(0);
  });

  it('calcula percentual arredondando o centavo', () => {
    expect(percentOfCents(1000, 10)).toBe(100);
    // 12,5% de R$ 33,33 = 416,625 centavos → arredonda para 417.
    expect(percentOfCents(3333, 12.5)).toBe(417);
  });

  it('cobra proporcional ao peso escolhido', () => {
    // R$ 39,90/kg, 500 g.
    expect(weightPriceCents(3990, 500)).toBe(1995);
    expect(weightPriceCents(3990, 1000)).toBe(3990);
    expect(weightPriceCents(3990, 250)).toBe(998);
  });
});

describe('telefone', () => {
  it('normaliza para E.164', () => {
    expect(normalizePhoneBR('(44) 99999-8888')).toBe('+5544999998888');
    expect(normalizePhoneBR('44999998888')).toBe('+5544999998888');
    expect(normalizePhoneBR('+55 44 99999-8888')).toBe('+5544999998888');
    expect(normalizePhoneBR('4433334444')).toBe('+554433334444');
  });

  it('recusa número inválido', () => {
    expect(normalizePhoneBR('123')).toBeNull();
    expect(isValidPhoneBR('999998888')).toBe(false);
  });

  it('formata para exibição', () => {
    expect(formatPhoneBR('+5544999998888')).toBe('(44) 99999-8888');
    expect(formatPhoneBR('+554433334444')).toBe('(44) 3333-4444');
  });
});

describe('documento', () => {
  it('valida CPF', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('52998224725')).toBe(true);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('529.982.247-26')).toBe(false);
  });

  it('valida CNPJ', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('11222333000181')).toBe(true);
    expect(isValidCNPJ('11.111.111/1111-11')).toBe(false);
  });

  it('aceita CPF ou CNPJ no cadastro de loja (MEI)', () => {
    expect(isValidDocument('52998224725')).toBe(true);
    expect(isValidDocument('11222333000181')).toBe(true);
    expect(isValidDocument('123')).toBe(false);
  });
});

describe('geo', () => {
  it('calcula distância entre dois pontos', () => {
    // Centro de Palmital/PR até um ponto ~2 km ao norte.
    const distance = distanceInMeters(
      { latitude: -24.8886, longitude: -52.2094 },
      { latitude: -24.8706, longitude: -52.2094 },
    );
    expect(distance).toBeGreaterThan(1900);
    expect(distance).toBeLessThan(2100);
  });
});

describe('slug', () => {
  it('remove acento e normaliza', () => {
    expect(slugify('Açaí do João')).toBe('acai-do-joao');
    expect(slugify('Palmital PR')).toBe('palmital-pr');
    expect(slugify('  Pizzaria   Dois Irmãos ')).toBe('pizzaria-dois-irmaos');
  });
});
