import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ChannelTokenPayload } from './index';
import { CHANNEL_TOKEN_TTL_SECONDS } from './index';

/**
 * Assinatura dos tokens de canal. SÓ SERVIDOR.
 *
 * Fica fora do índice do pacote de propósito: importa `node:crypto`, que não
 * existe no navegador, e carrega o segredo de sessão. Quem precisa é o app
 * Next (emite) e o servidor de sockets (verifica).
 */

function assinar(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createChannelToken(
  payload: Omit<ChannelTokenPayload, 'expiresAt'> & { expiresAt?: number },
  secret: string,
): string {
  const expiresAt = payload.expiresAt ?? Math.floor(Date.now() / 1000) + CHANNEL_TOKEN_TTL_SECONDS;

  const corpo = Buffer.from(
    JSON.stringify({ channel: payload.channel, userId: payload.userId, expiresAt }),
  ).toString('base64url');

  return `${corpo}.${assinar(corpo, secret)}`;
}

export function verifyChannelToken(token: string, secret: string): ChannelTokenPayload | null {
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return null;

  const esperada = Buffer.from(assinar(corpo, secret));
  const recebida = Buffer.from(assinatura);

  // Comparação de tempo constante: comparar com === vaza o prefixo correto
  // pelo tempo de resposta e permite forjar a assinatura byte a byte.
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString()) as ChannelTokenPayload;
    if (typeof payload.channel !== 'string' || typeof payload.userId !== 'string') return null;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
