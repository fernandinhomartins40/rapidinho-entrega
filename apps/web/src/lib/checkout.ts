import { prisma } from '@rapidinho/database';
import { applyCoupon, calculateDeliveryFee } from '@rapidinho/shared';
import { totaisDoCarrinho, type CarrinhoResolvido } from './cart';

/**
 * Cálculo do que o cliente vai pagar.
 *
 * Roda igual na pré-visualização do checkout e na criação do pedido, a partir
 * dos mesmos dados. Duas rotas calculando por conta própria é como surgem
 * pedidos com total diferente do que o cliente aceitou na tela.
 */

export interface ResumoDoCheckout {
  deliveryFeeCents: number;
  deliveryFeeReason: string | null;
  discountCents: number;
  freteGratisPorCupom: boolean;
  couponMessage: string | null;
  couponId: string | null;
  subtotalCents: number;
  totalCents: number;
  commissionCents: number;
  /// Impede o pedido quando preenchido; o texto explica o porquê ao cliente.
  bloqueio: string | null;
}

interface Entrada {
  carrinho: CarrinhoResolvido;
  userId: string;
  cityId: string;
  tipo: 'DELIVERY' | 'PICKUP';
  addressId: string | null;
  couponCode: string | null;
}

export async function calcularCheckout({
  carrinho,
  userId,
  cityId,
  tipo,
  addressId,
  couponCode,
}: Entrada): Promise<ResumoDoCheckout> {
  const loja = await prisma.store.findUniqueOrThrow({
    where: { id: carrinho.storeId },
    select: {
      deliveryFeeMode: true,
      deliveryFeeCents: true,
      pricePerKmCents: true,
      freeDeliveryAboveCents: true,
      deliveryRadiusMeters: true,
      minOrderCents: true,
      latitude: true,
      longitude: true,
      deliveryZones: {
        select: {
          id: true,
          name: true,
          neighborhoodId: true,
          feeCents: true,
          minOrderCents: true,
          estimatedMinutes: true,
          isActive: true,
        },
      },
    },
  });

  const endereco =
    tipo === 'DELIVERY' && addressId
      ? await prisma.address.findFirst({
          where: { id: addressId, userId, deletedAt: null },
          select: { neighborhoodId: true, latitude: true, longitude: true },
        })
      : null;

  let deliveryFeeCents = 0;
  let deliveryFeeReason: string | null = null;
  let bloqueioDeEntrega: string | null = null;

  if (tipo === 'DELIVERY') {
    if (!endereco) {
      bloqueioDeEntrega = 'Escolha um endereço de entrega.';
    } else {
      const resultado = calculateDeliveryFee({
        mode: loja.deliveryFeeMode as 'FIXED' | 'BY_DISTANCE' | 'BY_ZONE' | 'FREE',
        deliveryFeeCents: loja.deliveryFeeCents,
        pricePerKmCents: loja.pricePerKmCents,
        deliveryRadiusMeters: loja.deliveryRadiusMeters,
        freeDeliveryAboveCents: loja.freeDeliveryAboveCents,
        subtotalCents: carrinho.subtotalCents,
        zones: loja.deliveryZones,
        neighborhoodId: endereco.neighborhoodId,
        storeCoordinates:
          loja.latitude != null && loja.longitude != null
            ? { latitude: loja.latitude, longitude: loja.longitude }
            : null,
        addressCoordinates:
          endereco.latitude != null && endereco.longitude != null
            ? { latitude: endereco.latitude, longitude: endereco.longitude }
            : null,
      });

      if (resultado.available) {
        deliveryFeeCents = resultado.feeCents;
        if (resultado.isFreeByThreshold) {
          deliveryFeeReason = 'Entrega grátis pelo valor do pedido';
        }
      } else {
        bloqueioDeEntrega = resultado.reason;
      }
    }
  }

  let discountCents = 0;
  let freteGratisPorCupom = false;
  let couponMessage: string | null = null;
  let couponId: string | null = null;

  if (couponCode?.trim()) {
    const codigo = couponCode.trim().toUpperCase();

    const cupom = await prisma.coupon.findFirst({
      where: {
        code: codigo,
        // Cupom da própria loja, ou global da plataforma (com ou sem cidade).
        OR: [
          { storeId: carrinho.storeId },
          { scope: 'PLATFORM', OR: [{ cityId }, { cityId: null }] },
        ],
      },
    });

    if (!cupom) {
      couponMessage = 'Cupom não encontrado ou não vale nesta loja.';
    } else {
      const [usosDoCliente, pedidosAnteriores] = await Promise.all([
        prisma.couponRedemption.count({ where: { couponId: cupom.id, userId } }),
        prisma.order.count({
          where: { userId, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        }),
      ]);

      const resultado = applyCoupon(
        {
          id: cupom.id,
          code: cupom.code,
          scope: cupom.scope as 'PLATFORM' | 'STORE',
          storeId: cupom.storeId,
          cityId: cupom.cityId,
          discountType: cupom.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_DELIVERY',
          discountValue: cupom.discountValue,
          maxDiscountCents: cupom.maxDiscountCents,
          minOrderCents: cupom.minOrderCents,
          usageLimit: cupom.usageLimit,
          usagePerUser: cupom.usagePerUser,
          usageCount: cupom.usageCount,
          firstOrderOnly: cupom.firstOrderOnly,
          startsAt: cupom.startsAt,
          endsAt: cupom.endsAt,
          isActive: cupom.isActive,
        },
        {
          subtotalCents: carrinho.subtotalCents,
          deliveryFeeCents,
          storeId: carrinho.storeId,
          cityId,
          userRedemptionCount: usosDoCliente,
          isFirstOrder: pedidosAnteriores === 0,
        },
      );

      if (resultado.valid) {
        discountCents = resultado.discountCents;
        freteGratisPorCupom = resultado.freeDelivery;
        couponId = cupom.id;

        if (resultado.freeDelivery) {
          deliveryFeeCents = 0;
          deliveryFeeReason = 'Entrega grátis pelo cupom';
        }
      } else {
        couponMessage = resultado.reason;
      }
    }
  }

  const totais = totaisDoCarrinho(carrinho, deliveryFeeCents, discountCents);

  const faltamCentavos = loja.minOrderCents - carrinho.subtotalCents;

  const bloqueio =
    bloqueioDeEntrega ??
    (carrinho.itens.length === 0
      ? 'Seu carrinho está vazio.'
      : carrinho.temIndisponivel
        ? 'Há itens indisponíveis no carrinho. Remova-os para continuar.'
        : faltamCentavos > 0
          ? `Esta loja tem pedido mínimo. Faltam ${(faltamCentavos / 100).toFixed(2).replace('.', ',')} reais.`
          : null);

  return {
    deliveryFeeCents,
    deliveryFeeReason,
    discountCents,
    freteGratisPorCupom,
    couponMessage,
    couponId,
    subtotalCents: totais.subtotalCents,
    totalCents: totais.totalCents,
    commissionCents: totais.commissionCents,
    bloqueio,
  };
}
