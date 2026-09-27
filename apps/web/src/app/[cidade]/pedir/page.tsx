import { notFound } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { MontadorDePedido } from './montador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedir por lista' };

/**
 * Pedido por lista — o botão do meio da barra.
 *
 * Os apps de entrega fazem o cliente escolher a loja antes de saber se ela
 * tem o que ele quer. Aqui a ordem é a da vida real: primeiro a lista, e o
 * app descobre quem atende, quanto fica e em quantas lojas.
 */
export default async function PedirPage({ params }: { params: Promise<{ cidade: string }> }) {
  const { cidade: slug } = await params;

  const [cidade, user] = await Promise.all([
    prisma.city.findFirst({
      where: { slug, isActive: true },
      select: { name: true, slug: true },
    }),
    getCurrentUser(),
  ]);

  if (!cidade) notFound();

  return (
    <main className="mx-auto max-w-lg px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <MontadorDePedido cidade={cidade} logado={user != null} />
    </main>
  );
}
