import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { GerenciadorDePromocoes } from './gerenciador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Promoções da loja' };

export default async function PromocoesPage() {
  const { store } = await getStoreContext();

  const [promocoes, produtos] = await Promise.all([
    prisma.storePromotion.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageId: true,
        isActive: true,
        endsAt: true,
        image: { select: SELECT_IMAGEM },
        products: { orderBy: { sortOrder: 'asc' }, select: { productId: true } },
      },
    }),
    prisma.product.findMany({
      where: { storeId: store.id, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, priceCents: true, compareAtPriceCents: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Promoções da loja</h1>
        <p className="text-muted-foreground mt-1">
          Crie banners para o topo da sua página no app e escolha os produtos de cada um. Para o
          cliente ver o preço riscado, preencha o preço &quot;de&quot; no cadastro do produto.
        </p>
      </header>

      <GerenciadorDePromocoes
        produtos={produtos}
        promocoes={promocoes.map((promocao) => ({
          id: promocao.id,
          title: promocao.title,
          subtitle: promocao.subtitle,
          imageId: promocao.imageId,
          imagemUrl: imagemExibivel(promocao.image, 'medium').url,
          isActive: promocao.isActive,
          endsAt: promocao.endsAt?.toISOString() ?? null,
          productIds: promocao.products.map((item) => item.productId),
        }))}
      />
    </div>
  );
}
