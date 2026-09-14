import { notFound, redirect } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { orderRealtime } from '@/lib/realtime';
import { AcompanhamentoDoPedido } from './acompanhamento';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acompanhar pedido' };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) redirect(`/entrar?destino=/pedidos/${id}`);

  // Filtrado pelo dono: o pedido de outra pessoa dá 404, não "sem permissão" —
  // não confirmamos nem que ele existe.
  const pedido = await prisma.order.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      number: true,
      status: true,
      type: true,
      createdAt: true,
      estimatedPrepMinutes: true,
      estimatedReadyAt: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      discountCents: true,
      totalCents: true,
      notes: true,
      cancelReason: true,
      addressSnapshot: true,
      store: {
        select: {
          name: true,
          slug: true,
          phone: true,
          whatsapp: true,
          city: { select: { slug: true } },
        },
      },
      payment: { select: { method: true, status: true, changeForCents: true } },
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          weightGrams: true,
          totalCents: true,
          notes: true,
          pizzaSizeName: true,
          pizzaExtraName: true,
          complements: { select: { id: true, optionName: true, quantity: true } },
          flavors: { select: { id: true, flavorName: true } },
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, status: true, note: true, createdAt: true },
      },
      delivery: {
        select: {
          status: true,
          courier: {
            select: {
              vehicleType: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      },
      reviews: { select: { id: true } },
    },
  });

  if (!pedido) notFound();

  return (
    <AcompanhamentoDoPedido
      pedido={{
        ...pedido,
        createdAt: pedido.createdAt.toISOString(),
        estimatedReadyAt: pedido.estimatedReadyAt?.toISOString() ?? null,
        statusHistory: pedido.statusHistory.map((linha) => ({
          ...linha,
          createdAt: linha.createdAt.toISOString(),
        })),
        jaAvaliado: pedido.reviews.length > 0,
      }}
      realtime={orderRealtime(pedido.id, user.id)}
    />
  );
}
