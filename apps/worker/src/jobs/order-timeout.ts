import { desfazerReservasDoPedido, prisma } from '@rapidinho/database';
import { publishRealtimeMany, notificarUsuario } from '@rapidinho/services';
import { REALTIME_CHANNELS, REALTIME_EVENTS } from '@rapidinho/shared';

/**
 * Cancela pedido que ficou sem pagamento.
 *
 * Sem isto, um Pix abandonado deixa o pedido preso em PENDING_PAYMENT para
 * sempre — e junto com ele o cupom resgatado, que não volta para o cliente nem
 * libera o limite de uso.
 */
export async function expirarPedido(orderId: string): Promise<void> {
  const pedido = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      storeId: true,
      userId: true,
      couponId: true,
      payment: { select: { status: true } },
    },
  });

  if (!pedido) return;

  // O pagamento pode ter caído entre o agendamento e agora: nesse caso não há
  // nada a expirar.
  if (pedido.status !== 'PENDING_PAYMENT' || pedido.payment?.status === 'PAID') {
    return;
  }

  const cancelado = await prisma.$transaction(async (tx) => {
    // Condicional: se o webhook confirmou o pagamento entre a leitura acima e
    // agora, o pedido já saiu de PENDING_PAYMENT e não é cancelado.
    const { count } = await tx.order.updateMany({
      where: {
        id: pedido.id,
        status: 'PENDING_PAYMENT',
        NOT: { payment: { is: { status: 'PAID' } } },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Pagamento não confirmado no prazo',
      },
    });
    if (count === 0) return false;

    await tx.orderStatusHistory.create({
      data: {
        orderId: pedido.id,
        status: 'CANCELLED',
        note: 'Expirado por falta de pagamento',
      },
    });

    // Devolve estoque, corrida e cupom: o pedido não aconteceu.
    await desfazerReservasDoPedido(tx, pedido.id);
    return true;
  });

  if (!cancelado) return;

  await publishRealtimeMany(
    [REALTIME_CHANNELS.order(pedido.id), REALTIME_CHANNELS.store(pedido.storeId)],
    REALTIME_EVENTS.orderCancelled,
    { orderId: pedido.id, number: pedido.number, reason: 'Pagamento não confirmado' },
  );

  if (pedido.userId) {
    await notificarUsuario({
      userId: pedido.userId,
      title: `Pedido #${pedido.number} cancelado`,
      body: 'O pagamento não foi confirmado no prazo. Você pode fazer o pedido de novo.',
      url: `/pedidos/${pedido.id}`,
      canais: ['PUSH', 'WHATSAPP'],
      entity: { type: 'Order', id: pedido.id },
    });
  }
}
