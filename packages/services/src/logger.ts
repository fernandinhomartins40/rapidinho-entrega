import pino from 'pino';

/**
 * Log estruturado.
 *
 * JSON em produção (o coletor precisa parsear) e legível em desenvolvimento.
 *
 * O `redact` é a parte que importa: telefone é o identificador de login aqui,
 * e um telefone num log de erro é dado pessoal exposto — que a LGPD trata como
 * incidente, não como detalhe de operação.
 *
 * As duas variáveis são lidas direto, sem passar pela validação do ambiente:
 * validar o ambiente inteiro para escolher um nível de log tornaria este
 * módulo — e tudo que o importa — impossível de carregar num teste. Um nível
 * inválido cai no padrão do pino; um logger que não sobe derruba o processo.
 */

const NIVEIS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
const nivel = process.env.LOG_LEVEL ?? '';

export const logger = pino({
  level: (NIVEIS as readonly string[]).includes(nivel) ? nivel : 'info',
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
  ...(process.env.NODE_ENV === 'development'
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
