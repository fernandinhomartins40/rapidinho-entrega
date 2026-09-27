import { prisma } from '@rapidinho/database';
import { inicioDoDia } from '@rapidinho/shared';
import { getStoreContext } from '@/lib/store-context';
import { ChamarEntregador } from './chamar';
import { ListaDeCorridas, type CorridaNaTela } from './lista';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chamar entregador' };

/**
 * Chamar entregador para qualquer entrega — não só as do app.
 *
 * O valor sugerido é o da entrega da loja (ou o padrão da cidade quando a loja
 * cobra por distância/bairro): é o que a cidade já pratica, e a loja ajusta se
 * a corrida for mais longa.
 */
export default async function CorridasPage() {
  const { store } = await getStoreContext();

  const [loja, corridas] = await Promise.all([
    prisma.store.findUniqueOrThrow({
      where: { id: store.id },
      select: {
        deliveryFeeMode: true,
        deliveryFeeCents: true,
        city: { select: { defaultDeliveryFeeCents: true } },
      },
    }),
    prisma.errand.findMany({
      where: {
        storeId: store.id,
        OR: [
          { createdAt: { gte: inicioDoDia() } },
          { status: { in: ['OPEN', 'ACCEPTED', 'PICKED_UP'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        customerName: true,
        street: true,
        number: true,
        neighborhood: true,
        feeCents: true,
        collectCents: true,
        createdAt: true,
        courier: { select: { user: { select: { name: true, phone: true } } } },
      },
    }),
  ]);

  const sugerido =
    loja.deliveryFeeMode === 'FIXED' && loja.deliveryFeeCents > 0
      ? loja.deliveryFeeCents
      : loja.city.defaultDeliveryFeeCents;

  const naTela: CorridaNaTela[] = corridas.map((corrida) => ({
    id: corrida.id,
    status: corrida.status,
    cliente: corrida.customerName,
    endereco: `${corrida.street}${corrida.number ? `, ${corrida.number}` : ''} — ${corrida.neighborhood}`,
    feeCents: corrida.feeCents,
    collectCents: corrida.collectCents,
    criadaEm: corrida.createdAt.toISOString(),
    entregador: corrida.courier
      ? { nome: corrida.courier.user.name ?? 'Entregador', telefone: corrida.courier.user.phone }
      : null,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Chamar entregador</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Para qualquer entrega — do balcão, do WhatsApp, do telefone. A corrida vai para os
          entregadores da cidade, o primeiro que aceitar vem buscar, e você paga direto a ele o
          valor combinado aqui. Sem entregador fixo, sem custo parado.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <ChamarEntregador valorSugeridoCents={sugerido} />
        <ListaDeCorridas corridas={naTela} />
      </div>
    </div>
  );
}
