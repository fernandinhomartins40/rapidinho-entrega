import { describe, expect, it } from 'vitest';
import { buildPixBrCode, crc16 } from './pix';

describe('crc16', () => {
  it('calcula o CRC-16/CCITT-FALSE do vetor conhecido', () => {
    // Vetor clássico do algoritmo: "123456789" → 0x29B1.
    expect(crc16('123456789')).toBe('29B1');
  });

  it('devolve sempre quatro dígitos hexadecimais', () => {
    expect(crc16('a')).toHaveLength(4);
    expect(crc16('payload qualquer')).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe('buildPixBrCode', () => {
  const base = {
    pixKey: '44999990001',
    amountCents: 4550,
    merchantName: 'Mercado do Joao',
    merchantCity: 'Palmital',
  };

  it('começa com o indicador de versão do payload', () => {
    expect(buildPixBrCode(base).startsWith('000201')).toBe(true);
  });

  it('inclui o domínio do Pix e a chave do recebedor', () => {
    const codigo = buildPixBrCode(base);
    expect(codigo).toContain('br.gov.bcb.pix');
    expect(codigo).toContain('44999990001');
  });

  it('grava o valor com duas casas decimais', () => {
    // 4550 centavos → "45.00" seria errado; tem de ser "45.50".
    expect(buildPixBrCode(base)).toContain('540545.50');
  });

  it('remove acentos do nome do recebedor', () => {
    // Um "ç" faz o app do banco recusar o código inteiro.
    const codigo = buildPixBrCode({ ...base, merchantName: 'Açougue São José' });
    expect(codigo).toContain('Acougue Sao Jose');
    expect(codigo).not.toMatch(/[çãéÇÃÉ]/);
  });

  it('fecha com um CRC que confere', () => {
    const codigo = buildPixBrCode(base);
    const semCrc = codigo.slice(0, -4);
    const crcDoCodigo = codigo.slice(-4);

    expect(crc16(semCrc)).toBe(crcDoCodigo);
  });

  it('usa *** como referência quando não há txid', () => {
    expect(buildPixBrCode(base)).toContain('62070503***');
  });

  it('limpa caracteres inválidos do txid', () => {
    const codigo = buildPixBrCode({ ...base, txid: 'PED-1234/56' });
    expect(codigo).toContain('PED123456');
  });

  it('corta o nome do recebedor no limite do padrão', () => {
    const codigo = buildPixBrCode({
      ...base,
      merchantName: 'Supermercado Muito Grande de Palmital Parana',
    });

    // Campo 59 tem no máximo 25 caracteres.
    const posicao = codigo.indexOf('59');
    expect(Number(codigo.slice(posicao + 2, posicao + 4))).toBeLessThanOrEqual(25);
  });
});
