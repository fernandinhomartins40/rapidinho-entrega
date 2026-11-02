import { describe, expect, it } from 'vitest';
import { estaNoAppNativo } from './app-nativo';

describe('estaNoAppNativo', () => {
  it('reconhece o WebView do app', () => {
    expect(
      estaNoAppNativo(
        'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 RapidinhoApp/1.0',
      ),
    ).toBe(true);
  });

  it('não confunde com o Chrome do celular', () => {
    expect(
      estaNoAppNativo(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
      ),
    ).toBe(false);
  });

  it('sem user agent não é o app', () => {
    expect(estaNoAppNativo(null)).toBe(false);
    expect(estaNoAppNativo(undefined)).toBe(false);
  });
});
