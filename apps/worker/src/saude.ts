/**
 * Verificação de saúde do worker, executada pelo healthcheck do container.
 *
 * Não basta o processo existir: um laço de eventos travado mantém o PID vivo e
 * as filas paradas. Por isso o critério é o batimento que `main.ts` renova a
 * cada 30 s com validade de 90 s — se ele sumiu, o worker parou de trabalhar
 * mesmo que o processo ainda esteja de pé.
 */
import Redis from 'ioredis';

const url = process.env.REDIS_URL;

if (!url) {
  console.error('REDIS_URL ausente');
  process.exit(1);
}

const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000 });

try {
  const valor = await redis.get('rapidinho:worker:vivo');
  process.exit(valor ? 0 : 1);
} catch {
  process.exit(1);
} finally {
  redis.disconnect();
}
