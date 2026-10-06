import { describe, expect, it } from 'vitest';
import { gerarHashDeSenha, senhaConfere } from './senha';

describe('hash de senha', () => {
  it('confere a senha certa e recusa as erradas', () => {
    const hash = gerarHashDeSenha('Admin@123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(senhaConfere('Admin@123', hash)).toBe(true);
    expect(senhaConfere('admin@123', hash)).toBe(false);
    expect(senhaConfere('', hash)).toBe(false);
  });

  it('usa sal novo a cada hash', () => {
    expect(gerarHashDeSenha('x')).not.toBe(gerarHashDeSenha('x'));
  });

  it('recusa hash ausente ou malformado', () => {
    expect(senhaConfere('x', null)).toBe(false);
    expect(senhaConfere('x', 'texto-puro')).toBe(false);
    expect(senhaConfere('x', 'scrypt$abc$def')).toBe(false);
  });
});
