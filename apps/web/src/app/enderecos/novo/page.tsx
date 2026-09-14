import { redirect } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { FormularioDeEndereco } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Novo endereço' };

export default async function NovoEnderecoPage({
  searchParams,
}: {
  searchParams: Promise<{ cidade?: string; voltar?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?destino=/enderecos/novo');

  const { cidade, voltar } = await searchParams;

  const cidades = await prisma.city.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      state: true,
      neighborhoods: { select: { id: true, name: true } },
    },
  });

  return (
    <main className="mx-auto max-w-lg px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Novo endereço</h1>
      <p className="text-muted-foreground mt-1">
        Não tem CEP nem número? Sem problema. O ponto de referência é o que garante a entrega.
      </p>

      <FormularioDeEndereco
        cidades={cidades}
        cidadePadrao={cidade ?? cidades[0]?.id ?? ''}
        voltar={voltar ?? '/enderecos'}
      />
    </main>
  );
}
