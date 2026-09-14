'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
import { publishRealtime } from '@rapidinho/services';
import {
  checkoutSchema,
  isStoreOpen,
  normalizePhoneBR,
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
} from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';
import { carregarCarrinho } from '@/lib/cart';
import { calcularCheckout } from '@/lib/checkout';

/**
 * Criação do pedido.
 *
 * Tudo é recalculado aqui — preços, taxa de entrega e desconto — a partir do
 * catálogo e das regras da loja. O cliente informa apenas escolhas; nenhum
 * valor vindo do navegador entra no banco.
 *
 * O pedido guarda SNAPSHOTS do que foi comprado: nome do produto, preço, nome
 * do complemento, endereço. O catálogo muda, o pedido não pode mudar junto —
 * uma comanda de ontem precisa continuar dizendo o que foi vendido ontem.
 */

/** Número curto e legível, que o cliente dita no telefone. */
async function gerarNumeroDoPedido(): Promise<string> {
  const hoje = new Date();
  const prefixo = `${String(hoje.getDate()).padStart(2, '0')}${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  // Tenta algumas vezes: a coluna é única e uma colisão em horário de pico é
  // possível, ainda que rara.
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const sufixo = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
    const numero = `${prefixo}${sufixo}`;

    const existe = await prisma.order.findUnique({
      where: { number: numero },
      select: { id: true },
    });
    if (!existe) return numero;
  }

  // Último recurso: o timestamp não colide, só é feio de ditar.
  return `${prefixo}${Date.now().toString().slice(-6)}`;
}

export async function finalizarPedido(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let destino: string | null = null;

  const resultado = await runAuthedAction(async (user): Promise<ActionResult> => {
    const dados = checkoutSchema.parse({
      storeId: formData.get('storeId'),
      type: formData.get('type') ?? 'DELIVERY',
      addressId: formData.get('addressId') || undefined,
      paymentMethod: formData.get('paymentMethod'),
      changeForCents: formData.get('changeForCents')
        ? Math.round(Number(String(formData.get('changeForCents')).replace(',', '.')) * 100)
        : null,
      couponCode: formData.get('couponCode') || undefined,
      notes: formData.get('notes') || undefined,
      customerName: formData.get('customerName') || undefined,
      customerPhone: formData.get('customerPhone') || undefined,
    });

    const carrinho = await carregarCarrinho(user.id, dados.storeId);

    if (!carrinho || carrinho.itens.length === 0) {
      return { ok: false, message: 'Seu carrinho está vazio.' };
    }

    const loja = await prisma.store.findFirst({
      where: { id: dados.storeId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        cityId: true,
        slug: true,
        acceptsPix: true,
        acceptsCardOnline: true,
        acceptsCashOnDelivery: true,
        acceptsCardOnDelivery: true,
        acceptsPickup: true,
        autoAcceptOrders: true,
        avgPrepTimeMinutes: true,
        isPausedUntil: true,
        pauseReason: true,
        hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
        closures: {
          where: { endsAt: { gte: new Date() } },
          select: { startsAt: true, endsAt: true, reason: true },
        },
        subscription: { select: { plan: { select: { commissionRate: true } } } },
      },
    });

    if (!loja) return { ok: false, message: 'Loja indisponível.' };

    // A loja pode ter fechado entre montar o carrinho e confirmar: deixar
    // passar geraria um pedido que ninguém vai preparar.
    const abertura = isStoreOpen({
      hours: loja.hours,
      closures: loja.closures,
      pausedUntil: loja.isPausedUntil,
      pauseReason: loja.pauseReason,
    });

    if (!abertura.isOpen) {
      return { ok: false, message: `A loja fechou. ${abertura.reason ?? ''}`.trim() };
    }

    if (dados.type === 'PICKUP' && !loja.acceptsPickup) {
      return { ok: false, message: 'Esta loja não aceita retirada no local.' };
    }

    const aceita: Record<string, boolean> = {
      PIX: loja.acceptsPix,
      CREDIT_CARD_ONLINE: loja.acceptsCardOnline,
      CASH_ON_DELIVERY: loja.acceptsCashOnDelivery,
      CARD_ON_DELIVERY: loja.acceptsCardOnDelivery,
    };

    if (!aceita[dados.paymentMethod]) {
      return { ok: false, message: 'Esta loja não aceita essa forma de pagamento.' };
    }

    const resumo = await calcularCheckout({
      carrinho,
      userId: user.id,
      cityId: loja.cityId,
      tipo: dados.type,
      addressId: dados.addressId ?? null,
      couponCode: dados.couponCode ?? null,
    });

    if (resumo.bloqueio) return { ok: false, message: resumo.bloqueio };

    if (dados.paymentMethod === 'CASH_ON_DELIVERY' && dados.changeForCents != null) {
      if (dados.changeForCents < resumo.totalCents) {
        return {
          ok: false,
          message: 'O valor do troco precisa ser maior que o total do pedido.',
          fieldErrors: { changeForCents: 'Valor menor que o total' },
        };
      }
    }

    const endereco =
      dados.type === 'DELIVERY' && dados.addressId
        ? await prisma.address.findFirst({
            where: { id: dados.addressId, userId: user.id },
            select: {
              id: true,
              street: true,
              number: true,
              complement: true,
              neighborhood: true,
              referencePoint: true,
              zipCode: true,
            },
          })
        : null;

    const nomeDoCliente = dados.customerName ?? user.name;
    const telefoneDoCliente = dados.customerPhone
      ? normalizePhoneBR(dados.customerPhone)
      : user.phone;

    if (!nomeDoCliente || !telefoneDoCliente) {
      return {
        ok: false,
        message: 'Informe seu nome e telefone para a loja entrar em contato.',
        ...(nomeDoCliente ? {} : { fieldErrors: { customerName: 'Informe seu nome' } }),
      };
    }

    const numero = await gerarNumeroDoPedido();
    const comissao = Number(loja.subscription?.plan.commissionRate ?? 0);

    // O aceite automático pula a etapa de confirmação para lojas que sempre
    // aceitam — o status inicial já entra como ACCEPTED.
    const statusInicial = loja.autoAcceptOrders ? 'ACCEPTED' : 'RECEIVED';

    const pedido = await prisma.$transaction(async (tx) => {
      const criado = await tx.order.create({
        data: {
          number: numero,
          cityId: loja.cityId,
          storeId: loja.id,
          userId: user.id,
          type: dados.type,
          status: statusInicial,
          customerName: nomeDoCliente,
          customerPhone: telefoneDoCliente,
          addressId: endereco?.id ?? null,
          // Snapshot: o cliente pode editar o endereço depois, e a comanda
          // precisa continuar mostrando para onde foi entregue.
          addressSnapshot: endereco
            ? {
                street: endereco.street,
                number: endereco.number,
                complement: endereco.complement,
                neighborhood: endereco.neighborhood,
                referencePoint: endereco.referencePoint,
                zipCode: endereco.zipCode,
              }
            : undefined,
          subtotalCents: resumo.subtotalCents,
          deliveryFeeCents: resumo.deliveryFeeCents,
          discountCents: resumo.discountCents,
          totalCents: resumo.totalCents,
          commissionCents: resumo.commissionCents,
          commissionRate: comissao,
          couponId: resumo.couponId,
          notes: dados.notes ?? null,
          estimatedPrepMinutes: loja.avgPrepTimeMinutes,
          ...(statusInicial === 'ACCEPTED' ? { acceptedAt: new Date() } : {}),
          items: {
            create: carrinho.itens.map((item) => ({
              productId: item.productId,
              productName: item.nome,
              productType: item.pizza ? 'PIZZA' : 'SIMPLE',
              quantity: item.quantidade,
              weightGrams: item.weightGrams,
              unitPriceCents: item.unitTotalCents,
              totalCents: item.totalCents,
              notes: item.observacao,
              pizzaSizeName: item.pizza?.tamanho ?? null,
              pizzaExtraName: item.pizza?.extra ?? null,
              complements: {
                create: item.complementos.map((complemento) => ({
                  optionId: complemento.optionId,
                  groupName: complemento.grupo,
                  optionName: complemento.nome,
                  quantity: complemento.quantidade,
                  priceCents: complemento.precoCents,
                })),
              },
              flavors: {
                create: (item.pizza?.sabores ?? []).map((sabor) => ({
                  flavorId: sabor.id,
                  flavorName: sabor.nome,
                  priceCents: sabor.precoCents,
                })),
              },
              pizzaExtraPriceCents: item.pizza?.extraPrecoCents ?? null,
            })),
          },
          statusHistory: {
            create: { status: statusInicial, changedById: user.id },
          },
          payment: {
            create: {
              method: dados.paymentMethod,
              // Pix e cartão online só ficam pagos depois do webhook do
              // gateway; pagamento na entrega é acertado com o entregador.
              status: 'PENDING',
              amountCents: resumo.totalCents,
              changeForCents: dados.changeForCents ?? null,
            },
          },
        },
        select: { id: true, number: true },
      });

      if (resumo.couponId) {
        await tx.couponRedemption.create({
          data: {
            couponId: resumo.couponId,
            userId: user.id,
            orderId: criado.id,
            discountCents: resumo.discountCents,
          },
        });
        await tx.coupon.update({
          where: { id: resumo.couponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      // O carrinho só some depois que o pedido existe: falhar no meio deixaria
      // o cliente sem carrinho e sem pedido.
      await tx.cart.delete({ where: { id: carrinho.id } });

      return criado;
    });

    await publishRealtime(REALTIME_CHANNELS.store(loja.id), REALTIME_EVENTS.orderCreated, {
      orderId: pedido.id,
      number: pedido.number,
    });

    revalidatePath('/carrinho');
    revalidatePath('/pedidos');

    destino = `/pedidos/${pedido.id}`;
    return { ok: true, message: `Pedido #${pedido.number} enviado!` };
  });

  // O redirect precisa acontecer FORA do try da ação: ele sinaliza por
  // exceção e seria capturado como falha genérica.
  if (destino) redirect(destino);

  return resultado;
}
