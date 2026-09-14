import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { Badge, Button, Card, CardContent } from '@rapidinho/ui';
import {
  formatCents,
  isActiveStatus,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from '@rapidinho/shared';
import { PedirNovamente } from './pedir-novamente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus pedidos' };

export default async function PedidosPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?destino=/pedidos');

  const pedidos = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      totalCents: true,
      storeId: true,
      store: { select: { name: true, slug: true } },
      items: { select: { productName: true, quantity: true } },
    },
  });

  if (pedidos.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-5 py-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Receipt className="text-muted-foreground h-10 w-10" aria-hidden />
            <p className="font-semibold">Você ainda não fez nenhum pedido.</p>
            <Button asChild>
              <Link href="/">Ver lojas</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const emAndamento = pedidos.filter((pedido) => isActiveStatus(pedido.status as OrderStatus));
  const anteriores = pedidos.filter((pedido) => !isActiveStatus(pedido.status as OrderStatus));

  return (
    <main className="mx-auto max-w-lg space-y-6 px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Meus pedidos</h1>

      {emAndamento.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Em andamento</h2>
          <ul className="space-y-2">
            {emAndamento.map((pedido) => (
              <li key={pedido.id}>
                <Link href={`/pedidos/${pedido.id}`}>
                  <Card className="hover:border-primary transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{pedido.store.name}</p>
                          <p className="text-muted-foreground truncate text-sm">
                            {pedido.items
                              .map((item) => `${item.quantity}× ${item.productName}`)
                              .join(', ')}
                          </p>
                        </div>
                        <Badge variant="warning">
                          {ORDER_STATUS_LABEL[pedido.status as OrderStatus]}
                        </Badge>
                      </div>
                      <p className="mt-2 font-semibold">{formatCents(pedido.totalCents)}</p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {anteriores.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Anteriores</h2>
          <ul className="space-y-2">
            {anteriores.map((pedido) => (
              <li key={pedido.id}>
                <Card>
                  <CardContent className="py-4">
                    <Link href={`/pedidos/${pedido.id}`} className="block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{pedido.store.name}</p>
                          <p className="text-muted-foreground text-sm">
                            {pedido.createdAt.toLocaleDateString('pt-BR')} ·{' '}
                            {ORDER_STATUS_LABEL[pedido.status as OrderStatus]}
                          </p>
                          <p className="text-muted-foreground truncate text-sm">
                            {pedido.items
                              .map((item) => `${item.quantity}× ${item.productName}`)
                              .join(', ')}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold">
                          {formatCents(pedido.totalCents)}
                        </span>
                      </div>
                    </Link>

                    {pedido.status === 'DELIVERED' ? <PedirNovamente orderId={pedido.id} /> : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
