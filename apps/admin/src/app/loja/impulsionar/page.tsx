import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { Planos } from './planos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plano e impulsionamento' };

export default async function ImpulsionarPage() {
  const { store, access } = await getStoreContext();

  const [planos, pacotes, assinatura, boosts] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        monthlyPriceCents: true,
        commissionRate: true,
        maxProducts: true,
        maxPhotos: true,
        features: true,
        trialDays: true,
      },
    }),
    prisma.boostPackage.findMany({
      where: { isActive: true },
      orderBy: { priceCents: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        placement: true,
        priceCents: true,
        durationDays: true,
      },
    }),
    prisma.storeSubscription.findUnique({
      where: { storeId: store.id },
      select: { planId: true, status: true, currentPeriodEnd: true },
    }),
    prisma.storeBoost.findMany({
      where: { storeId: store.id, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        impressions: true,
        clicks: true,
        conversions: true,
        package: { select: { name: true, placement: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Plano e impulsionamento</h1>
        <p className="text-muted-foreground mt-1">
          O plano define a comissão por pedido. O impulsionamento coloca sua loja em destaque.
        </p>
      </header>

      <Planos
        planos={planos.map((plano) => ({
          ...plano,
          commissionRate: Number(plano.commissionRate),
          features: Array.isArray(plano.features) ? (plano.features as string[]) : [],
        }))}
        pacotes={pacotes}
        assinatura={
          assinatura
            ? {
                planId: assinatura.planId,
                status: assinatura.status,
                fimDoPeriodo: assinatura.currentPeriodEnd?.toISOString() ?? null,
              }
            : null
        }
        boosts={boosts.map((boost) => ({
          id: boost.id,
          status: boost.status,
          nome: boost.package.name,
          posicao: boost.package.placement,
          inicio: boost.startsAt.toISOString(),
          fim: boost.endsAt.toISOString(),
          impressoes: boost.impressions,
          cliques: boost.clicks,
          conversoes: boost.conversions,
        }))}
        podeContratar={access.staffRole === 'OWNER' || access.isPlatformAdmin}
      />
    </div>
  );
}
