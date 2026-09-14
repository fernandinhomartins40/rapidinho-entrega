import Link from 'next/link';
import { prisma } from '@rapidinho/database';
import { Card, CardContent } from '@rapidinho/ui';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { getStoreContext } from '@/lib/store-context';
import { CadastroRapido } from './cadastro-rapido';
import { ListaDeProdutos } from './lista-de-produtos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Produtos' };

interface Busca {
  q?: string;
  categoria?: string;
  situacao?: string;
}

async function carregar(storeId: string, busca: Busca) {
  const termo = busca.q?.trim();

  const [produtos, categorias, total] = await Promise.all([
    prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
        ...(termo
          ? {
              OR: [
                { name: { contains: termo, mode: 'insensitive' as const } },
                { sku: { contains: termo, mode: 'insensitive' as const } },
                { barcode: { contains: termo, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(busca.categoria ? { categoryId: busca.categoria } : {}),
        ...(busca.situacao === 'pausados' ? { isAvailable: false } : {}),
        ...(busca.situacao === 'sem-estoque' ? { stockQuantity: 0 } : {}),
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      // Mercado tem centenas de itens; a lista completa numa página só é
      // pesada para o celular do lojista.
      take: 200,
      select: {
        id: true,
        name: true,
        priceCents: true,
        isAvailable: true,
        pausedUntil: true,
        stockQuantity: true,
        sellingUnit: true,
        sku: true,
        category: { select: { id: true, name: true } },
        image: { select: SELECT_IMAGEM },
      },
    }),
    prisma.menuCategory.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.product.count({ where: { storeId, deletedAt: null } }),
  ]);

  return { produtos, categorias, total };
}

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const { store } = await getStoreContext();
  const busca = await searchParams;
  const { produtos, categorias, total } = await carregar(store.id, busca);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground mt-1">
            {total} {total === 1 ? 'item no cardápio' : 'itens no cardápio'}
          </p>
        </div>
        <Link href="/loja/produtos/importar" className="text-sm font-semibold underline">
          Importar planilha
        </Link>
      </header>

      <CadastroRapido categorias={categorias} />

      {total === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="font-semibold">Seu cardápio está vazio.</p>
            <p className="text-muted-foreground mt-1">
              Cadastre o primeiro produto no formulário acima — leva menos de meio minuto. Se você
              já tem tudo numa planilha,{' '}
              <Link href="/loja/produtos/importar" className="underline">
                importe de uma vez
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <ListaDeProdutos
          produtos={produtos.map((produto) => ({
            ...produto,
            pausedUntil: produto.pausedUntil?.toISOString() ?? null,
            imagem: imagemExibivel(produto.image),
          }))}
          categorias={categorias}
          busca={busca}
        />
      )}

      {produtos.length === 200 ? (
        <p className="text-muted-foreground text-sm">
          Mostrando os 200 primeiros. Use a busca para encontrar um item específico.
        </p>
      ) : null}
    </div>
  );
}
