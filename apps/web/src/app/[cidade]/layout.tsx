import { notFound } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { BarraInferior } from '@/components/app/barra-inferior';
import { contarItensDoCarrinho } from '@/lib/cart';

export const dynamic = 'force-dynamic';

export default async function CidadeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cidade: string }>;
}) {
  const { cidade: slug } = await params;

  const [cidade, user] = await Promise.all([
    prisma.city.findFirst({
      where: { slug, isActive: true },
      select: { id: true, slug: true },
    }),
    getCurrentUser(),
  ]);

  if (!cidade) notFound();

  const itensNoCarrinho = user ? await contarItensDoCarrinho(user.id) : 0;

  return (
    <>
      {/* A margem inferior reserva o espaço da barra fixa: sem ela o último
          item da lista fica embaixo da navegação e não dá para tocar. */}
      <div className="pb-24">{children}</div>
      <BarraInferior cidadeSlug={cidade.slug} itensNoCarrinho={itensNoCarrinho} />
    </>
  );
}
