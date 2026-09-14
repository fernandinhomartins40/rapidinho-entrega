import pino from 'pino';
import { parseServerEnv } from '@rapidinho/shared';

/**
 * Log estruturado.
 *
 * JSON em produção (o coletor precisa parsear) e legível em desenvolvimento.
 *
 * O `redact` é a parte que importa: telefone é o identificador de login aqui,
 * e um telefone num log de erro é dado pessoal exposto — que a LGPD trata como
 * incidente, não como detalhe de operação.
 */

const env = parseServerEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'phone',
      '*.phone',
      '*.customerPhone',
      'password',
      '*.password',
      'code',
      '*.code',
      'token',
      '*.token',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      'pixKey',
      '*.pixKey',
      'cardToken',
      '*.cardToken',
    ],
    censor: '[oculto]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

/** Logger com contexto fixo, para não repetir o mesmo campo em toda chamada. */
export function comContexto(contexto: Record<string, unknown>) {
  return logger.child(contexto);
}
