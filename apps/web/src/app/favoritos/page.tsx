import Link from 'next/link';
import { Heart } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { Button } from '@rapidinho/ui';
import { CartaoDeLoja } from '@/components/app/cartao-de-loja';
import { produtosDasLojas } from '@/lib/produtos-da-loja';
import { paraLojaNaVitrine, selectDaLojaNaVitrine } from '@/lib/vitrine';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Favoritos' };

/**
 * As lojas marcadas com o coração, abertas primeiro — é a lista de quem já
 * sabe onde quer pedir.
 */
export default async function FavoritosPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-5 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Favoritos</h1>
        <Vazio
          texto="Entre com seu telefone para guardar as lojas que você mais pede."
          acao={{ href: '/entrar?destino=/favoritos', rotulo: 'Entrar' }}
        />
      </main>
    );
  }

  const favoritos = await prisma.favoriteStore.findMany({
    where: { userId: user.id, store: { status: 'ACTIVE', deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    select: { store: { select: selectDaLojaNaVitrine(new Date()) } },
  });

  const produtos = await produtosDasLojas(
    favoritos.map(({ store }) => ({
      id: store.id,
      slug: store.slug,
      segmento: store.segment,
      cidadeSlug: store.city.slug,
    })),
  );

  const lojas = favoritos
    .map(({ store }) => ({
      cidade: store.city.slug,
      loja: { ...paraLojaNaVitrine(store), produtos: produtos.get(store.id) ?? [] },
    }))
    .sort((a, b) => Number(b.loja.aberta) - Number(a.loja.aberta));

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Favoritos</h1>

      {lojas.length === 0 ? (
        <Vazio
          texto="Toque no coração de uma loja para ela aparecer aqui."
          acao={{ href: '/app', rotulo: 'Ver lojas' }}
        />
      ) : (
        <ul className="space-y-3">
          {lojas.map(({ cidade, loja }) => (
            <li key={loja.id}>
              <CartaoDeLoja loja={loja} cidadeSlug={cidade} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Vazio({ texto, acao }: { texto: string; acao: { href: string; rotulo: string } }) {
  return (
    <div className="bg-card mt-6 flex flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center">
      <span className="bg-accent flex h-14 w-14 items-center justify-center rounded-full">
        <Heart className="text-primary-text h-7 w-7" aria-hidden />
      </span>
      <p className="text-muted-foreground">{texto}</p>
      <Button asChild>
        <Link href={acao.href}>{acao.rotulo}</Link>
      </Button>
    </div>
  );
}
