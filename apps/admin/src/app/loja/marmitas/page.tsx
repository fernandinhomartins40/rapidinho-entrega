import { prisma } from '@rapidinho/database';
import { diaDaSemanaLocal, marmitaForaDoCardapio } from '@rapidinho/shared';
import { getStoreContext } from '@/lib/store-context';
import { GerenciadorDeMarmitas } from './gerenciador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marmitas' };

export default async function MarmitasPage() {
  const { store } = await getStoreContext();
  const agora = new Date();

  const [tamanhos, itens] = await Promise.all([
    prisma.marmitaSize.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: { id: true, name: true, description: true, priceCents: true, maxMisturas: true },
    }),
    prisma.marmitaItem.findMany({
      where: { storeId: store.id, isAvailable: true },
      orderBy: [{ kind: 'asc' }, { groupName: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        kind: true,
        groupName: true,
        priceCents: true,
        weekdays: true,
        isAvailable: true,
        pausedUntil: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Marmitas</h1>
        <p className="text-muted-foreground mt-1">
          Cadastre os tamanhos e o cardápio da semana uma vez. No dia, é só marcar o que acabou. O
          cliente monta a marmita e pede sem, pouco ou mais de cada item.
        </p>
      </header>

      <GerenciadorDeMarmitas
        hoje={diaDaSemanaLocal(agora)}
        tamanhos={tamanhos}
        itens={itens.map(({ pausedUntil, isAvailable, ...item }) => ({
          ...item,
          // Pausa vencida é item no ar: só conta a que ainda vale.
          acabouHoje: pausedUntil != null && pausedUntil > agora,
          noCardapioDeHoje: !marmitaForaDoCardapio(
            { isAvailable, pausedUntil, weekdays: item.weekdays },
            agora,
          ),
        }))}
      />
    </div>
  );
}
