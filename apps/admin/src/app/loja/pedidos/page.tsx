import { prisma } from '@rapidinho/database';
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
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  return prisma.order.findMany({
    where: {
      storeId,
      OR: [{ status: { in: [...STATUS_EM_ABERTO] } }, { createdAt: { gte: inicioDoDia } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      type: true,
      customerName: true,
      customerPhone: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      discountCents: true,
      totalCents: true,
      notes: true,
      createdAt: true,
      acceptedAt: true,
      estimatedPrepMinutes: true,
      estimatedReadyAt: true,
      cancelReason: true,
      addressSnapshot: true,
      payment: { select: { method: true, status: true, changeForCents: true } },
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          weightGrams: true,
          unitPriceCents: true,
          totalCents: true,
          notes: true,
          pizzaSizeName: true,
          pizzaExtraName: true,
          complements: { select: { id: true, optionName: true, quantity: true, priceCents: true } },
          flavors: { select: { id: true, flavorName: true } },
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

  return (
    <PainelDePedidos
      pedidos={pedidos.map((pedido) => ({
        ...pedido,
        createdAt: pedido.createdAt.toISOString(),
        acceptedAt: pedido.acceptedAt?.toISOString() ?? null,
        estimatedReadyAt: pedido.estimatedReadyAt?.toISOString() ?? null,
      }))}
      loja={{ nome: store.name, alertaSonoro: store.soundAlertEnabled }}
      realtime={realtime}
    />
  );
}
