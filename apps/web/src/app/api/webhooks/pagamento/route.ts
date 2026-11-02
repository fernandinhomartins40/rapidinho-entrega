import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@rapidinho/database';
import {
  agendarLembreteDaLoja,
  capturarErro,
  getPaymentGateway,
  logger,
  publishRealtimeMany,
} from '@rapidinho/services';
import { REALTIME_CHANNELS, REALTIME_EVENTS } from '@rapidinho/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confirmação de pagamento vinda do gateway.
 *
 * Três garantias, nesta ordem:
 *
 * 1. A assinatura é conferida ANTES de qualquer coisa. Um webhook sem
 *    assinatura válida marcaria pedidos como pagos de graça — este endpoint é
 *    público por natureza.
 * 2. O evento é gravado com chave de deduplicação. Gateway reenvia o mesmo
 *    aviso várias vezes por desenho; processar duas vezes liberaria o pedido
 *    em duplicidade.
 * 3. A resposta é 200 mesmo quando o evento é ignorado. Devolver erro faz o
 *    provedor reenviar em laço, e o que queremos dizer é "recebi, já tratei".
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((valor, chave) => {
    headers[chave.toLowerCase()] = valor;
  });

  const gateway = getPaymentGateway();
  const evento = await gateway.parseWebhook(rawBody, headers);

  if (!evento) {
    // 401 e não 400: a assinatura não conferiu, e o provedor precisa saber
    // que o problema é de autenticação, não de formato.
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
  }

  const pagamento = await prisma.payment.findFirst({
    where: { externalId: evento.externalId },
    select: {
      id: true,
      status: true,
      orderId: true,
      order: { select: { id: true, number: true, storeId: true, status: true } },
    },
  });

  if (!pagamento) {
    // Pode ser um pagamento de outro ambiente apontando para cá. Não é erro
    // nosso, e reenviar não vai ajudar.
    logger.warn({ externalId: evento.externalId }, '[webhook] pagamento desconhecido');
    return NextResponse.json({ ok: true, ignored: 'pagamento desconhecido' });
  }

  // Evento, pagamento e pedido mudam juntos. Se a deduplicação fosse gravada
  // antes e o resto falhasse, o reenvio do gateway cairia como "duplicado" e
  // a confirmação do dinheiro se perderia para sempre.
  let pedidoLiberado = false;
  try {
    pedidoLiberado = await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          paymentId: pagamento.id,
          provider: evento.provider.toUpperCase() as 'MERCADOPAGO' | 'ASAAS' | 'FAKE',
          eventType: evento.eventType,
          dedupeKey: evento.dedupeKey,
          payload: evento.raw as object,
        },
      });

      if (pagamento.status === evento.status) return false;

      await tx.payment.update({
        where: { id: pagamento.id },
        data: {
          status: evento.status,
          paidAt: evento.status === 'PAID' ? (evento.paidAt ?? new Date()) : null,
          ...(evento.status === 'REFUNDED' ? { refundedAt: new Date() } : {}),
        },
      });

      if (evento.status !== 'PAID') return false;

      // Pedido preso em "aguardando pagamento" só anda quando o dinheiro
      // entra. Condicional: se a expiração do Pix cancelou no mesmo instante,
      // o cancelamento vale e o pedido não ressuscita.
      const liberado = await tx.order.updateMany({
        where: { id: pagamento.orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'RECEIVED' },
      });
      if (liberado.count === 0) return false;

      await tx.orderStatusHistory.create({
        data: { orderId: pagamento.orderId, status: 'RECEIVED', note: 'Pagamento confirmado' },
      });
      return true;
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      // A chave única de deduplicação recusou: este evento já foi processado.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // Qualquer outra falha devolve erro para o gateway reenviar.
    throw erro;
  }

  if (pagamento.status === evento.status) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  // É aqui que o pedido aparece na tela do lojista.
  if (pedidoLiberado) {
    await publishRealtimeMany(
      [
        REALTIME_CHANNELS.store(pagamento.order.storeId),
        REALTIME_CHANNELS.order(pagamento.orderId),
      ],
      REALTIME_EVENTS.orderCreated,
      { orderId: pagamento.orderId, number: pagamento.order.number },
    );

    // Pago é pedido novo para a loja: se ninguém aceitar, ela é lembrada.
    await agendarLembreteDaLoja({ orderId: pagamento.orderId }).catch((erro: unknown) =>
      capturarErro(erro, { origem: 'webhook-agendamento', orderId: pagamento.orderId }),
    );
  } else {
    await publishRealtimeMany(
      [REALTIME_CHANNELS.order(pagamento.orderId)],
      REALTIME_EVENTS.orderStatusChanged,
      { orderId: pagamento.orderId, paymentStatus: evento.status },
    );
  }

  return NextResponse.json({ ok: true });
}
