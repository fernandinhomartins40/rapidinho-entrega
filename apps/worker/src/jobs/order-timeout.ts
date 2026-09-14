import { prisma } from '@rapidinho/database';
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

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: pedido.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Pagamento não confirmado no prazo',
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: pedido.id,
        status: 'CANCELLED',
        note: 'Expirado por falta de pagamento',
      },
    });

    // Devolve o cupom: ele foi contado no checkout e o pedido não aconteceu.
    if (pedido.couponId) {
      await tx.couponRedemption.deleteMany({ where: { orderId: pedido.id } });
      await tx.coupon.update({
        where: { id: pedido.couponId },
        data: { usageCount: { decrement: 1 } },
      });
    }
  });

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
