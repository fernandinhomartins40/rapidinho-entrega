'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
import { notificarUsuario, publishRealtimeMany } from '@rapidinho/services';
import {
  canTransition,
  cancelOrderSchema,
  ORDER_STATUS_CUSTOMER_MESSAGE,
  ORDER_STATUS_LABEL,
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  updateOrderStatusSchema,
  type OrderStatus,
} from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

/**
 * Ações da tela de pedidos.
 *
 * Toda mudança de status passa por aqui e faz três coisas juntas: grava o
 * pedido, registra a linha do histórico e avisa quem está ouvindo. Fazer isso
 * em lugares diferentes é como o histórico de um pedido acaba divergindo do
 * status dele.
 */

/** Canais avisados a cada mudança: o lojista, o cliente e o entregador. */
function canaisDoPedido(pedido: {
  id: string;
  storeId: string;
  delivery: { courierId: string | null } | null;
}): string[] {
  const canais = [REALTIME_CHANNELS.store(pedido.storeId), REALTIME_CHANNELS.order(pedido.id)];

  if (pedido.delivery?.courierId) {
    canais.push(REALTIME_CHANNELS.courier(pedido.delivery.courierId));
  }

  return canais;
}

/** Marca de tempo própria de cada status, para os relatórios de tempo médio. */
function carimboDoStatus(status: OrderStatus): Record<string, Date> {
  const agora = new Date();

  switch (status) {
    case 'ACCEPTED':
      return { acceptedAt: agora };
    case 'PREPARING':
      return { preparingAt: agora };
    case 'READY':
      return { readyAt: agora };
    case 'OUT_FOR_DELIVERY':
      return { dispatchedAt: agora };
    case 'DELIVERED':
      return { deliveredAt: agora };
    case 'CANCELLED':
    case 'REJECTED':
      return { cancelledAt: agora };
    default:
      return {};
  }
}

export async function mudarStatusDoPedido(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = updateOrderStatusSchema.parse(entrada);

    // O pedido é buscado JÁ filtrado pela loja do vínculo: um orderId de outra
    // loja simplesmente não é encontrado, em vez de ser encontrado e recusado
    // depois.
    const pedido = await prisma.order.findFirst({
      where: { id: dados.orderId, storeId: access.storeId },
      select: {
        id: true,
        number: true,
        status: true,
        storeId: true,
        userId: true,
        type: true,
        delivery: { select: { courierId: true } },
      },
    });

    if (!pedido) {
      return { result: { ok: false, message: 'Pedido não encontrado nesta loja.' } };
    }

    const atual = pedido.status as OrderStatus;

    if (atual === dados.status) {
      // Dedo duplo no botão não é erro: a intenção do lojista já foi atendida.
      return { result: { ok: true, message: 'O pedido já estava nesse status.' } };
    }

    if (!canTransition(atual, dados.status)) {
      return {
        result: {
          ok: false,
          message: `Não dá para ir de "${ORDER_STATUS_LABEL[atual]}" para "${ORDER_STATUS_LABEL[dados.status]}".`,
        },
      };
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: pedido.id },
        data: {
          status: dados.status,
          ...carimboDoStatus(dados.status),
          ...(dados.prepMinutes != null
            ? {
                estimatedPrepMinutes: dados.prepMinutes,
                estimatedReadyAt: new Date(Date.now() + dados.prepMinutes * 60_000),
              }
            : {}),
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: pedido.id,
          status: dados.status,
          note: dados.note ?? null,
          changedById: access.user.id,
        },
      }),
    ]);

    // A corrida entra na fila quando o pedido fica pronto, não antes: corrida
    // aberta cedo demais faz o entregador chegar e esperar na loja.
    if (dados.status === 'READY') {
      await abrirCorrida(pedido.id, access.storeId);
    }

    await publishRealtimeMany(canaisDoPedido(pedido), REALTIME_EVENTS.orderStatusChanged, {
      orderId: pedido.id,
      number: pedido.number,
      status: dados.status,
      estimatedPrepMinutes: dados.prepMinutes ?? null,
    });

    if (pedido.userId) {
      await notificarUsuario({
        userId: pedido.userId,
        title: `Pedido #${pedido.number}`,
        body: ORDER_STATUS_CUSTOMER_MESSAGE[dados.status],
        url: `/pedidos/${pedido.id}`,
        // Push E WhatsApp juntos, não um como reserva do outro: quem não
        // instalou o PWA — a maioria, no começo — não recebe push, e esperar
        // o push falhar atrasaria o aviso justamente em quem mais precisa.
        canais: ['PUSH', 'WHATSAPP'],
        entity: { type: 'Order', id: pedido.id },
        // Mesma tag: a mudança nova substitui a anterior em vez de empilhar
        // quatro notificações do mesmo pedido na tela.
        tag: `pedido-${pedido.id}`,
      });
    }

    revalidatePath('/loja/pedidos');
    revalidatePath('/loja');

    return {
      result: {
        ok: true,
        message: `Pedido #${pedido.number}: ${ORDER_STATUS_LABEL[dados.status]}.`,
      },
      audit: {
        action: 'order.status_changed',
        entityType: 'Order',
        entityId: pedido.id,
        before: { status: atual },
        after: { status: dados.status },
      },
    };
  });
}

/** Recusa/cancelamento pela loja. Exige motivo — o cliente vai lê-lo. */
export async function cancelarPedido(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = cancelOrderSchema.parse(entrada);

    const pedido = await prisma.order.findFirst({
      where: { id: dados.orderId, storeId: access.storeId },
      select: {
        id: true,
        number: true,
        status: true,
        storeId: true,
        userId: true,
        delivery: { select: { courierId: true } },
      },
    });

    if (!pedido) {
      return { result: { ok: false, message: 'Pedido não encontrado nesta loja.' } };
    }

    const atual = pedido.status as OrderStatus;
    // Antes de aceitar, a loja recusa; depois de aceito, cancela. São eventos
    // diferentes para o cliente e para o relatório.
    const destino: OrderStatus = atual === 'RECEIVED' ? 'REJECTED' : 'CANCELLED';

    if (!canTransition(atual, destino)) {
      return {
        result: {
          ok: false,
          message: `Um pedido "${ORDER_STATUS_LABEL[atual]}" não pode mais ser cancelado pela loja.`,
        },
      };
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: pedido.id },
        data: {
          status: destino,
          cancelledAt: new Date(),
          cancelReason: dados.reason,
          cancelledBy: access.user.id,
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: pedido.id,
          status: destino,
          note: dados.reason,
          changedById: access.user.id,
        },
      }),
    ]);

    await publishRealtimeMany(canaisDoPedido(pedido), REALTIME_EVENTS.orderCancelled, {
      orderId: pedido.id,
      number: pedido.number,
      status: destino,
      reason: dados.reason,
    });

    if (pedido.userId) {
      await notificarUsuario({
        userId: pedido.userId,
        title: `Pedido #${pedido.number} ${destino === 'REJECTED' ? 'recusado' : 'cancelado'}`,
        body: dados.reason,
        url: `/pedidos/${pedido.id}`,
        canais: ['PUSH', 'WHATSAPP'],
        entity: { type: 'Order', id: pedido.id },
        tag: `pedido-${pedido.id}`,
      });
    }

    revalidatePath('/loja/pedidos');
    revalidatePath('/loja');

    return {
      result: {
        ok: true,
        message: `Pedido #${pedido.number} ${destino === 'REJECTED' ? 'recusado' : 'cancelado'}.`,
      },
      audit: {
        action: destino === 'REJECTED' ? 'order.rejected' : 'order.cancelled',
        entityType: 'Order',
        entityId: pedido.id,
        before: { status: atual },
        after: { status: destino, reason: dados.reason },
      },
    };
  });
}

/** Aceite com tempo de preparo, que é o caminho normal do botão grande. */
export async function aceitarPedido(orderId: string, prepMinutes: number): Promise<ActionResult> {
  return mudarStatusDoPedido({ orderId, status: 'ACCEPTED', prepMinutes });
}

/**
 * Coloca a entrega na fila dos entregadores.
 *
 * O que o entregador ganha sai da taxa de entrega do pedido, e não de uma
 * tabela à parte: é o valor que o cliente já pagou por aquela distância, e
 * qualquer outra conta criaria diferença entre o que entra e o que sai.
 *
 * Pedido para retirada não gera corrida, e a operação é idempotente — chamar
 * duas vezes não cria duas entregas, porque `orderId` é único.
 */
async function abrirCorrida(orderId: string, storeId: string): Promise<void> {
  const pedido = await prisma.order.findFirst({
    where: { id: orderId, storeId, type: 'DELIVERY' },
    select: { id: true, deliveryFeeCents: true, delivery: { select: { id: true } } },
  });

  if (!pedido || pedido.delivery) return;

  try {
    await prisma.delivery.create({
      data: {
        orderId: pedido.id,
        status: 'PENDING',
        earningCents: pedido.deliveryFeeCents,
      },
    });
  } catch (error) {
    // Índice único recusou: outra chamada simultânea já criou a corrida.
    console.warn('[pedidos] corrida já existia', { orderId, error });
  }
}
