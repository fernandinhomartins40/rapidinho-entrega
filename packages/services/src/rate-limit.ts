import { getRedis } from './redis';

/**
 * Rate limiting por janela fixa em Redis.
 *
 * Vale principalmente para o OTP: sem isso, qualquer um enumera códigos de 6
 * dígitos ou usa o endpoint de envio para gastar o crédito de SMS da operação.
 * O limite é por chave (telefone e IP são contados separadamente, porque
 * bloquear só por IP não protege um telefone alvo e vice-versa).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(
  key: string,
  points: number,
  durationSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const redisKey = `ratelimit:${key}`;

  const results = await redis
    .multi()
    .incr(redisKey)
    // Só define o TTL na primeira ocorrência: renovar a cada hit criaria uma
    // janela deslizante que nunca expira sob tentativa contínua.
    .expire(redisKey, durationSeconds, 'NX')
    .exec();

  const count = Number(results?.[0]?.[1] ?? 0);

  if (count > points) {
    const ttl = await redis.ttl(redisKey);
    return { allowed: false, remaining: 0, retryAfterSeconds: ttl > 0 ? ttl : durationSeconds };
  }

  return { allowed: true, remaining: points - count, retryAfterSeconds: 0 };
}

/** Zera o contador — usado após um login bem-sucedido. */
export async function resetRateLimit(key: string): Promise<void> {
  await getRedis().del(`ratelimit:${key}`);
}

/** IP real do cliente, considerando que o tráfego passa pelo Nginx. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? 'desconhecido';
}
