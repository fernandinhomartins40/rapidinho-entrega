'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
import { reviewSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Ações sobre pedidos já feitos: repetir e avaliar.
 */

/**
 * Recria o carrinho a partir de um pedido anterior.
 *
 * O que não existe mais é simplesmente pulado, e o cliente é avisado: exigir
 * que todo o pedido continue disponível faria o botão falhar justamente nos
 * pedidos antigos, que são os que mais dá vontade de repetir.
 */
export async function pedirNovamente(orderId: string): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const pedido = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      select: {
        storeId: true,
        store: { select: { status: true, deletedAt: true, name: true } },
        items: {
          select: {
            productId: true,
            quantity: true,
            weightGrams: true,
            notes: true,
            complements: { select: { optionId: true, quantity: true } },
          },
        },
      },
    });

    if (!pedido) return { ok: false, message: 'Pedido não encontrado.' };

    if (pedido.store.status !== 'ACTIVE' || pedido.store.deletedAt) {
      return { ok: false, message: `${pedido.store.name} não está mais disponível.` };
    }

    const agora = new Date();
    const idsDeProduto = pedido.items
      .map((item) => item.productId)
      .filter((id): id is string => id != null);

    const disponiveis = await prisma.product.findMany({
      where: {
        id: { in: idsDeProduto },
        storeId: pedido.storeId,
        deletedAt: null,
        isAvailable: true,
        OR: [{ pausedUntil: null }, { pausedUntil: { lte: agora } }],
      },
      select: { id: true },
    });

    const podeAdicionar = new Set(disponiveis.map((produto) => produto.id));
    const itens = pedido.items.filter(
      (item) => item.productId != null && podeAdicionar.has(item.productId),
    );

    if (itens.length === 0) {
      return { ok: false, message: 'Nenhum item deste pedido está disponível agora.' };
    }

    // Complementos também podem ter saído do ar desde então.
    const idsDeOpcao = itens.flatMap((item) =>
      item.complements
        .map((complemento) => complemento.optionId)
        .filter((id): id is string => id != null),
    );

    const opcoesAtivas = await prisma.complementOption.findMany({
      where: { id: { in: idsDeOpcao }, isAvailable: true, group: { storeId: pedido.storeId } },
      select: { id: true },
    });

    const opcaoOk = new Set(opcoesAtivas.map((opcao) => opcao.id));

    const carrinho = await prisma.cart.upsert({
      where: { userId_storeId: { userId: user.id, storeId: pedido.storeId } },
      update: {},
      create: { userId: user.id, storeId: pedido.storeId },
      select: { id: true },
    });

    for (const item of itens) {
      await prisma.cartItem.create({
        data: {
          cartId: carrinho.id,
          productId: item.productId,
          quantity: item.quantity,
          weightGrams: item.weightGrams,
          notes: item.notes,
          complements: {
            create: item.complements
              .filter((complemento) => complemento.optionId && opcaoOk.has(complemento.optionId))
              .map((complemento) => ({
                optionId: complemento.optionId!,
                quantity: complemento.quantity,
              })),
          },
        },
      });
    }

    revalidatePath('/carrinho');

    const pulados = pedido.items.length - itens.length;

    return {
      ok: true,
      message:
        pulados > 0
          ? `${itens.length} item(ns) no carrinho. ${pulados} não está(ão) disponível(is) agora.`
          : 'Itens adicionados ao carrinho.',
    };
  });
}

export async function avaliarPedido(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = reviewSchema.parse({
      orderId: formData.get('orderId'),
      storeRating: formData.get('storeRating') ? Number(formData.get('storeRating')) : undefined,
      storeComment: formData.get('storeComment') || undefined,
      courierRating: formData.get('courierRating')
        ? Number(formData.get('courierRating'))
        : undefined,
      courierComment: formData.get('courierComment') || undefined,
    });

    const pedido = await prisma.order.findFirst({
      where: { id: dados.orderId, userId: user.id, status: 'DELIVERED' },
      select: {
        id: true,
        storeId: true,
        delivery: { select: { courierId: true } },
        reviews: { select: { id: true } },
      },
    });

    if (!pedido) {
      return { ok: false, message: 'Só dá para avaliar um pedido entregue.' };
    }

    if (pedido.reviews.length > 0) {
      return { ok: false, message: 'Você já avaliou este pedido.' };
    }

    if (!dados.storeRating && !dados.courierRating) {
      return { ok: false, message: 'Dê pelo menos uma nota.' };
    }

    // Loja e entregador são avaliações SEPARADAS: o modelo tem uma linha por
    // alvo, com índice único por (pedido, loja) e (pedido, entregador). Juntar
    // as duas numa linha só impediria avaliar o entregador de um pedido
    // retirado na loja, e vice-versa.
    await prisma.$transaction(async (tx) => {
      if (dados.storeRating) {
        await tx.review.create({
          data: {
            orderId: pedido.id,
            userId: user.id,
            storeId: pedido.storeId,
            rating: dados.storeRating,
            comment: dados.storeComment ?? null,
          },
        });

        // A média fica no registro da loja para a vitrine não precisar agregar
        // a tabela de avaliações a cada carregamento.
        const agregado = await tx.review.aggregate({
          where: { storeId: pedido.storeId },
          _avg: { rating: true },
          _count: { rating: true },
        });

        await tx.store.update({
          where: { id: pedido.storeId },
          data: {
            ratingAverage: agregado._avg.rating ?? 0,
            ratingCount: agregado._count.rating,
          },
        });
      }

      const courierId = pedido.delivery?.courierId;

      if (dados.courierRating && courierId) {
        await tx.review.create({
          data: {
            orderId: pedido.id,
            userId: user.id,
            courierId,
            rating: dados.courierRating,
            comment: dados.courierComment ?? null,
          },
        });

        const agregado = await tx.review.aggregate({
          where: { courierId },
          _avg: { rating: true },
          _count: { rating: true },
        });

        await tx.courier.update({
          where: { id: courierId },
          data: {
            ratingAverage: agregado._avg.rating ?? 0,
            ratingCount: agregado._count.rating,
          },
        });
      }
    });

    revalidatePath(`/pedidos/${pedido.id}`);

    return { ok: true, message: 'Obrigado pela avaliação!' };
  });
}
