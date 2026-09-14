import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { Button, Card, CardContent } from '@rapidinho/ui';
import { ListaDeEnderecos } from './lista';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus endereços' };

export default async function EnderecosPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?destino=/enderecos');

  const [enderecos, cidades] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        label: true,
        street: true,
        number: true,
        complement: true,
        neighborhood: true,
        referencePoint: true,
        zipCode: true,
        isDefault: true,
        city: { select: { name: true, state: true } },
      },
    }),
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, state: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Meus endereços</h1>
        <Button asChild>
          <Link href="/enderecos/novo">Novo</Link>
        </Button>
      </header>

      {enderecos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="font-semibold">Nenhum endereço cadastrado.</p>
            <p className="text-muted-foreground mt-1">
              Sem CEP e sem número tudo bem — o que importa é o ponto de referência.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ListaDeEnderecos enderecos={enderecos} cidades={cidades} />
      )}
    </main>
  );
}
