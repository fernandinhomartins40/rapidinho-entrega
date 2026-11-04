import { describe, expect, it } from 'vitest';
import { inicioDoDia } from '../utils/calendario';
import {
  diaDaSemanaLocal,
  linhasDaMarmita,
  marmitaForaDoCardapio,
  precoDaMarmita,
  type EscolhaDaMarmita,
} from './marmita';

// Quarta-feira, 12h em Brasília (15h UTC).
const quarta = new Date('2026-11-04T15:00:00Z');

const escolhas: EscolhaDaMarmita[] = [
  { nome: 'Feijão', papel: 'NO_PRATO', ajuste: 'SEM', precoCents: 0 },
  { nome: 'Arroz', papel: 'NO_PRATO', ajuste: 'POUCO', precoCents: 0 },
  { nome: 'Picanha', papel: 'MISTURA', ajuste: 'ESCOLHIDO', precoCents: 600 },
  { nome: 'Ovo frito', papel: 'EXTRA', ajuste: 'ESCOLHIDO', precoCents: 200 },
];

describe('marmita', () => {
  it('cobra o tamanho, o acréscimo da mistura e os extras; tirar não muda o preço', () => {
    expect(precoDaMarmita(2200, escolhas)).toBe(3000);
  });

  it('sai nos dias marcados e em todo dia quando nenhum é marcado', () => {
    const base = { isAvailable: true, pausedUntil: null };
    expect(diaDaSemanaLocal(quarta)).toBe(3);
    expect(marmitaForaDoCardapio({ ...base, weekdays: [] }, quarta)).toBe(false);
    expect(marmitaForaDoCardapio({ ...base, weekdays: [3] }, quarta)).toBe(false);
    expect(marmitaForaDoCardapio({ ...base, weekdays: [1, 5] }, quarta)).toBe(true);
  });

  it('"acabou hoje" tira do ar até a meia-noite de Brasília', () => {
    const fim = inicioDoDia(quarta, -1);
    expect(fim.toISOString()).toBe('2026-11-05T03:00:00.000Z');
    const pausado = { isAvailable: true, weekdays: [], pausedUntil: fim };
    expect(marmitaForaDoCardapio(pausado, quarta)).toBe(true);
    expect(marmitaForaDoCardapio(pausado, new Date('2026-11-05T03:01:00Z'))).toBe(false);
  });

  it('a comanda mostra mistura, ajustes e extras, nessa ordem', () => {
    expect(linhasDaMarmita(escolhas)).toEqual([
      { grupo: 'Mistura', nome: 'Picanha', precoCents: 600 },
      { grupo: 'Ajustes', nome: 'SEM feijão', precoCents: 0 },
      { grupo: 'Ajustes', nome: 'POUCO arroz', precoCents: 0 },
      { grupo: 'Extras', nome: 'Ovo frito', precoCents: 200 },
    ]);
  });
});
