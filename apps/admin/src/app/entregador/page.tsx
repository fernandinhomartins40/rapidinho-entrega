import { redirect } from 'next/navigation';
import { AuthorizationError, requireCourier } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import {
  getPublicEnv,
  inicioDoDia as inicioDoDiaEmBrasilia,
  parseServerEnv,
  REALTIME_CHANNELS,
} from '@rapidinho/shared';
import { createChannelToken } from '@rapidinho/shared/realtime/token';
import { PainelDoEntregador } from './painel';
import { CorridasAvulsas, type CorridaAvulsa } from './corridas-avulsas';

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

  // Dia de Brasília: o servidor roda em UTC, e às 21h o "hoje" virava amanhã.
  const inicioDoDia = inicioDoDiaEmBrasilia();

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

  // Corridas avulsas: as abertas da cidade (ou só da loja, para entregador de
  // loja) e as que já são dele.
  const selectDaAvulsa = {
    id: true,
    status: true,
    customerName: true,
    customerPhone: true,
    street: true,
    number: true,
    neighborhood: true,
    referencePoint: true,
    notes: true,
    feeCents: true,
    collectCents: true,
    store: {
      select: {
        name: true,
        phone: true,
        whatsapp: true,
        street: true,
        number: true,
        neighborhood: true,
      },
    },
  } as const;
  const [avulsasAbertas, avulsasMinhas, ganhosAvulsos] = await Promise.all([
    prisma.errand.findMany({
      where: {
        status: 'OPEN',
        courierId: null,
        cityId: entregador.cityId,
        ...(entregador.storeId ? { storeId: entregador.storeId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: selectDaAvulsa,
    }),
    prisma.errand.findMany({
      where: { courierId: entregador.id, status: { in: ['ACCEPTED', 'PICKED_UP'] } },
      orderBy: { acceptedAt: 'asc' },
      select: selectDaAvulsa,
    }),
    prisma.errand.aggregate({
      where: { courierId: entregador.id, status: 'DELIVERED', deliveredAt: { gte: inicioDoDia } },
      _sum: { feeCents: true },
      _count: true,
    }),
  ]);

  const paraTela = (corrida: (typeof avulsasAbertas)[number]): CorridaAvulsa => ({
    id: corrida.id,
    status: corrida.status as CorridaAvulsa['status'],
    loja: {
      nome: corrida.store.name,
      endereco: `${corrida.store.street}${corrida.store.number ? `, ${corrida.store.number}` : ''} — ${corrida.store.neighborhood}`,
      telefone: corrida.store.whatsapp ?? corrida.store.phone,
    },
    cliente: corrida.customerName,
    telefoneDoCliente: corrida.customerPhone,
    endereco: `${corrida.street}${corrida.number ? `, ${corrida.number}` : ''} — ${corrida.neighborhood}`,
    referencia: corrida.referencePoint,
    recado: corrida.notes,
    feeCents: corrida.feeCents,
    collectCents: corrida.collectCents,
  });

  return (
    <PainelDoEntregador
      entregador={{
        nome: entregador.user.name,
        online: entregador.isOnline,
        entregasTotais: entregador.deliveryCount,
        nota: Number(entregador.ratingAverage),
        daLoja: entregador.storeId != null,
      }}
      // O total do dia soma as entregas do app e as corridas avulsas: para
      // quem vive de entrega, o número de cima precisa ser o dia inteiro.
      ganhosDeHoje={{
        centavos: (ganhos._sum.earningCents ?? 0) + (ganhosAvulsos._sum.feeCents ?? 0),
        entregas: ganhos._count + ganhosAvulsos._count,
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
    >
      <CorridasAvulsas
        abertas={avulsasAbertas.map(paraTela)}
        minhas={avulsasMinhas.map(paraTela)}
        ganhosDeHoje={{
          centavos: ganhosAvulsos._sum.feeCents ?? 0,
          corridas: ganhosAvulsos._count,
        }}
      />
    </PainelDoEntregador>
  );
}
