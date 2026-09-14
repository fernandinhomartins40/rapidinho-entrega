'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { publishRealtimeMany } from '@rapidinho/services';
import { AuthorizationError, requireCourier } from '@rapidinho/auth';
import { REALTIME_CHANNELS, REALTIME_EVENTS } from '@rapidinho/shared';
import type { ActionResult } from '@/lib/action-state';

/**
 * Ações do entregador.
 *
 * Toda query filtra pelo entregador logado (`requireCourier`), nunca por um id
 * vindo do formulário: sem isso um entregador aceitaria a corrida de outro
 * trocando o id no navegador.
 */

async function comEntregador(
  handler: (courierId: string, userId: string) => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    const { courierId, user } = await requireCourier();
    return await handler(courierId, user.id);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }

    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;

    console.error('[entregador] falha', error);
    return { ok: false, message: 'Não foi possível concluir. Tente de novo.' };
  }
}

const idSchema = z.object({ deliveryId: z.string().min(1) });

/**
 * Aceita uma corrida.
 *
 * O `updateMany` com `courierId: null` no filtro é o que evita dois
 * entregadores pegarem a mesma entrega: quem chegar depois atualiza zero
 * linhas e recebe o aviso, em vez de sobrescrever o primeiro.
 */
export async function aceitarCorrida(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const { deliveryId } = idSchema.parse(entrada);

    const entrega = await prisma.delivery.findFirst({
      where: { id: deliveryId, status: 'PENDING', courierId: null },
      select: { id: true, orderId: true, order: { select: { storeId: true, number: true } } },
    });

    if (!entrega) {
      return { ok: false, message: 'Essa corrida já foi aceita por outro entregador.' };
    }

    const { count } = await prisma.delivery.updateMany({
      where: { id: entrega.id, courierId: null, status: 'PENDING' },
      data: { courierId, status: 'ACCEPTED', assignedAt: new Date(), acceptedAt: new Date() },
    });

    if (count === 0) {
      return { ok: false, message: 'Essa corrida já foi aceita por outro entregador.' };
    }

    await publishRealtimeMany(
      [
        REALTIME_CHANNELS.store(entrega.order.storeId),
        REALTIME_CHANNELS.order(entrega.orderId),
        REALTIME_CHANNELS.courier(courierId),
      ],
      REALTIME_EVENTS.deliveryAssigned,
      { deliveryId: entrega.id, orderId: entrega.orderId, number: entrega.order.number },
    );

    revalidatePath('/entregador');
    return { ok: true, message: `Corrida do pedido #${entrega.order.number} é sua.` };
  });
}

const avancoSchema = z.object({
  deliveryId: z.string().min(1),
  status: z.enum(['PICKED_UP', 'DELIVERED']),
});

/** Avança a corrida e sincroniza o status do pedido. */
export async function avancarCorrida(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const dados = avancoSchema.parse(entrada);

    const entrega = await prisma.delivery.findFirst({
      where: { id: dados.deliveryId, courierId },
      select: {
        id: true,
        status: true,
        orderId: true,
        order: { select: { storeId: true, number: true, status: true } },
      },
    });

    if (!entrega) return { ok: false, message: 'Corrida não encontrada.' };

    const permitido: Record<string, string[]> = {
      ACCEPTED: ['PICKED_UP'],
      PICKED_UP: ['DELIVERED'],
    };

    if (!permitido[entrega.status]?.includes(dados.status)) {
      return { ok: false, message: 'Essa mudança não é possível agora.' };
    }

    const agora = new Date();
    // O status do pedido acompanha o da entrega: o cliente olha o pedido, não
    // a corrida, e os dois não podem contar histórias diferentes.
    const statusDoPedido = dados.status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : 'DELIVERED';

    await prisma.$transaction([
      prisma.delivery.update({
        where: { id: entrega.id },
        data: {
          status: dados.status,
          ...(dados.status === 'PICKED_UP' ? { pickedUpAt: agora } : { deliveredAt: agora }),
        },
      }),
      prisma.order.update({
        where: { id: entrega.orderId },
        data: {
          status: statusDoPedido,
          ...(dados.status === 'PICKED_UP' ? { dispatchedAt: agora } : { deliveredAt: agora }),
        },
      }),
      prisma.orderStatusHistory.create({
        data: { orderId: entrega.orderId, status: statusDoPedido },
      }),
      ...(dados.status === 'DELIVERED'
        ? [
            prisma.courier.update({
              where: { id: courierId },
              data: { deliveryCount: { increment: 1 } },
            }),
          ]
        : []),
    ]);

    await publishRealtimeMany(
      [
        REALTIME_CHANNELS.store(entrega.order.storeId),
        REALTIME_CHANNELS.order(entrega.orderId),
        REALTIME_CHANNELS.courier(courierId),
      ],
      REALTIME_EVENTS.deliveryStatusChanged,
      { deliveryId: entrega.id, orderId: entrega.orderId, status: dados.status },
    );

    revalidatePath('/entregador');
    return {
      ok: true,
      message:
        dados.status === 'PICKED_UP'
          ? 'Pedido retirado. Boa entrega!'
          : `Pedido #${entrega.order.number} entregue.`,
    };
  });
}

const disponibilidadeSchema = z.object({ online: z.boolean() });

export async function alterarDisponibilidade(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const { online } = disponibilidadeSchema.parse(entrada);

    await prisma.courier.update({
      where: { id: courierId },
      data: { isOnline: online, lastSeenAt: new Date() },
    });

    revalidatePath('/entregador');
    return { ok: true, message: online ? 'Você está online.' : 'Você está offline.' };
  });
}

const localizacaoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Posição do entregador, para a loja e o cliente acompanharem. */
export async function atualizarLocalizacao(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const dados = localizacaoSchema.parse(entrada);

    await prisma.courier.update({
      where: { id: courierId },
      data: { latitude: dados.latitude, longitude: dados.longitude, lastSeenAt: new Date() },
    });

    // Sem revalidatePath: isto roda a cada poucos segundos e recarregar a
    // página toda vez seria pior que não ter localização.
    await publishRealtimeMany(
      [REALTIME_CHANNELS.courier(courierId)],
      REALTIME_EVENTS.courierLocation,
      dados,
    );

    return { ok: true };
  });
}
