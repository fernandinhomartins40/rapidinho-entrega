'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, desfazerReservasDoPedido, prisma } from '@rapidinho/database';
import { notificarUsuario, publishRealtimeMany } from '@rapidinho/services';
import {
  cancelOrderSchema,
  canTransition,
  ORDER_STATUS_LABEL,
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  type OrderStatus,
} from '@rapidinho/shared';
import { runAdminAction, type ActionResult } from '@/lib/admin-action';

/**
 * Cancelamento feito pela plataforma.
 *
 * Para quando a loja some: pedido parado há uma hora, cliente reclamando e
 * ninguém atendendo. Segue a mesma máquina de estados e os mesmos avisos do
 * cancelamento pela loja — o cliente, a loja e o entregador ficam sabendo —,
 * e o motivo vai para o histórico e para a auditoria.
 */
export async function cancelarPedidoPelaPlataforma(
  _estado: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (user) => {
    const dados = cancelOrderSchema.parse({
      orderId: String(formData.get('orderId') ?? ''),
      reason: String(formData.get('reason') ?? '').trim(),
    });

    const pedido = await prisma.order.findUnique({
      where: { id: dados.orderId },
      select: {
        id: true,
        number: true,
        status: true,
        storeId: true,
        userId: true,
        delivery: { select: { courierId: true } },
      },
    });

    if (!pedido) return { result: { ok: false, message: 'Pedido não encontrado.' } };

    const atual = pedido.status as OrderStatus;
    if (!canTransition(atual, 'CANCELLED')) {
      return {
        result: {
          ok: false,
          message: `Um pedido "${ORDER_STATUS_LABEL[atual]}" não pode mais ser cancelado.`,
        },
      };
    }

    const motivo = `Cancelado pela plataforma: ${dados.reason}`;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: pedido.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: motivo,
          cancelledBy: user.id,
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: pedido.id, status: 'CANCELLED', note: motivo, changedById: user.id },
      });
      // Entrega em curso, estoque e cupom voltam junto com o pedido.
      await desfazerReservasDoPedido(tx, pedido.id);
    });

    const canais = [REALTIME_CHANNELS.store(pedido.storeId), REALTIME_CHANNELS.order(pedido.id)];
    if (pedido.delivery?.courierId)
      canais.push(REALTIME_CHANNELS.courier(pedido.delivery.courierId));

    await publishRealtimeMany(canais, REALTIME_EVENTS.orderCancelled, {
      orderId: pedido.id,
      number: pedido.number,
      status: 'CANCELLED',
      reason: motivo,
    });

    if (pedido.userId) {
      await notificarUsuario({
        userId: pedido.userId,
        title: `Pedido #${pedido.number} cancelado`,
        body: dados.reason,
        url: `/pedidos/${pedido.id}`,
        canais: ['PUSH', 'WHATSAPP'],
        entity: { type: 'Order', id: pedido.id },
        tag: `pedido-${pedido.id}`,
      });
    }

    revalidatePath('/admin/pedidos');
    revalidatePath(`/admin/pedidos/${pedido.id}`);

    return {
      result: { ok: true, message: `Pedido #${pedido.number} cancelado.` },
      audit: {
        action: AUDIT_ACTIONS.orderCancelledByPlatform,
        entityType: 'Order',
        entityId: pedido.id,
        before: { status: atual },
        after: { status: 'CANCELLED', reason: dados.reason },
      },
    };
  });
}
