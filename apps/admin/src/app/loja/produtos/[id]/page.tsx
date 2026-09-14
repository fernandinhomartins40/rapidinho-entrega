import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { FormularioDeProduto } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar produto' };

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { store } = await getStoreContext();
  const { id } = await params;

  // Filtrado pela loja do vínculo: o id de um produto de outra loja resulta
  // em 404, não em "sem permissão" — não confirmamos nem que ele existe.
  const [produto, categorias, gruposDeComplemento] = await Promise.all([
    prisma.product.findFirst({
      where: { id, storeId: store.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        priceCents: true,
        compareAtPriceCents: true,
        categoryId: true,
        imageId: true,
        sellingUnit: true,
        weightStepGrams: true,
        minWeightGrams: true,
        sku: true,
        barcode: true,
        isAvailable: true,
        isFeatured: true,
        stockQuantity: true,
        sortOrder: true,
        image: { select: SELECT_IMAGEM },
        complementGroups: { select: { groupId: true } },
      },
    }),
    prisma.menuCategory.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.complementGroup.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isRequired: true },
    }),
  ]);

  if (!produto) notFound();

  return (
    <div className="space-y-6">
      <header>
        <Link href="/loja/produtos" className="text-muted-foreground text-sm underline">
          ← Voltar para os produtos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{produto.name}</h1>
      </header>

      <FormularioDeProduto
        produto={{
          ...produto,
          imagemUrl: imagemExibivel(produto.image, 'medium').url,
          gruposSelecionados: produto.complementGroups.map((vinculo) => vinculo.groupId),
        }}
        categorias={categorias}
        gruposDeComplemento={gruposDeComplemento}
      />
    </div>
  );
}
