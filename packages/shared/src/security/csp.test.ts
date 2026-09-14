import { describe, expect, it } from 'vitest';
import { gerarNonce, montarCsp } from './csp';

describe('gerarNonce', () => {
  it('gera valor diferente a cada chamada', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => gerarNonce()));
    expect(nonces.size).toBe(50);
  });

  it('devolve base64 válido com 128 bits', () => {
    const nonce = gerarNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(atob(nonce)).toHaveLength(16);
  });
});

describe('montarCsp', () => {
  const origens = {
    imagens: 'https://rapidinhoentrega.com.br/uploads',
    socket: 'https://rapidinhoentrega.com.br',
  };

  it('põe o nonce no script-src', () => {
    expect(montarCsp('abc123', origens)).toContain("script-src 'nonce-abc123'");
  });

  it('inclui strict-dynamic, sem o qual o Next não carrega os próprios chunks', () => {
    expect(montarCsp('abc', origens)).toContain("'strict-dynamic'");
  });

  it('libera o socket em http e em ws — connect-src trata os dois como origens distintas', () => {
    const politica = montarCsp('abc', origens);
    expect(politica).toContain('https://rapidinhoentrega.com.br');
    expect(politica).toContain('wss://rapidinhoentrega.com.br');
  });

  it('usa só a origem da URL de imagens, não o caminho', () => {
    const politica = montarCsp('abc', origens);
    expect(politica).not.toContain('/uploads');
  });

  it('bloqueia plugin, moldura e base forjada', () => {
    const politica = montarCsp('abc', origens);
    expect(politica).toContain("object-src 'none'");
    expect(politica).toContain("frame-ancestors 'none'");
    expect(politica).toContain("base-uri 'self'");
    expect(politica).toContain("form-action 'self'");
  });

  it('não libera eval em produção', () => {
    expect(montarCsp('abc', origens)).not.toContain("'unsafe-eval'");
  });

  it('libera eval em desenvolvimento, onde o Next recarrega a página com ele', () => {
    expect(montarCsp('abc', { ...origens, desenvolvimento: true })).toContain("'unsafe-eval'");
  });

  it('força https só fora de desenvolvimento — local não tem certificado', () => {
    expect(montarCsp('abc', origens)).toContain('upgrade-insecure-requests');
    expect(montarCsp('abc', { desenvolvimento: true })).not.toContain('upgrade-insecure-requests');
  });

  it('ignora URL inválida em vez de emitir diretiva quebrada', () => {
    const politica = montarCsp('abc', { imagens: 'nao-e-url', socket: '' });
    expect(politica).toContain("img-src 'self' data: blob:");
    expect(politica).toContain("connect-src 'self'");
    expect(politica).not.toContain('undefined');
  });
});
