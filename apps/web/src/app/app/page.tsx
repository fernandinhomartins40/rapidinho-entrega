import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRight, MapPin, Store } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { Logotipo } from '@/components/marca/logo';
import { COOKIE_DA_CIDADE } from '@/lib/cidade-lembrada';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Escolha sua cidade',
  // Porta de entrada do app instalado: não é página para buscador.
  robots: { index: false },
};

/**
 * Entrada do aplicativo (o `start_url` do PWA).
 *
 * A landing em `/` é a vitrine da marca para quem ainda não conhece; quem abre
 * o app instalado quer pedir. Então aqui ninguém vê apresentação:
 *
 * 1. cidade lembrada (cookie) e ainda ativa → vai direto para ela;
 * 2. uma cidade só em operação → vai para ela, sem pergunta de uma resposta;
 * 3. senão → escolhe a cidade, numa tela com cara de app.
 *
 * `?trocar=1` pula os atalhos: é o botão de cidade no topo da vitrine.
 */
export default async function EntradaDoApp({
  searchParams,
}: {
  searchParams: Promise<{ trocar?: string }>;
}) {
  const { trocar } = await searchParams;

  const cidades = await prisma.city.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      state: true,
      slug: true,
      _count: { select: { stores: { where: { status: 'ACTIVE', deletedAt: null } } } },
    },
  });

  if (!trocar) {
    const lembrada = (await cookies()).get(COOKIE_DA_CIDADE)?.value;
    if (lembrada && cidades.some((cidade) => cidade.slug === lembrada)) redirect(`/${lembrada}`);
    if (cidades.length === 1 && cidades[0]) redirect(`/${cidades[0].slug}`);
  }

  return (
    <main className="min-h-dvh">
      <header className="bg-brand-deep relative overflow-hidden px-5 pb-8 pt-6">
        <div className="bg-radial-glow absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-lg">
          <Logotipo className="h-9 w-auto" priority />
          <h1 className="mt-6 text-2xl font-bold text-white">Onde você está?</h1>
          <p className="mt-1 text-white/75">Mostramos as lojas que entregam na sua cidade.</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 py-6">
        {cidades.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border p-5 text-center">
            Ainda estamos chegando. Volte em breve!
          </p>
        ) : (
          <ul className="space-y-3">
            {cidades.map((cidade) => (
              <li key={cidade.id}>
                <Link
                  href={`/${cidade.slug}`}
                  className="border-input hover:border-primary hover:bg-accent focus-visible:ring-ring min-h-touch group flex items-center justify-between gap-3 rounded-xl border-2 p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="bg-primary/12 text-primary-text flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <MapPin className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold">
                        {cidade.name}
                        <span className="text-muted-foreground font-normal"> — {cidade.state}</span>
                      </span>
                      <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
                        <Store className="h-3.5 w-3.5" aria-hidden />
                        {cidade._count.stores === 0
                          ? 'Em breve'
                          : `${cidade._count.stores} ${cidade._count.stores === 1 ? 'loja' : 'lojas'}`}
                      </span>
                    </span>
                  </span>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-primary-text h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Quem mora onde ainda não chegamos não pode sair daqui sem porta. */}
        <Link
          href="/minha-cidade"
          className="hover:border-primary mt-6 flex items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors"
        >
          <span className="bg-primary/12 text-primary-text flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Minha cidade não está aqui</span>
            <span className="text-muted-foreground block text-sm">
              Peça o Rapidinho — com loja ou moto, venha junto.
            </span>
          </span>
          <ArrowRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
        </Link>
      </div>
    </main>
  );
}
