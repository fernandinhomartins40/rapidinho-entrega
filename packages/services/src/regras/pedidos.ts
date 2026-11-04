import { desfazerReservasDoPedido, prisma } from '@rapidinho/database';
import {
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  type CartItemInput,
  type ReviewInput,
} from '@rapidinho/shared';
import { publishRealtimeMany } from '../realtime/publisher';
import { gravarItemNoCarrinho } from './carrinho';
import { validarItem } from './item';
import { falha, type Resultado } from './resultado';

/**
 * Regras sobre pedidos já feitos: repetir, avaliar, cancelar antes do aceite e
 * anexar o comprovante do Pix. Toda query filtra pelo dono: pedido de outra
 * pessoa dá "não encontrado", sem confirmar nem que ele existe.
 */

/** Depois do aceite a comida já pode estar sendo feita: é conversa com a loja. */
export const STATUS_CANCELAVEIS_PELO_CLIENTE = ['PENDING_PAYMENT', 'RECEIVED'] as const;

/**
 * Recria o carrinho a partir de um pedido anterior, pizza inclusive.
 *
 * Cada item passa pelas mesmas regras de quem monta na hora (`validarItem`). O
 * que não passa mais é pulado e o cliente é avisado: exigir que todo o pedido
 * continue igual faria o botão falhar justamente nos pedidos antigos.
 */
export async function repetirPedido(
  userId: string,
  orderId: string,
): Promise<Resultado<{ storeId: string }>> {
  const pedido = await prisma.order.findFirst({
    where: { id: orderId, userId },
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

  if (!pedido) return falha('Pedido não encontrado.', 'NAO_ENCONTRADO');

  if (pedido.store.status !== 'ACTIVE' || pedido.store.deletedAt) {
    return falha(`${pedido.store.name} não está mais disponível.`, 'LOJA_INDISPONIVEL');
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
    where: { userId_storeId: { userId, storeId: pedido.storeId } },
    update: {},
    create: { userId, storeId: pedido.storeId },
    select: { id: true },
  });

  let adicionados = 0;

  for (const original of pedido.items) {
    // Produto apagado ou tamanho de pizza que não existe mais.
    if (original.productId == null && original.pizzaSizeId == null) continue;

    const extrasDoPedido = original.pizzaExtras
      .map((extra) => extra.extraId)
      .filter((id): id is string => id != null);

    const item: CartItemInput = {
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
      // Marmita não se repete: o cardápio de hoje é outro.
      marmita: [],
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

    // Item simples que já está no carrinho soma na mesma linha: repetir o
    // pedido duas vezes não duplica.
    await gravarItemNoCarrinho(carrinho.id, item);
    adicionados += 1;
  }

  if (adicionados === 0) {
    return falha('Nenhum item deste pedido está disponível agora.');
  }

  const pulados = pedido.items.length - adicionados;

  return {
    ok: true,
    storeId: pedido.storeId,
    message:
      pulados > 0
        ? `${adicionados} item(ns) no carrinho. ${pulados} não está(ão) disponível(is) agora.`
        : 'Itens adicionados ao carrinho.',
  };
}

export async function avaliarPedidoDoCliente(
  userId: string,
  dados: ReviewInput,
): Promise<Resultado> {
  const pedido = await prisma.order.findFirst({
    where: { id: dados.orderId, userId, status: 'DELIVERED' },
    select: {
      id: true,
      storeId: true,
      delivery: { select: { courierId: true } },
      reviews: { select: { id: true } },
    },
  });

  if (!pedido) {
    return falha('Só dá para avaliar um pedido entregue.', 'NAO_ENCONTRADO');
  }

  if (pedido.reviews.length > 0) {
    return falha('Você já avaliou este pedido.', 'CONFLITO');
  }

  if (!dados.storeRating && !dados.courierRating) {
    return falha('Dê pelo menos uma nota.', 'DADOS_INVALIDOS');
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
          userId,
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
          userId,
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

  return { ok: true, message: 'Obrigado pela avaliação!' };
}

/** O cliente responde a troca que a loja propôs na separação. */
export async function responderTrocaDoPedido(
  userId: string,
  dados: { orderId: string; itemId: string; aceita: boolean },
): Promise<Resultado> {
  const item = await prisma.orderItem.findFirst({
    where: {
      id: dados.itemId,
      pickStatus: 'AWAITING_CUSTOMER',
      order: { id: dados.orderId, userId, pickedAt: null },
    },
    select: { id: true, order: { select: { id: true, storeId: true } } },
  });

  if (!item) {
    return falha('Esta troca já foi decidida.', 'CONFLITO');
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
  return {
    ok: true,
    message: dados.aceita ? 'Troca aceita. A loja já foi avisada.' : 'Item retirado do pedido.',
  };
}

/**
 * O cliente desiste do pedido enquanto a loja ainda não aceitou. Pagamento já
 * confirmado não se cancela por aqui: o dinheiro precisa voltar, e isso é com
 * a loja.
 */
export async function cancelarPedidoDoCliente(userId: string, orderId: string): Promise<Resultado> {
  const pedido = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      number: true,
      status: true,
      storeId: true,
      payment: { select: { status: true } },
    },
  });

  if (!pedido) return falha('Pedido não encontrado.', 'NAO_ENCONTRADO');

  if (pedido.payment?.status === 'PAID') {
    return falha(
      'Este pedido já foi pago. Fale com a loja para cancelar e receber o dinheiro.',
      'CONFLITO',
    );
  }

  const cancelado = await prisma.$transaction(async (tx) => {
    // Condicional: se a loja aceitou no mesmo instante, o aceite vale.
    const { count } = await tx.order.updateMany({
      where: { id: pedido.id, status: { in: [...STATUS_CANCELAVEIS_PELO_CLIENTE] } },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Cancelado pelo cliente',
        cancelledBy: userId,
      },
    });
    if (count === 0) return false;

    await tx.orderStatusHistory.create({
      data: {
        orderId: pedido.id,
        status: 'CANCELLED',
        note: 'Cancelado pelo cliente',
        changedById: userId,
      },
    });
    // Estoque, cupom e corrida voltam: o pedido não aconteceu.
    await desfazerReservasDoPedido(tx, pedido.id);
    return true;
  });

  if (!cancelado) {
    return falha('A loja já aceitou o pedido. Para cancelar agora, fale com a loja.', 'CONFLITO');
  }

  await publishRealtimeMany(
    [REALTIME_CHANNELS.store(pedido.storeId), REALTIME_CHANNELS.order(pedido.id)],
    REALTIME_EVENTS.orderCancelled,
    { orderId: pedido.id, number: pedido.number, reason: 'Cancelado pelo cliente' },
  );

  return { ok: true, message: `Pedido #${pedido.number} cancelado.` };
}

/**
 * Comprovante do Pix pago na chave da loja. É opcional: ajuda o lojista a achar
 * o pagamento no extrato, mas quem libera o pedido continua sendo ele, ao
 * conferir. Imagem qualquer não prova pagamento, e por isso nada anda sozinho.
 */
export async function anexarComprovantePix(
  userId: string,
  { orderId, mediaId }: { orderId: string; mediaId: string },
): Promise<Resultado> {
  const pedido = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
      status: 'PENDING_PAYMENT',
      payment: { is: { method: 'PIX', provider: 'OFFLINE' } },
    },
    select: { id: true, number: true, storeId: true },
  });

  if (!pedido) return falha('Este pedido não está aguardando Pix.', 'NAO_ENCONTRADO');

  // Só o arquivo que esta pessoa acabou de enviar: um id de outro upload
  // abriria, pelo link assinado do painel, uma imagem privada de terceiro.
  const arquivo = await prisma.mediaAsset.findFirst({
    where: { id: mediaId, context: 'PIX_PROOF', uploadedById: userId },
    select: { id: true },
  });

  if (!arquivo) return falha('Envie a imagem do comprovante de novo.', 'NAO_ENCONTRADO');

  await prisma.payment.update({
    where: { orderId: pedido.id },
    data: { pixProofImageId: arquivo.id },
  });

  await publishRealtimeMany(
    [REALTIME_CHANNELS.store(pedido.storeId)],
    REALTIME_EVENTS.orderUpdated,
    { orderId: pedido.id, number: pedido.number },
  );

  return { ok: true, message: 'Comprovante enviado para a loja.' };
}
