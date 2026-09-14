import { prisma, type Prisma } from '@rapidinho/database';
import { limiteDeInatividade, papeisDoPublico, type NotificationSegment } from '@rapidinho/shared';
import { logger } from '../logger';
import { enfileirarNotificacao } from '../queues';

/**
 * Campanhas de notificação da plataforma.
 *
 * A regra que manda aqui é a do consentimento: campanha é comunicação de
 * marketing, e a LGPD exige opt-in explícito. Aviso de pedido é outra coisa —
 * continua saindo por `notificarUsuario`, sem passar por este filtro, porque é
 * o serviço que a pessoa contratou ao fazer o pedido.
 *
 * O envio não acontece na Server Action: mil notificações levam minutos e o
 * navegador desiste antes. A ação cria a campanha e enfileira; o worker
 * despacha uma a uma, com retentativa individual.
 */

/**
 * Traduz o segmento em filtro de usuário.
 *
 * Exportado porque a tela conta os destinatários ANTES do envio, e contar com
 * um filtro diferente do que será usado seria pior do que não contar.
 */
export function filtroDoSegmento(
  segmento: NotificationSegment,
  agora: Date = new Date(),
): Prisma.UserWhereInput {
  const filtro: Prisma.UserWhereInput = {
    deletedAt: null,
    status: 'ACTIVE',
    role: { in: papeisDoPublico(segmento.publico) },
    // Sem opt-in não há campanha. É o filtro que não pode ser esquecido.
    marketingOptIn: true,
    // Sem inscrição de push, a notificação não chega a lugar nenhum e só
    // gastaria uma linha de log.
    pushSubscriptions: { some: {} },
  };

  // A cidade do usuário é a dos endereços dele: não há campo de cidade no
  // cadastro, e inferir pelo último pedido deixaria de fora quem se cadastrou
  // e ainda não pediu — justamente o público de uma campanha de ativação.
  if (segmento.cityIds.length > 0) {
    filtro.addresses = { some: { cityId: { in: segmento.cityIds } } };
  }

  if (segmento.apenasComPedido) {
    filtro.orders = { some: {} };
  }

  const limite = limiteDeInatividade(segmento, agora);

  if (limite) {
    // `none` em vez de comparar o último pedido: quem nunca pediu também está
    // parado, e uma campanha de retorno deve alcançá-lo.
    filtro.orders = { none: { createdAt: { gte: limite } } };
  }

  return filtro;
}

/** Quantos receberiam a campanha se ela fosse enviada agora. */
export async function contarDestinatarios(segmento: NotificationSegment): Promise<number> {
  return prisma.user.count({ where: filtroDoSegmento(segmento) });
}

/**
 * Despacha uma campanha já criada.
 *
 * Idempotente pelo `sentAt`: se o job for repetido — e o BullMQ repete o que
 * falhou —, a campanha não sai duas vezes. Receber a mesma promoção duas vezes
 * é o empurrão que falta para a pessoa desligar as notificações de vez.
 */
export async function dispararCampanha(campaignId: string): Promise<void> {
  const campanha = await prisma.notificationCampaign.findUnique({ where: { id: campaignId } });

  if (!campanha) {
    logger.warn({ campaignId }, '[campanha] não encontrada');
    return;
  }

  if (campanha.sentAt) {
    logger.info({ campaignId }, '[campanha] já enviada, ignorando repetição');
    return;
  }

  const segmento = campanha.segment as unknown as NotificationSegment;
  const where = filtroDoSegmento(segmento);

  // Em lotes porque a lista inteira em memória cresce com a base, e o processo
  // tem teto de 768 MB no compose.
  const TAMANHO_DO_LOTE = 500;
  let cursor: string | undefined;
  let enfileirados = 0;

  for (;;) {
    const usuarios = await prisma.user.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: TAMANHO_DO_LOTE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (usuarios.length === 0) break;

    for (const usuario of usuarios) {
      await enfileirarNotificacao({
        userId: usuario.id,
        title: campanha.title,
        body: campanha.body,
        ...(campanha.linkUrl ? { url: campanha.linkUrl } : {}),
        canais: ['PUSH'],
        entity: { type: 'NotificationCampaign', id: campanha.id },
        // A tag agrupa: se duas campanhas chegarem juntas, a segunda substitui
        // a primeira na bandeja em vez de empilhar.
        tag: `campanha-${campanha.id}`,
      });
    }

    enfileirados += usuarios.length;
    cursor = usuarios[usuarios.length - 1]?.id;

    if (usuarios.length < TAMANHO_DO_LOTE) break;
  }

  await prisma.notificationCampaign.update({
    where: { id: campanha.id },
    data: { sentAt: new Date(), recipientCount: enfileirados },
  });

  logger.info({ campaignId, enfileirados }, '[campanha] despachada');
}
