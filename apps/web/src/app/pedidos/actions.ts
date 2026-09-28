'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { publishRealtimeMany } from '@rapidinho/services';
import { cuidSchema, REALTIME_CHANNELS, REALTIME_EVENTS, reviewSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';
import { validarItem } from '@/lib/regras-do-item';

/**
 * Ações sobre pedidos já feitos: repetir e avaliar.
 */

/**
 * Recria o carrinho a partir de um pedido anterior — pizza inclusive.
 *
 * Cada item passa pelas mesmas regras de quem monta na hora
 * (`validarItem`): estoque, grupo obrigatório, sabor com preço no tamanho,
 * remédio controlado. O que não passa mais é pulado, e o cliente é avisado:
 * exigir que todo o pedido continue igual faria o botão falhar justamente
 * nos pedidos antigos, que são os que mais dá vontade de repetir.
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
            pizzaSizeId: true,
            pizzaExtraId: true,
            complements: { select: { optionId: true, quantity: true } },
            flavors: { select: { flavorId: true } },
            pizzaExtras: { select: { extraId: true } },
          },
        },
      },
    });

    if (!pedido) return { ok: false, message: 'Pedido não encontrado.' };

    if (pedido.store.status !== 'ACTIVE' || pedido.store.deletedAt) {
      return { ok: false, message: `${pedido.store.name} não está mais disponível.` };
    }

    // Complemento que saiu do ar some do item em silêncio; se ele era
    // obrigatório, a regra do grupo barra o item inteiro logo abaixo.
    const idsDeOpcao = pedido.items.flatMap((item) =>
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

    let adicionados = 0;

    for (const original of pedido.items) {
      // Produto apagado ou tamanho de pizza que não existe mais.
      if (original.productId == null && original.pizzaSizeId == null) continue;

      const extrasDoPedido = original.pizzaExtras
        .map((extra) => extra.extraId)
        .filter((id): id is string => id != null);

      const item = {
        productId: original.productId ?? undefined,
        quantity: original.quantity,
        weightGrams: original.weightGrams ?? undefined,
        notes: original.notes ?? undefined,
        complements: original.complements
          .filter((complemento) => complemento.optionId && opcaoOk.has(complemento.optionId))
          .map((complemento) => ({
            optionId: complemento.optionId!,
            quantity: complemento.quantity,
          })),
        pizzaSizeId: original.pizzaSizeId ?? undefined,
        // Pedido de antes da pizza com vários adicionais: a borda única.
        pizzaExtraIds:
          extrasDoPedido.length > 0
            ? extrasDoPedido
            : original.pizzaExtraId
              ? [original.pizzaExtraId]
              : [],
        flavorIds: original.flavors
          .map((sabor) => sabor.flavorId)
          .filter((id): id is string => id != null),
      };

      // Sabor apagado: a pizza não é mais a mesma, melhor não adivinhar.
      if (item.pizzaSizeId && item.flavorIds.length !== original.flavors.length) continue;

      const jaNoCarrinho = item.productId
        ? ((
            await prisma.cartItem.aggregate({
              where: { productId: item.productId, cartId: carrinho.id },
              _sum: { quantity: true },
            })
          )._sum.quantity ?? 0)
        : 0;

      const regra = await validarItem(pedido.storeId, item, {
        quantidadeJaNoCarrinho: jaNoCarrinho,
      });
      if (!regra.ok) continue;

      const simples =
        item.productId != null &&
        item.complements.length === 0 &&
        item.pizzaSizeId == null &&
        !item.notes;

      // Item simples que já está no carrinho soma na mesma linha (mesma regra
      // de `adicionarAoCarrinho`): repetir o pedido duas vezes não duplica.
      if (simples) {
        const igual = await prisma.cartItem.findFirst({
          where: {
            cartId: carrinho.id,
            productId: item.productId,
            weightGrams: item.weightGrams ?? null,
            notes: null,
            pizzaSizeId: null,
            complements: { none: {} },
            flavors: { none: {} },
          },
          select: { id: true, quantity: true },
        });

        if (igual) {
          await prisma.cartItem.update({
            where: { id: igual.id },
            data: { quantity: Math.min(99, igual.quantity + item.quantity) },
          });
          adicionados += 1;
          continue;
        }
      }

      await prisma.cartItem.create({
        data: {
          cartId: carrinho.id,
          productId: item.productId ?? null,
          quantity: item.quantity,
          weightGrams: item.weightGrams ?? null,
          notes: item.notes ?? null,
          pizzaSizeId: item.pizzaSizeId ?? null,
          pizzaExtras: { create: item.pizzaExtraIds.map((extraId) => ({ extraId })) },
          complements: { create: item.complements },
          flavors: { create: item.flavorIds.map((flavorId) => ({ flavorId })) },
        },
      });
      adicionados += 1;
    }

    if (adicionados === 0) {
      return { ok: false, message: 'Nenhum item deste pedido está disponível agora.' };
    }

    revalidatePath('/carrinho');

    const pulados = pedido.items.length - adicionados;

    return {
      ok: true,
      message:
        pulados > 0
          ? `${adicionados} item(ns) no carrinho. ${pulados} não está(ão) disponível(is) agora.`
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

const respostaSchema = z.object({
  orderId: cuidSchema,
  itemId: cuidSchema,
  aceita: z.boolean(),
});

/**
 * O cliente responde, no app, a troca que a loja propôs na separação.
 *
 * Aceitou: o item vai trocado, pelo preço que ele viu. Recusou: sai da conta.
 * A loja recebe na hora, pelo socket, e segue a separação.
 */
export async function responderTroca(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = respostaSchema.parse(entrada);

    const item = await prisma.orderItem.findFirst({
      where: {
        id: dados.itemId,
        pickStatus: 'AWAITING_CUSTOMER',
        order: { id: dados.orderId, userId: user.id, pickedAt: null },
      },
      select: { id: true, order: { select: { id: true, storeId: true } } },
    });

    if (!item) {
      return { ok: false, message: 'Esta troca já foi decidida.' };
    }

    await prisma.orderItem.update({
      where: { id: item.id },
      data: dados.aceita
        ? { pickStatus: 'REPLACED', replacementAccepted: true }
        : { pickStatus: 'MISSING', replacementAccepted: false },
    });

    await publishRealtimeMany(
      [REALTIME_CHANNELS.store(item.order.storeId), REALTIME_CHANNELS.order(item.order.id)],
      REALTIME_EVENTS.orderUpdated,
      { orderId: item.order.id, itemId: item.id },
    );

    revalidatePath(`/pedidos/${item.order.id}`);
    return {
      ok: true,
      message: dados.aceita ? 'Troca aceita. A loja já foi avisada.' : 'Item retirado do pedido.',
    };
  });
}
