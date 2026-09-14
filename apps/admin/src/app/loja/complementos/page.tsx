import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { GerenciadorDeComplementos } from './gerenciador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Complementos' };

export default async function ComplementosPage() {
  const { store } = await getStoreContext();

  const grupos = await prisma.complementGroup.findMany({
    where: { storeId: store.id, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      isRequired: true,
      minChoices: true,
      maxChoices: true,
      allowRepeat: true,
      isActive: true,
      _count: { select: { products: true } },
      options: {
        where: { isAvailable: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, description: true, priceCents: true, isAvailable: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Complementos</h1>
        <p className="text-muted-foreground mt-1">
          &quot;Escolha o ponto da carne&quot;, &quot;adicionais&quot;, &quot;qual o
          acompanhamento&quot;. Crie o grupo uma vez e use em quantos produtos quiser.
        </p>
      </header>

      <GerenciadorDeComplementos
        grupos={grupos.map((grupo) => ({
          id: grupo.id,
          name: grupo.name,
          description: grupo.description,
          isRequired: grupo.isRequired,
          minChoices: grupo.minChoices,
          maxChoices: grupo.maxChoices,
          allowRepeat: grupo.allowRepeat,
          isActive: grupo.isActive,
          produtos: grupo._count.products,
          options: grupo.options,
        }))}
      />
    </div>
  );
}
