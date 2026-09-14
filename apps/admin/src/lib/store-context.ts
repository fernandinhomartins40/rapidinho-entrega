import { prisma } from '@rapidinho/database';
import { requireStoreAccess, type StoreAccess } from '@rapidinho/auth';
import { isStoreOpen, type StoreOpenResult } from '@rapidinho/shared';

/**
 * Contexto da loja para as telas do painel.
 *
 * Carrega uma vez o que quase toda tela precisa — identidade, se está aberta
 * agora e quantos pedidos estão em aberto — em vez de cada página repetir as
 * mesmas três consultas.
 */

export interface StoreContext {
  access: StoreAccess;
  store: {
    id: string;
    name: string;
    slug: string;
    segment: string;
    status: string;
    isPausedUntil: Date | null;
    pauseReason: string | null;
    soundAlertEnabled: boolean;
    autoAcceptOrders: boolean;
    pizzaPricingRule: string;
    cityId: string;
  };
  abertura: StoreOpenResult;
  pedidosAbertos: number;
}

/** Status que ainda exigem ação do lojista. */
export const STATUS_EM_ABERTO = ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'] as const;

export async function getStoreContext(): Promise<StoreContext> {
  const access = await requireStoreAccess();

  const [store, pedidosAbertos] = await Promise.all([
    prisma.store.findUniqueOrThrow({
      where: { id: access.storeId },
      select: {
        id: true,
        name: true,
        slug: true,
        segment: true,
        status: true,
        cityId: true,
        isPausedUntil: true,
        pauseReason: true,
        soundAlertEnabled: true,
        autoAcceptOrders: true,
        pizzaPricingRule: true,
        hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
        closures: {
          // Só os fechamentos que ainda valem: o histórico não muda o "aberto
          // agora" e cresce para sempre.
          where: { endsAt: { gte: new Date() } },
          select: { startsAt: true, endsAt: true, reason: true },
        },
      },
    }),
    prisma.order.count({
      where: { storeId: access.storeId, status: { in: [...STATUS_EM_ABERTO] } },
    }),
  ]);

  const { hours, closures, ...dados } = store;

  return {
    access,
    store: dados,
    abertura: isStoreOpen({
      hours,
      closures,
      pausedUntil: store.isPausedUntil,
      pauseReason: store.pauseReason,
    }),
    pedidosAbertos,
  };
}
