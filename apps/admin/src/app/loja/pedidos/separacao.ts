'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import {
  getPaymentGateway,
  logger,
  notificarUsuario,
  publishRealtimeMany,
} from '@rapidinho/services';
import {
  cuidSchema,
  fecharContaDaSeparacao,
  formatCents,
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
} from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

/**
 * Separação do pedido — a "pesagem justa".
 *
 * A loja confere item por item: pesa o que é por quilo, marca o que faltou,
 * troca por similar ou pergunta ao cliente pelo app. Cada toque avisa o
 * cliente em tempo real; ao concluir, a conta fecha com a regra de
 * `fecharContaDaSeparacao` (a mesma que a tela mostra como prévia), o
 * pagamento é ajustado e o cliente recebe o total final.
 */

/** Status em que a separação pode acontecer: aceito e em preparo. */
const PODE_SEPARAR = ['ACCEPTED', 'PREPARING'] as const;

const itemSchema = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('PICKED'),
    orderId: cuidSchema,
    itemId: cuidSchema,
    pesoGramas: z.number().int().min(1).max(50_000).optional(),
  }),
  z.object({ acao: z.literal('MISSING'), orderId: cuidSchema, itemId: cuidSchema }),
  z.object({ acao: z.literal('RESET'), orderId: cuidSchema, itemId: cuidSchema }),
  z.object({
    acao: z.enum(['REPLACED', 'ASK']),
    orderId: cuidSchema,
    itemId: cuidSchema,
    trocaNome: z.string().trim().min(2).max(120),
    trocaPrecoCents: z.number().int().min(1).max(10_000_000),
  }),
]);

function canaisDoPedido(pedido: { id: string; storeId: string }): string[] {
  return [REALTIME_CHANNELS.store(pedido.storeId), REALTIME_CHANNELS.order(pedido.id)];
}

export async function registrarItemDaSeparacao(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = itemSchema.parse(entrada);

    const item = await prisma.orderItem.findFirst({
      where: { id: dados.itemId, order: { id: dados.orderId, storeId: access.storeId } },
      select: {
        id: true,
        productName: true,
        weightGrams: true,
        totalCents: true,
        order: {
          select: {
            id: true,
            number: true,
            storeId: true,
            userId: true,
            status: true,
            pickedAt: true,
            substitutionPolicy: true,
          },
        },
      },
    });

    if (!item) return { result: { ok: false, message: 'Item não encontrado neste pedido.' } };
    const pedido = item.order;

    if (!PODE_SEPARAR.includes(pedido.status as (typeof PODE_SEPARAR)[number])) {
      return { result: { ok: false, message: 'A separação é feita com o pedido aceito.' } };
    }
    if (pedido.pickedAt) {
      return { result: { ok: false, message: 'A separação deste pedido já foi concluída.' } };
    }

    // O cliente escolheu "pode tirar o item": trocar sem perguntar iria
    // contra o que ele pediu.
    if (
      (dados.acao === 'REPLACED' || dados.acao === 'ASK') &&
      pedido.substitutionPolicy === 'REMOVE_ITEM'
    ) {
      return {
        result: { ok: false, message: 'O cliente pediu para tirar o item que faltar, sem troca.' },
      };
    }
    if (dados.acao === 'REPLACED' && pedido.substitutionPolicy === 'CONTACT_ME') {
      return {
        result: { ok: false, message: 'O cliente pediu para ser consultado: pergunte pelo app.' },
      };
    }
    if (dados.acao === 'PICKED' && item.weightGrams != null && dados.pesoGramas == null) {
      return { result: { ok: false, message: 'Informe o peso da balança.' } };
    }

    const limpo = {
      pickedWeightGrams: null,
      replacementName: null,
      replacementPriceCents: null,
      replacementAccepted: null,
      questionAskedAt: null,
    };

    const data =
      dados.acao === 'PICKED'
        ? {
            ...limpo,
            pickStatus: 'PICKED' as const,
            pickedWeightGrams: item.weightGrams != null ? (dados.pesoGramas ?? null) : null,
          }
        : dados.acao === 'MISSING'
          ? { ...limpo, pickStatus: 'MISSING' as const }
          : dados.acao === 'RESET'
            ? { ...limpo, pickStatus: null }
            : {
                ...limpo,
                pickStatus:
                  dados.acao === 'ASK' ? ('AWAITING_CUSTOMER' as const) : ('REPLACED' as const),
                replacementName: dados.trocaNome,
                replacementPriceCents: dados.trocaPrecoCents,
                questionAskedAt: dados.acao === 'ASK' ? new Date() : null,
              };

    await prisma.orderItem.update({ where: { id: item.id }, data });

    await publishRealtimeMany(canaisDoPedido(pedido), REALTIME_EVENTS.orderUpdated, {
      orderId: pedido.id,
      itemId: item.id,
    });

    // Pergunta de troca: o cliente precisa ver agora, não quando abrir o app.
    if (dados.acao === 'ASK' && pedido.userId) {
      await notificarUsuario({
        userId: pedido.userId,
        title: `Pedido #${pedido.number}: faltou um item`,
        body: `Faltou ${item.productName}. A loja sugere ${dados.trocaNome} por ${formatCents(dados.trocaPrecoCents)}. Responda no app.`,
        url: `/pedidos/${pedido.id}`,
        canais: ['PUSH', 'WHATSAPP'],
        entity: { type: 'Order', id: pedido.id },
        tag: `troca-${item.id}`,
      });
    }

    revalidatePath('/loja/pedidos');
    return { result: { ok: true } };
  });
}

export async function concluirSeparacao(orderId: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const id = cuidSchema.parse(orderId);

    const pedido = await prisma.order.findFirst({
      where: { id, storeId: access.storeId },
      select: {
        id: true,
        number: true,
        storeId: true,
        userId: true,
        status: true,
        pickedAt: true,
        subtotalCents: true,
        deliveryFeeCents: true,
        surchargeCents: true,
        discountCents: true,
        totalCents: true,
        commissionRate: true,
        payment: {
          select: {
            id: true,
            method: true,
            status: true,
            provider: true,
            amountCents: true,
            refundedCents: true,
            externalId: true,
            changeForCents: true,
          },
        },
        items: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            productName: true,
            totalCents: true,
            unitPriceCents: true,
            quantity: true,
            weightGrams: true,
            pickStatus: true,
            pickedWeightGrams: true,
            replacementPriceCents: true,
            replacementAccepted: true,
          },
        },
      },
    });

    if (!pedido) return { result: { ok: false, message: 'Pedido não encontrado nesta loja.' } };
    if (pedido.pickedAt) {
      return { result: { ok: true, message: 'A separação já estava concluída.' } };
    }
    if (!PODE_SEPARAR.includes(pedido.status as (typeof PODE_SEPARAR)[number])) {
      return { result: { ok: false, message: 'A separação é feita com o pedido aceito.' } };
    }

    const pendentes = pedido.items.filter((item) => item.pickStatus == null);
    if (pendentes.length > 0) {
      return {
        result: {
          ok: false,
          message: `Falta conferir: ${pendentes.map((item) => item.productName).join(', ')}.`,
        },
      };
    }
    if (pedido.items.some((item) => item.pickStatus === 'AWAITING_CUSTOMER')) {
      return {
        result: {
          ok: false,
          message: 'Há troca esperando o cliente. Aguarde a resposta ou decida pelo item.',
        },
      };
    }
    if (pedido.items.every((item) => item.pickStatus === 'MISSING')) {
      return {
        result: { ok: false, message: 'Todos os itens faltaram: cancele o pedido com o motivo.' },
      };
    }

    const pagamento = pedido.payment;
    const pagoOnline =
      pagamento &&
      pagamento.status === 'PAID' &&
      pagamento.provider !== 'OFFLINE' &&
      (pagamento.method === 'PIX' || pagamento.method === 'CREDIT_CARD_ONLINE')
        ? pagamento.amountCents - pagamento.refundedCents
        : null;

    const conta = fecharContaDaSeparacao({
      itens: pedido.items.map((item) => ({
        ...item,
        pickStatus: item.pickStatus,
      })),
      totalEstimadoCents: pedido.totalCents,
      deliveryFeeCents: pedido.deliveryFeeCents,
      surchargeCents: pedido.surchargeCents,
      discountCents: pedido.discountCents,
      commissionRate: Number(pedido.commissionRate),
      pagoOnlineCents: pagoOnline,
    });

    await prisma.$transaction([
      ...pedido.items.map((item, indice) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            estimatedTotalCents: item.totalCents,
            totalCents: conta.itens[indice]!.finalCents,
          },
        }),
      ),
      prisma.order.update({
        where: { id: pedido.id },
        data: {
          pickedAt: new Date(),
          estimatedTotalCents: pedido.totalCents,
          subtotalCents: conta.subtotalCents,
          discountCents: conta.discountCents,
          totalCents: conta.totalCents,
          commissionCents: conta.commissionCents,
        },
      }),
      // Na entrega, o entregador cobra o valor final; o troco é recalculado
      // a partir dele na tela do entregador.
      ...(pagamento && pagoOnline == null
        ? [
            prisma.payment.update({
              where: { id: pagamento.id },
              data: { amountCents: conta.totalCents },
            }),
          ]
        : []),
      prisma.orderStatusHistory.create({
        data: {
          orderId: pedido.id,
          status: pedido.status,
          note: `Separação concluída: ${formatCents(pedido.totalCents)} → ${formatCents(conta.totalCents)}`,
          changedById: access.user.id,
        },
      }),
    ]);

    // Estorno fora da transação: é uma chamada ao gateway, e falhar nela não
    // pode desfazer a separação. Fica registrado para conciliar.
    let estornoFalhou = false;
    if (pagamento && pagoOnline != null && conta.estornoCents > 0) {
      try {
        if (!pagamento.externalId) throw new Error('pagamento sem id no gateway');
        await getPaymentGateway().refund({
          externalId: pagamento.externalId,
          amountCents: conta.estornoCents,
          reason: `Pesagem justa do pedido #${pedido.number}`,
        });
        await prisma.payment.update({
          where: { id: pagamento.id },
          data: { refundedCents: { increment: conta.estornoCents }, refundedAt: new Date() },
        });
      } catch (erro) {
        estornoFalhou = true;
        logger.error({ erro, orderId: pedido.id }, '[separacao] estorno parcial falhou');
        await prisma.payment.update({
          where: { id: pagamento.id },
          data: {
            failReason: `Estorno parcial pendente: ${formatCents(conta.estornoCents)}`,
          },
        });
      }
    }

    await publishRealtimeMany(canaisDoPedido(pedido), REALTIME_EVENTS.orderUpdated, {
      orderId: pedido.id,
    });

    if (pedido.userId) {
      const diferenca = conta.diferencaCents;
      const detalhe =
        conta.estornoCents > 0
          ? ` Devolvemos ${formatCents(conta.estornoCents)} no seu pagamento.`
          : diferenca < 0
            ? ` Ficou ${formatCents(-diferenca)} mais barato que o estimado.`
            : diferenca > 0
              ? ` Pelo peso real, ${formatCents(diferenca)} a mais que o estimado.`
              : '';
      await notificarUsuario({
        userId: pedido.userId,
        title: `Pedido #${pedido.number} separado`,
        body: `Total final: ${formatCents(conta.totalCents)}.${detalhe}`,
        url: `/pedidos/${pedido.id}`,
        canais: ['PUSH', 'WHATSAPP'],
        entity: { type: 'Order', id: pedido.id },
        tag: `pedido-${pedido.id}`,
      });
    }

    revalidatePath('/loja/pedidos');

    return {
      result: {
        ok: true,
        message: estornoFalhou
          ? `Separação concluída. O estorno de ${formatCents(conta.estornoCents)} não passou no gateway: ficou registrado para o suporte.`
          : `Separação concluída: total final ${formatCents(conta.totalCents)}.`,
      },
      audit: {
        action: 'order.picked',
        entityType: 'Order',
        entityId: pedido.id,
        before: { totalCents: pedido.totalCents },
        after: {
          totalCents: conta.totalCents,
          estornoCents: conta.estornoCents,
          cortesiaCents: conta.cortesiaCents,
        },
      },
    };
  });
}
