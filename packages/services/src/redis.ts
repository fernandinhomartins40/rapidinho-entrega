import Redis from 'ioredis';
import { parseServerEnv } from '@rapidinho/shared';
import { logger } from './logger';

/**
 * Conexão com o Redis, compartilhada pelo processo.
 *
 * Uma instância só: cada `new Redis()` abre um socket, e criar um por request
 * esgota as conexões do servidor em pico de pedido.
 */

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient) return redisClient;

  const env = parseServerEnv();
  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  redisClient.on('error', (error) => {
    logger.error({ err: error.message }, '[redis] erro de conexão');
  });

  return redisClient;
}

/**
 * Conexão para consumo de fila (BullMQ Worker).
 *
 * O BullMQ RECUSA uma conexão com `maxRetriesPerRequest` diferente de `null` e
 * lança na construção do Worker: ele usa comandos bloqueantes (BRPOPLPUSH), que
 * ficam pendurados de propósito esperando job, e o limite de retentativa por
 * comando mataria essa espera.
 *
 * Era por isso que o processo de filas não subia: `getRedis()` usa 3, que é o
 * certo para quem só publica, e errado para quem consome.
 */
let bloqueante: Redis | null = null;

export function getRedisBloqueante(): Redis {
  if (bloqueante) return bloqueante;

  const env = parseServerEnv();
  bloqueante = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  bloqueante.on('error', (error) => {
    logger.error({ err: error.message }, '[redis:fila] erro de conexão');
  });

  return bloqueante;
}

/**
 * Conexão dedicada para inscrição.
 *
 * Um cliente Redis em modo subscribe não aceita mais nenhum comando, então
 * quem escuta precisa de um socket próprio, separado do de publicação.
 */
export function createRedisSubscriber(): Redis {
  const env = parseServerEnv();
  const subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  subscriber.on('error', (error) => {
    logger.error({ err: error.message }, '[redis:sub] erro de conexão');
  });

  return subscriber;
}
