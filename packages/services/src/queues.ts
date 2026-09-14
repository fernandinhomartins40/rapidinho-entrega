import { Queue, type JobsOptions } from 'bullmq';
import { QUEUES } from '@rapidinho/shared';
import { getRedis } from './redis';

/**
 * Filas de trabalho.
 *
 * O que entra aqui é o que não pode segurar a resposta ao usuário: gerar as
 * variantes de uma imagem, cobrar mensalidade, expirar impulsionamento. O que
 * o usuário espera na tela — preço, status do pedido — continua síncrono.
 */

const filas = new Map<string, Queue>();

/**
 * Reaproveita a conexão do Redis já aberta.
 *
 * O BullMQ abre uma conexão por fila se deixarmos; com seis filas isso é seis
 * sockets por processo, multiplicados pelas instâncias do app.
 */
export function getQueue(nome: string): Queue {
  const existente = filas.get(nome);
  if (existente) return existente;

  const fila = new Queue(nome, { connection: getRedis() });
  filas.set(nome, fila);

  return fila;
}

/** Padrão de retentativa: espaçamento exponencial e histórico enxuto. */
const PADRAO: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  // Guardar todo job concluído faz o Redis crescer sem limite; o que importa
  // é o histórico recente e as falhas.
  removeOnComplete: { count: 100, age: 24 * 3600 },
  removeOnFail: { count: 1000, age: 7 * 24 * 3600 },
};

export interface JobDeImagem {
  mediaId: string;
}

export interface JobDeNotificacao {
  userId: string;
  title: string;
  body: string;
  url?: string;
  canais: ('PUSH' | 'WHATSAPP' | 'EMAIL')[];
  entity?: { type: string; id: string };
  tag?: string;
}

export interface JobDeCobranca {
  storeSubscriptionId: string;
}

export interface JobDeExpiracaoDePedido {
  orderId: string;
}

export interface JobDeCampanha {
  campaignId: string;
}

export async function enfileirarNotificacao(dados: JobDeNotificacao): Promise<void> {
  await getQueue(QUEUES.notifications).add('enviar', dados, PADRAO);
}

export async function enfileirarProcessamentoDeImagem(dados: JobDeImagem): Promise<void> {
  await getQueue(QUEUES.imageProcessing).add('processar', dados, PADRAO);
}

/**
 * Coloca uma campanha na fila de despacho.
 *
 * O `jobId` fixo é o que impede um clique duplo no botão de enviar virar duas
 * campanhas: o BullMQ recusa um job com id que já existe.
 */
export async function enfileirarCampanha(dados: JobDeCampanha): Promise<void> {
  await getQueue(QUEUES.campaigns).add('despachar', dados, {
    ...PADRAO,
    jobId: `campanha:${dados.campaignId}`,
  });
}

/**
 * Agenda o cancelamento de um pedido não pago.
 *
 * Sem isso, um Pix abandonado deixa o pedido preso em PENDING_PAYMENT para
 * sempre, ocupando o cupom que foi resgatado junto.
 */
export async function agendarExpiracaoDePedido(
  dados: JobDeExpiracaoDePedido,
  emSegundos: number,
): Promise<void> {
  await getQueue(QUEUES.orderTimeout).add('expirar', dados, {
    ...PADRAO,
    delay: emSegundos * 1000,
    // O id fixo evita agendar duas expirações para o mesmo pedido se a ação
    // for chamada de novo.
    jobId: `expirar:${dados.orderId}`,
  });
}

/**
 * Rotinas recorrentes, registradas uma vez pelo worker ao subir.
 *
 * `upsertJobScheduler` é idempotente por chave: reiniciar o worker não
 * duplica o agendamento, que é o que aconteceria com `add({ repeat })` a cada
 * boot.
 */
export async function agendarRotinas(): Promise<void> {
  await getQueue(QUEUES.planBilling).upsertJobScheduler(
    'cobranca-diaria',
    // 9h de Brasília; o agendador do BullMQ trabalha em UTC.
    { pattern: '0 12 * * *' },
    { name: 'cobrar-mensalidades', opts: PADRAO },
  );

  await getQueue(QUEUES.boostExpiration).upsertJobScheduler(
    'expiracao-de-boost',
    { pattern: '5 * * * *' },
    { name: 'expirar-impulsionamentos', opts: PADRAO },
  );
}
