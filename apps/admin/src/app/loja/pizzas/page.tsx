import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { GerenciadorDePizzas } from './gerenciador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pizzas' };

export default async function PizzasPage() {
  const { store } = await getStoreContext();

  const [tamanhos, sabores, extras] = await Promise.all([
    prisma.pizzaSize.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, description: true, maxFlavors: true, slices: true },
    }),
    prisma.pizzaFlavor.findMany({
      where: { storeId: store.id, isAvailable: true },
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        groupName: true,
        prices: { select: { sizeId: true, priceCents: true } },
      },
    }),
    prisma.pizzaExtra.findMany({
      where: { storeId: store.id, isAvailable: true },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, kind: true, priceCents: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pizzas</h1>
        <p className="text-muted-foreground mt-1">
          Tamanhos, sabores e bordas. O preço fica no cruzamento de sabor com tamanho.
        </p>
      </header>

      <GerenciadorDePizzas
        tamanhos={tamanhos}
        sabores={sabores}
        extras={extras}
        regraDePreco={store.pizzaPricingRule as 'HIGHEST_PRICE' | 'AVERAGE_PRICE'}
      />
    </div>
  );
}
