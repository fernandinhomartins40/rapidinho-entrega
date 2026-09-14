import { redirect } from 'next/navigation';
import { AuthorizationError, requireCourier } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import { parseServerEnv, getPublicEnv, REALTIME_CHANNELS } from '@rapidinho/shared';
import { createChannelToken } from '@rapidinho/shared/realtime/token';
import { PainelDoEntregador } from './painel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entregas' };

/**
 * Painel do entregador.
 *
 * Mostra as corridas disponíveis na cidade dele e as que já são suas. A fila
 * aberta é o modelo da frota da plataforma; o entregador de uma loja só vê as
 * corridas daquela loja.
 */
export default async function EntregadorPage() {
  let contexto;

  try {
    contexto = await requireCourier();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 401 ? '/entrar?destino=/entregador' : '/');
    }
    throw error;
  }

  const entregador = await prisma.courier.findUniqueOrThrow({
    where: { id: contexto.courierId },
    select: {
      id: true,
      cityId: true,
      storeId: true,
      isOnline: true,
      deliveryCount: true,
      ratingAverage: true,
      vehicleType: true,
      user: { select: { name: true } },
    },
  });

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const [disponiveis, minhas, ganhos] = await Promise.all([
    prisma.delivery.findMany({
      where: {
        status: 'PENDING',
        courierId: null,
        order: {
          cityId: entregador.cityId,
          status: { in: ['READY', 'PREPARING'] },
          // Entregador de loja só enxerga a fila da própria loja; o da
          // plataforma vê a cidade inteira.
          ...(entregador.storeId ? { storeId: entregador.storeId } : {}),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        id: true,
        earningCents: true,
        distanceMeters: true,
        order: {
          select: {
            number: true,
            totalCents: true,
            addressSnapshot: true,
            store: { select: { name: true, street: true, number: true, neighborhood: true } },
          },
        },
      },
    }),
    prisma.delivery.findMany({
      where: { courierId: entregador.id, status: { in: ['ACCEPTED', 'PICKED_UP'] } },
      orderBy: { acceptedAt: 'asc' },
      select: {
        id: true,
        status: true,
        earningCents: true,
        order: {
          select: {
            number: true,
            customerName: true,
            customerPhone: true,
            totalCents: true,
            addressSnapshot: true,
            payment: { select: { method: true, status: true, changeForCents: true } },
            store: {
              select: { name: true, phone: true, street: true, number: true, neighborhood: true },
            },
          },
        },
      },
    }),
    prisma.delivery.aggregate({
      where: { courierId: entregador.id, status: 'DELIVERED', deliveredAt: { gte: inicioDoDia } },
      _sum: { earningCents: true },
      _count: true,
    }),
  ]);

  const channel = REALTIME_CHANNELS.courier(entregador.id);

  return (
    <PainelDoEntregador
      entregador={{
        nome: entregador.user.name,
        online: entregador.isOnline,
        entregasTotais: entregador.deliveryCount,
        nota: Number(entregador.ratingAverage),
        daLoja: entregador.storeId != null,
      }}
      ganhosDeHoje={{
        centavos: ganhos._sum.earningCents ?? 0,
        entregas: ganhos._count,
      }}
      disponiveis={disponiveis}
      minhas={minhas}
      realtime={{
        channel,
        token: createChannelToken(
          { channel, userId: contexto.user.id },
          parseServerEnv().AUTH_SECRET,
        ),
        url: getPublicEnv().NEXT_PUBLIC_SOCKET_URL,
      }}
    />
  );
}
