import Redis from 'ioredis';
import { parseServerEnv } from '@rapidinho/shared';

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
    console.error('[redis] erro de conexão', error.message);
  });

  return redisClient;
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
    console.error('[redis:sub] erro de conexão', error.message);
  });

  return subscriber;
}
