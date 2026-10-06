import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senha com scrypt (node:crypto, sem dependência nova).
 *
 * Formato: `scrypt$<sal base64>$<hash base64>`. Só para servidor e seed: usa
 * `node:crypto`, por isso fica fora do índice do pacote.
 */

const TAMANHO = 64;

export function gerarHashDeSenha(senha: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(senha, sal, TAMANHO);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export function senhaConfere(senha: string, guardado: string | null | undefined): boolean {
  const [algoritmo, sal, hash] = guardado?.split('$') ?? [];
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;

  const esperado = Buffer.from(hash, 'base64');
  if (esperado.length !== TAMANHO) return false;
  return timingSafeEqual(scryptSync(senha, Buffer.from(sal, 'base64'), TAMANHO), esperado);
}
