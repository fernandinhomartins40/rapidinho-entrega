import { consumeRateLimit } from '@rapidinho/services/rate-limit';
import { RATE_LIMITS } from '@rapidinho/shared';

/**
 * Limites do login por telefone, os mesmos no site e no app: as chaves são
 * compartilhadas, então trocar de canal não dá tentativas novas.
 */

export async function limitarPedidoDeCodigo(
  phone: string,
  ip: string,
): Promise<{ permitido: boolean; esperaSegundos: number }> {
  const limit = await consumeRateLimit(
    `otp:request:phone:${phone}`,
    RATE_LIMITS.otpRequest.points,
    RATE_LIMITS.otpRequest.durationSeconds,
  );

  // Por IP também: o limite por telefone sozinho deixa quem varre vários números
  // do mesmo lugar gastar SMS à vontade. Teto folgado porque, no interior, a
  // operadora põe muitos celulares atrás do mesmo IP (CGNAT).
  const limitePorIp = await consumeRateLimit(
    `otp:request:ip:${ip}`,
    RATE_LIMITS.otpRequest.points * 10,
    RATE_LIMITS.otpRequest.durationSeconds,
  );

  return {
    permitido: limit.allowed && limitePorIp.allowed,
    esperaSegundos: Math.max(limit.retryAfterSeconds, limitePorIp.retryAfterSeconds),
  };
}

export async function limitarConferenciaDeCodigo(
  phone: string,
  ip: string,
): Promise<{ permitido: boolean; chave: string }> {
  const chave = `otp:verify:${phone}:${ip}`;

  const limit = await consumeRateLimit(
    chave,
    RATE_LIMITS.otpVerify.points,
    RATE_LIMITS.otpVerify.durationSeconds,
  );

  return { permitido: limit.allowed, chave };
}
