import { NextResponse } from 'next/server';
import { prisma } from '@rapidinho/database';
import { getPaymentGateway, publishRealtimeMany } from '@rapidinho/services';
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
    console.warn('[webhook] pagamento desconhecido', evento.externalId);
    return NextResponse.json({ ok: true, ignored: 'pagamento desconhecido' });
  }

  try {
    await prisma.paymentEvent.create({
      data: {
        paymentId: pagamento.id,
        provider: evento.provider.toUpperCase() as 'MERCADOPAGO' | 'ASAAS' | 'FAKE',
        eventType: evento.eventType,
        dedupeKey: evento.dedupeKey,
        payload: evento.raw as object,
      },
    });
  } catch {
    // A chave única de deduplicação recusou: este evento já foi processado.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (pagamento.status === evento.status) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await prisma.payment.update({
    where: { id: pagamento.id },
    data: {
      status: evento.status,
      paidAt: evento.status === 'PAID' ? (evento.paidAt ?? new Date()) : null,
      ...(evento.status === 'REFUNDED' ? { refundedAt: new Date() } : {}),
    },
  });

  // Pedido preso em "aguardando pagamento" só anda quando o dinheiro entra.
  // É aqui que ele aparece na tela do lojista.
  if (evento.status === 'PAID' && pagamento.order.status === 'PENDING_PAYMENT') {
    await prisma.$transaction([
      prisma.order.update({ where: { id: pagamento.orderId }, data: { status: 'RECEIVED' } }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: pagamento.orderId,
          status: 'RECEIVED',
          note: 'Pagamento confirmado',
        },
      }),
    ]);

    await publishRealtimeMany(
      [
        REALTIME_CHANNELS.store(pagamento.order.storeId),
        REALTIME_CHANNELS.order(pagamento.orderId),
      ],
      REALTIME_EVENTS.orderCreated,
      { orderId: pagamento.orderId, number: pagamento.order.number },
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
