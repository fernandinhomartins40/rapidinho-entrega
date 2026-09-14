import { notFound, redirect } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { FormularioDeAvaliacao } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Avaliar pedido' };

export default async function AvaliarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) redirect(`/entrar?destino=/pedidos/${id}/avaliar`);

  const pedido = await prisma.order.findFirst({
    where: { id, userId: user.id, status: 'DELIVERED' },
    select: {
      id: true,
      number: true,
      store: { select: { name: true } },
      delivery: { select: { courier: { select: { user: { select: { name: true } } } } } },
      reviews: { select: { id: true } },
    },
  });

  if (!pedido) notFound();
  if (pedido.reviews.length > 0) redirect(`/pedidos/${id}`);

  return (
    <main className="mx-auto max-w-lg px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Como foi seu pedido?</h1>
      <p className="text-muted-foreground mt-1">
        Pedido #{pedido.number} · {pedido.store.name}
      </p>

      <FormularioDeAvaliacao
        orderId={pedido.id}
        lojaNome={pedido.store.name}
        entregadorNome={pedido.delivery?.courier?.user.name ?? null}
      />
    </main>
  );
}
