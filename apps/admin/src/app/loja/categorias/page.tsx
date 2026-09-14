import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { GerenciadorDeCategorias } from './gerenciador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categorias' };

export default async function CategoriasPage() {
  const { store } = await getStoreContext();

  const categorias = await prisma.menuCategory.findMany({
    where: { storeId: store.id },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Categorias do cardápio</h1>
        <p className="text-muted-foreground mt-1">
          A ordem daqui é a ordem que o cliente vê na sua página.
        </p>
      </header>

      <GerenciadorDeCategorias
        categorias={categorias.map((categoria) => ({
          id: categoria.id,
          name: categoria.name,
          description: categoria.description,
          isActive: categoria.isActive,
          produtos: categoria._count.products,
        }))}
      />
    </div>
  );
}
