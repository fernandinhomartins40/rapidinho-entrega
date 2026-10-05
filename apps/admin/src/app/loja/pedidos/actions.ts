'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { desfazerReservasDoPedido, prisma } from '@rapidinho/database';
import { logger, notificarUsuario, publishRealtimeMany } from '@rapidinho/services';
import {
  avisoDeStatusAoCliente,
  canTransition,
  cancelOrderSchema,
  cuidSchema,
  inicioDoDia,
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
        pickedAt: true,
        delivery: { select: { id: true, status: true, courierId: true } },
        items: { select: { weightGrams: true, pickStatus: true } },
      },
    });

    if (!pedido) {
      return { result: { ok: false, message: 'Pedido não encontrado nesta loja.' } };
    }

    // Pesagem justa: item por quilo só sai depois de pesado — é o peso que
    // fecha o valor que o cliente paga. Separação começada também precisa
    // ser concluída, ou o que a loja marcou (falta, troca) não vale.
    if (
      dados.status === 'READY' &&
      pedido.pickedAt == null &&
      pedido.items.some((item) => item.weightGrams != null || item.pickStatus != null)
    ) {
      return {
        result: {
          ok: false,
          message: 'Conclua a separação (pesagem) antes de marcar como pronto.',
        },
      };
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

    const corrida = pedido.delivery;
    const motoboyComACorrida =
      corrida?.courierId != null &&
      (corrida.status === 'ASSIGNED' || corrida.status === 'ACCEPTED');

    // Com motoboy da plataforma a caminho, quem marca a saída é ele, ao
    // retirar: a loja marcando antes deixava pedido e corrida contando
    // histórias diferentes.
    if (dados.status === 'OUT_FOR_DELIVERY' && motoboyComACorrida) {
      return {
        result: {
          ok: false,
          message: 'O entregador marca a saída quando retirar o pedido.',
        },
      };
    }

    const sincronizarCorrida = corridaAposStatus(corrida, dados.status);

    await prisma.$transaction([
      ...sincronizarCorrida,
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

    if (sincronizarCorrida.length > 0 && corrida?.courierId) {
      await publishRealtimeMany(
        [REALTIME_CHANNELS.courier(corrida.courierId)],
        REALTIME_EVENTS.deliveryStatusChanged,
        { deliveryId: corrida.id, orderId: pedido.id },
      );
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
        ...avisoDeStatusAoCliente(pedido.id, dados.status),
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

/**
 * A corrida acompanha o pedido quando é a loja que o encerra.
 *
 * - Loja despachou com motoboy próprio e ninguém tinha aceitado a corrida:
 *   ela sai da fila, ou um entregador da cidade iria buscar um pedido que já
 *   saiu.
 * - Loja marcou "Entregue": se o motoboy da plataforma já tinha retirado, a
 *   entrega é dele e conta para ele; se ainda não tinha retirado (ou ninguém
 *   aceitou), a loja entregou por conta própria e a corrida é cancelada.
 */
function corridaAposStatus(
  corrida: { id: string; status: string; courierId: string | null } | null,
  status: OrderStatus,
) {
  if (!corrida || corrida.status === 'DELIVERED' || corrida.status === 'CANCELLED') return [];
  const agora = new Date();

  if (status === 'OUT_FOR_DELIVERY' && corrida.status === 'PENDING') {
    return [
      prisma.delivery.update({
        where: { id: corrida.id },
        data: { status: 'CANCELLED', cancelledAt: agora },
      }),
    ];
  }

  if (status === 'DELIVERED') {
    if (corrida.status === 'PICKED_UP' && corrida.courierId) {
      return [
        prisma.delivery.update({
          where: { id: corrida.id },
          data: { status: 'DELIVERED', deliveredAt: agora },
        }),
        prisma.courier.update({
          where: { id: corrida.courierId },
          data: { deliveryCount: { increment: 1 } },
        }),
      ];
    }
    return [
      prisma.delivery.update({
        where: { id: corrida.id },
        data: { status: 'CANCELLED', cancelledAt: agora },
      }),
    ];
  }

  return [];
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

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: pedido.id },
        data: {
          status: destino,
          cancelledAt: new Date(),
          cancelReason: dados.reason,
          cancelledBy: access.user.id,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: pedido.id,
          status: destino,
          note: dados.reason,
          changedById: access.user.id,
        },
      });
      // Estoque de volta à prateleira, corrida do entregador cancelada e
      // cupom devolvido ao cliente.
      await desfazerReservasDoPedido(tx, pedido.id);
    });

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

const pausarProdutosSchema = z
  .object({
    orderId: cuidSchema,
    itemIds: z.array(cuidSchema).max(100).default([]),
    /** Sabores de pizza do pedido (linhas de OrderItemPizzaFlavor). */
    saborIds: z.array(cuidSchema).max(100).default([]),
  })
  .refine((dados) => dados.itemIds.length + dados.saborIds.length > 0, {
    message: 'Escolha o que acabou.',
  });

/**
 * Tira do cardápio, até amanhã, o que acabou neste pedido.
 *
 * A loja descobre que algo acabou justamente ao recusar ("Produto esgotado")
 * ou ao separar (item em falta). Sem isto o produto continuava à venda e o
 * próximo cliente pedia a mesma coisa. Produtos e sabores vêm das linhas do
 * pedido — filtradas pela loja do vínculo — e não de ids soltos do navegador.
 * A pausa volta sozinha à meia-noite, como a pausa com prazo da tela de
 * produtos. Pizza não tem produto: o que acaba é o sabor.
 */
export async function pausarProdutosDoPedido(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = pausarProdutosSchema.parse(entrada);
    const doPedido = { id: dados.orderId, storeId: access.storeId };
    const amanha = inicioDoDia(new Date(), -1);

    const [itens, linhasDeSabor] = await Promise.all([
      dados.itemIds.length
        ? prisma.orderItem.findMany({
            where: { id: { in: dados.itemIds }, order: doPedido, productId: { not: null } },
            select: { productId: true },
          })
        : [],
      dados.saborIds.length
        ? prisma.orderItemPizzaFlavor.findMany({
            where: {
              id: { in: dados.saborIds },
              orderItem: { order: doPedido },
              flavorId: { not: null },
            },
            select: { flavorId: true },
          })
        : [],
    ]);
    const produtoIds = [...new Set(itens.map((item) => item.productId as string))];
    const saborIds = [...new Set(linhasDeSabor.map((linha) => linha.flavorId as string))];

    if (produtoIds.length + saborIds.length === 0) {
      return { result: { ok: false, message: 'Nada deste pedido para pausar.' } };
    }

    const [produtos, sabores] = await prisma.$transaction([
      prisma.product.updateMany({
        where: { id: { in: produtoIds }, storeId: access.storeId, deletedAt: null },
        data: { pausedUntil: amanha },
      }),
      prisma.pizzaFlavor.updateMany({
        where: { id: { in: saborIds }, storeId: access.storeId, isAvailable: true },
        data: { pausedUntil: amanha },
      }),
    ]);

    revalidatePath('/loja/produtos');
    revalidatePath('/loja/pizzas');
    revalidatePath('/loja');

    const total = produtos.count + sabores.count;

    return {
      result: {
        ok: true,
        message:
          total === 1
            ? `${sabores.count === 1 ? 'Sabor' : 'Produto'} fora do cardápio até amanhã.`
            : `${total} itens fora do cardápio até amanhã.`,
      },
      audit: {
        action: 'product.paused_from_order',
        entityType: 'Order',
        entityId: dados.orderId,
        after: { produtoIds, saborIds },
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
    logger.info({ err: error, orderId }, '[pedidos] corrida já existia');
  }
}
