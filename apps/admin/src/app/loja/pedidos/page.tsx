import { prisma } from '@rapidinho/database';
import { getStorage } from '@rapidinho/services';
import { inicioDoDia as inicioDoDiaEmBrasilia } from '@rapidinho/shared';
import { PainelDePedidos } from './painel-de-pedidos';
import { getStoreContext, STATUS_EM_ABERTO } from '@/lib/store-context';
import { storeRealtime } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedidos' };

/**
 * Tela que fica aberta o dia inteiro.
 *
 * Carrega os pedidos abertos e os concluídos de hoje; o resto do histórico
 * vive em Financeiro. Manter aqui só o dia evita que a lista cresça sem fim
 * numa tela que precisa continuar leve depois de 12 horas ligada.
 */
async function carregarPedidos(storeId: string) {
  // Dia de Brasília: o servidor roda em UTC, e às 21h o "hoje" virava amanhã.
  const inicioDoDia = inicioDoDiaEmBrasilia();

  return prisma.order.findMany({
    where: {
      storeId,
      // "Saiu para entrega" não exige ação da loja (fica fora do contador),
      // mas continua na tela: pedido da madrugada que sai depois da meia-noite
      // sumia de "Em andamento" com o motoboy ainda na rua.
      OR: [
        { status: { in: [...STATUS_EM_ABERTO, 'OUT_FOR_DELIVERY'] } },
        { createdAt: { gte: inicioDoDia } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      type: true,
      userId: true,
      customerName: true,
      customerPhone: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      discountCents: true,
      surchargeCents: true,
      totalCents: true,
      estimatedTotalCents: true,
      pickedAt: true,
      notes: true,
      createdAt: true,
      acceptedAt: true,
      estimatedPrepMinutes: true,
      estimatedReadyAt: true,
      cancelReason: true,
      addressSnapshot: true,
      substitutionPolicy: true,
      ageConfirmedAt: true,
      prescriptionImage: { select: { largeKey: true, mediumKey: true, originalKey: true } },
      delivery: {
        select: {
          status: true,
          courier: { select: { user: { select: { name: true, phone: true } } } },
        },
      },
      payment: {
        select: {
          method: true,
          status: true,
          provider: true,
          changeForCents: true,
          amountCents: true,
          refundedCents: true,
          failReason: true,
        },
      },
      items: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          productId: true,
          pickStatus: true,
          pickedWeightGrams: true,
          replacementName: true,
          replacementPriceCents: true,
          replacementAccepted: true,
          questionAskedAt: true,
          estimatedTotalCents: true,
          productName: true,
          quantity: true,
          weightGrams: true,
          unitPriceCents: true,
          totalCents: true,
          notes: true,
          pizzaSizeName: true,
          pizzaExtraName: true,
          complements: { select: { id: true, optionName: true, quantity: true, priceCents: true } },
          flavors: { select: { id: true, flavorName: true, flavorId: true } },
          pizzaExtras: { select: { id: true, name: true, kind: true } },
        },
      },
    },
  });
}

export default async function PedidosPage() {
  const { store, access } = await getStoreContext();

  const [pedidos, realtime] = await Promise.all([
    carregarPedidos(store.id),
    Promise.resolve(storeRealtime(store.id, access.user.id)),
  ]);

  // Quantos pedidos cada cliente já recebeu desta loja: o primeiro pedido
  // merece atenção extra (é quando se ganha ou se perde o cliente).
  const clientes = [...new Set(pedidos.map((pedido) => pedido.userId).filter(Boolean))] as string[];
  const entregues = clientes.length
    ? await prisma.order.groupBy({
        by: ['userId'],
        where: { storeId: store.id, status: 'DELIVERED', userId: { in: clientes } },
        _count: { _all: true },
      })
    : [];
  const entreguesPorCliente = new Map(
    entregues.map((linha) => [linha.userId, linha._count._all] as const),
  );

  return (
    <PainelDePedidos
      pedidos={await Promise.all(
        pedidos.map(async ({ userId, prescriptionImage, delivery, ...pedido }) => ({
          ...pedido,
          entrega: delivery
            ? {
                status: delivery.status,
                entregador: delivery.courier
                  ? {
                      nome: delivery.courier.user.name ?? 'Entregador',
                      telefone: delivery.courier.user.phone,
                    }
                  : null,
              }
            : null,
          // Receita é dado de saúde: fica no armazenamento privado e só abre
          // por link assinado, que expira.
          receitaUrl: prescriptionImage
            ? await getStorage().getSignedUrl(
                prescriptionImage.largeKey ??
                  prescriptionImage.mediumKey ??
                  prescriptionImage.originalKey,
              )
            : null,
          ageConfirmedAt: pedido.ageConfirmedAt?.toISOString() ?? null,
          pickedAt: pedido.pickedAt?.toISOString() ?? null,
          // Separação (pesagem justa): mercado e farmácia sempre; qualquer
          // loja quando há item por peso.
          separa:
            store.segment === 'MARKET' ||
            store.segment === 'PHARMACY' ||
            pedido.items.some((item) => item.weightGrams != null),
          items: pedido.items.map((item) => ({
            ...item,
            questionAskedAt: item.questionAskedAt?.toISOString() ?? null,
          })),
          primeiroPedido:
            userId != null &&
            (entreguesPorCliente.get(userId) ?? 0) - (pedido.status === 'DELIVERED' ? 1 : 0) === 0,
          createdAt: pedido.createdAt.toISOString(),
          acceptedAt: pedido.acceptedAt?.toISOString() ?? null,
          estimatedReadyAt: pedido.estimatedReadyAt?.toISOString() ?? null,
        })),
      )}
      loja={{ nome: store.name, alertaSonoro: store.soundAlertEnabled }}
      realtime={realtime}
    />
  );
}
