import { Worker, type Job } from 'bullmq';
import { prisma } from '@rapidinho/database';
import {
  agendarRotinas,
  getRedis,
  notificarUsuario,
  type JobDeNotificacao,
} from '@rapidinho/services';
import { QUEUES } from '@rapidinho/shared';
import { cobrarMensalidades } from './jobs/plan-billing';
import { expirarImpulsionamentos } from './jobs/boost-expiration';
import { expirarPedido } from './jobs/order-timeout';
import { processarImagem } from './jobs/image-processing';

/**
 * Processo de trabalho em segundo plano.
 *
 * Separado dos apps Next de propósito: job pesado no mesmo processo que atende
 * requisição rouba CPU de quem está esperando a página carregar. Aqui ele pode
 * demorar sem prejudicar ninguém.
 */

const conexao = getRedis();

/** Concorrência por fila, conforme o custo de cada trabalho. */
const trabalhadores = [
  new Worker<JobDeNotificacao>(
    QUEUES.notifications,
    async (job) => notificarUsuario(job.data),
    // Notificação é quase toda espera de rede: dá para tocar várias ao mesmo
    // tempo sem pesar.
    { connection: conexao, concurrency: 10 },
  ),

  new Worker(
    QUEUES.imageProcessing,
    async (job: Job<{ mediaId: string }>) => processarImagem(job.data.mediaId),
    // sharp é CPU pura: mais de dois em paralelo só faz um brigar com o outro.
    { connection: conexao, concurrency: 2 },
  ),

  new Worker(
    QUEUES.orderTimeout,
    async (job: Job<{ orderId: string }>) => expirarPedido(job.data.orderId),
    { connection: conexao, concurrency: 5 },
  ),

  new Worker(QUEUES.planBilling, async () => cobrarMensalidades(), {
    connection: conexao,
    concurrency: 1,
  }),

  new Worker(QUEUES.boostExpiration, async () => expirarImpulsionamentos(), {
    connection: conexao,
    concurrency: 1,
  }),
];

for (const trabalhador of trabalhadores) {
  trabalhador.on('failed', (job, erro) => {
    console.error(`[worker] ${trabalhador.name} falhou`, {
      jobId: job?.id,
      tentativa: job?.attemptsMade,
      erro: erro.message,
    });
  });

  trabalhador.on('completed', (job) => {
    console.warn(`[worker] ${trabalhador.name} concluiu ${job.id}`);
  });
}

await agendarRotinas();

console.warn(`[worker] ouvindo ${trabalhadores.length} filas`);

/**
 * Encerramento limpo.
 *
 * `close()` espera o job em andamento terminar antes de sair. Sem isso, um
 * deploy no meio de uma cobrança deixaria o trabalho pela metade — e cobrança
 * pela metade é o pior tipo.
 */
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    console.warn(`[worker] encerrando (${sinal})`);

    void Promise.all(trabalhadores.map((trabalhador) => trabalhador.close()))
      .then(() => prisma.$disconnect())
      .finally(() => process.exit(0));
  });
}
