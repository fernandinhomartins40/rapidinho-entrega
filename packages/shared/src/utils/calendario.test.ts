import { describe, expect, it } from 'vitest';
import { inicioDoDia, inicioDoMes } from './calendario';

describe('inicioDoDia', () => {
  it('às 22h de Brasília (01h UTC do dia seguinte) ainda é o mesmo dia', () => {
    // 2026-09-27 22:00 em Brasília = 2026-09-28 01:00 UTC
    const agora = new Date('2026-09-28T01:00:00Z');
    expect(inicioDoDia(agora).toISOString()).toBe('2026-09-27T03:00:00.000Z');
  });

  it('logo depois da meia-noite de Brasília já é o dia novo', () => {
    const agora = new Date('2026-09-28T03:05:00Z');
    expect(inicioDoDia(agora).toISOString()).toBe('2026-09-28T03:00:00.000Z');
  });

  it('volta dias inteiros', () => {
    const agora = new Date('2026-09-28T15:00:00Z');
    expect(inicioDoDia(agora, 6).toISOString()).toBe('2026-09-22T03:00:00.000Z');
  });
});

describe('inicioDoMes', () => {
  it('na noite do último dia do mês ainda é o mês corrente', () => {
    // 30/09 23h em Brasília = 01/10 02h UTC
    const agora = new Date('2026-10-01T02:00:00Z');
    expect(inicioDoMes(agora).toISOString()).toBe('2026-09-01T03:00:00.000Z');
  });

  it('volta meses atravessando o ano', () => {
    const agora = new Date('2026-02-10T12:00:00Z');
    expect(inicioDoMes(agora, 3).toISOString()).toBe('2025-11-01T03:00:00.000Z');
  });
});
