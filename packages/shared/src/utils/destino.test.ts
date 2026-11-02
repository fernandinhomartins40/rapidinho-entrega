import { describe, expect, it } from 'vitest';
import { destinoInterno } from './destino';

describe('destinoInterno', () => {
  it('mantém caminho interno, com busca e âncora', () => {
    expect(destinoInterno('/pedidos')).toBe('/pedidos');
    expect(destinoInterno('/checkout/abc?x=1#y')).toBe('/checkout/abc?x=1#y');
  });

  it('recusa destino externo em todas as formas conhecidas', () => {
    for (const ataque of [
      'https://example.com',
      '//example.com',
      String.raw`/\example.com`,
      String.raw`\\example.com`,
      String.raw`/\/example.com`,
      String.raw`/\\example.com`,
      '/%2F%2Fexample.com/../..',
      'https:example.com',
      'javascript:alert(1)',
      '/\texample.com',
      '',
      undefined,
      null,
    ]) {
      const destino = destinoInterno(ataque);
      expect(destino.startsWith('/')).toBe(true);
      expect(destino.startsWith('//')).toBe(false);
      expect(new URL(destino, 'https://rapidinho.test').origin).toBe('https://rapidinho.test');
    }
  });

  it('usa o padrão informado', () => {
    expect(destinoInterno('https://x.com', '/loja')).toBe('/loja');
  });
});
