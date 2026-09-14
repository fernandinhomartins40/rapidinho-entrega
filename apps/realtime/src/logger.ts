import pino from 'pino';

/**
 * Log estruturado deste processo.
 *
 * Próprio, e não o de `@rapidinho/services`: aquele pacote carrega sharp,
 * BullMQ e o SDK da S3, e este container existe justamente para ser pequeno —
 * ele só repassa mensagens do Redis para sockets abertos.
 *
 * Nada de `redact` de telefone aqui porque nada do que passa por este processo
 * tem dado pessoal: o servidor não fala com o banco, e a autorização de canal
 * é um token assinado.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
