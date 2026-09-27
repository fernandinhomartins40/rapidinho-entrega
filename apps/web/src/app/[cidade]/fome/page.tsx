import { notFound } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { pratosDaCidade } from '@/lib/pratos';
import { Baralho } from './baralho';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tô com fome' };

/**
 * Para quem abre o app sem saber o que quer comer: um prato por vez, das
 * lojas abertas agora, e três finalistas no fim.
 */
export default async function FomePage({ params }: { params: Promise<{ cidade: string }> }) {
  const { cidade: slug } = await params;

  const [cidade, user] = await Promise.all([
    prisma.city.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true },
    }),
    getCurrentUser(),
  ]);

  if (!cidade) notFound();

  const pratos = await pratosDaCidade(cidade.id, { userId: user?.id ?? null });

  return (
    <main className="mx-auto max-w-lg px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {pratos.length === 0 ? (
        <div className="bg-card mt-10 rounded-3xl border p-8 text-center">
          <p className="text-4xl" aria-hidden>
            😴
          </p>
          <p className="mt-3 font-bold">Nenhuma loja de comida aberta agora em {cidade.name}.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Volte mais tarde — ou veja mercados e farmácias na tela inicial.
          </p>
        </div>
      ) : (
        <Baralho cidade={{ name: cidade.name, slug: cidade.slug }} pratos={pratos} />
      )}
    </main>
  );
}
