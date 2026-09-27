import { notFound } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { pratosDaCidade } from '@/lib/pratos';
import { participanteAtual } from '../../actions';
import { EscolhaEmGrupo } from './grupo';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Decidir junto',
  // O link é para quem foi convidado, não para buscador.
  robots: { index: false },
};

export default async function GrupoPage({
  params,
}: {
  params: Promise<{ cidade: string; id: string }>;
}) {
  const { cidade: slug, id } = await params;

  const sessao = await prisma.cravingSession.findFirst({
    where: { id, city: { slug, isActive: true } },
    select: {
      id: true,
      items: true,
      expiresAt: true,
      cityId: true,
      city: { select: { name: true } },
    },
  });

  if (!sessao) notFound();

  // Os pratos na ordem do baralho congelado. Loja que fechou depois que a
  // sessão foi criada sai do baralho — não adianta dar match no que não
  // entrega agora.
  const disponiveis = new Map(
    (await pratosDaCidade(sessao.cityId)).map((prato) => [prato.chave, prato] as const),
  );
  const pratos = (sessao.items as string[])
    .map((chave) => disponiveis.get(chave))
    .filter((prato) => prato != null);

  return (
    <main className="mx-auto max-w-lg px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <EscolhaEmGrupo
        sessaoId={sessao.id}
        cidade={{ name: sessao.city.name, slug }}
        pratos={pratos}
        expirada={sessao.expiresAt <= new Date()}
        participante={await participanteAtual()}
      />
    </main>
  );
}
