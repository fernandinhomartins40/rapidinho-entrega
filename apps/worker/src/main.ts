import { Worker, type Job } from 'bullmq';
import { prisma } from '@rapidinho/database';
import {
  agendarRotinas,
  capturarErro,
  dispararCampanha,
  getRedisBloqueante,
  logger,
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

// Conexão bloqueante: o BullMQ recusa `maxRetriesPerRequest` diferente de
// `null` e lança já na construção do Worker. A conexão comum, com 3
// retentativas, continua servindo a quem apenas publica na fila.
const conexao = getRedisBloqueante();

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

  // Uma campanha por vez: ela só enfileira notificações, e disparar duas em
  // paralelo encheria a fila de envio mais rápido do que ela esvazia.
  new Worker(
    QUEUES.campaigns,
    async (job: Job<{ campaignId: string }>) => dispararCampanha(job.data.campaignId),
    { connection: conexao, concurrency: 1 },
  ),
];

for (const trabalhador of trabalhadores) {
  trabalhador.on('failed', (job, erro) => {
    void capturarErro(erro, {
      origem: 'worker',
      fila: trabalhador.name,
      jobId: job?.id,
      tentativa: job?.attemptsMade,
    });
  });

  trabalhador.on('completed', (job) => {
    logger.debug({ fila: trabalhador.name, jobId: job.id }, '[worker] job concluído');
  });
}

await agendarRotinas();

/**
 * Batimento no Redis, para o healthcheck do container.
 *
 * O worker não atende HTTP, então não havia como o Docker saber se ele estava
 * vivo — e essa cegueira é exatamente o que escondeu que o processo nunca
 * subia. A chave expira em 90 s e é renovada a cada 30 s: se o laço de eventos
 * travar, ela some sozinha e o healthcheck reprova.
 */
const CHAVE_BATIMENTO = 'rapidinho:worker:vivo';

async function baterPonto(): Promise<void> {
  try {
    await conexao.set(CHAVE_BATIMENTO, String(Date.now()), 'EX', 90);
  } catch (erro) {
    logger.warn({ err: erro }, '[worker] não consegui registrar o batimento');
  }
}

await baterPonto();
const batimento = setInterval(() => void baterPonto(), 30_000);
// `unref` para o batimento não segurar o processo no encerramento.
batimento.unref();

logger.info({ filas: trabalhadores.length }, '[worker] ouvindo filas');

/**
 * Encerramento limpo.
 *
 * `close()` espera o job em andamento terminar antes de sair. Sem isso, um
 * deploy no meio de uma cobrança deixaria o trabalho pela metade — e cobrança
 * pela metade é o pior tipo.
 */
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    logger.info({ sinal }, '[worker] encerrando');

    void Promise.all(trabalhadores.map((trabalhador) => trabalhador.close()))
      .then(() => prisma.$disconnect())
      .finally(() => process.exit(0));
  });
}
