import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { EditorDeEntrega } from './editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrega' };

export default async function EntregaPage() {
  const { store } = await getStoreContext();

  const [loja, zonas] = await Promise.all([
    prisma.store.findUniqueOrThrow({
      where: { id: store.id },
      select: {
        deliveryFeeMode: true,
        deliveryFeeCents: true,
        pricePerKmCents: true,
        freeDeliveryAboveCents: true,
        deliveryRadiusMeters: true,
        minOrderCents: true,
        avgPrepTimeMinutes: true,
        avgDeliveryTimeMinutes: true,
        acceptsPickup: true,
      },
    }),
    prisma.deliveryZone.findMany({
      where: { storeId: store.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, feeCents: true, minOrderCents: true, estimatedMinutes: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Entrega</h1>
        <p className="text-muted-foreground mt-1">
          Quanto você cobra, até onde entrega e em quanto tempo.
        </p>
      </header>

      <EditorDeEntrega loja={loja} zonas={zonas} />
    </div>
  );
}
