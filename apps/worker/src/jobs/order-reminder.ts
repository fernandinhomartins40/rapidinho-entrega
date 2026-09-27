import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { formatCents } from '@rapidinho/shared';

/**
 * Lembra a equipe da loja de um pedido que ainda não foi aceito.
 *
 * Só avisa se o pedido continua em "Recebido": aceito, recusado ou cancelado
 * nesse meio-tempo, não há o que lembrar. Não decide nada pela loja — cancelar
 * sozinho um pedido parado é regra de negócio que não cabe aqui.
 */
export async function lembrarLojaDoPedido(orderId: string): Promise<void> {
  const pedido = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      customerName: true,
      totalCents: true,
      store: {
        select: {
          name: true,
          staff: {
            where: { isActive: true, user: { status: 'ACTIVE', deletedAt: null } },
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!pedido || pedido.status !== 'RECEIVED') return;

  const minutos = Math.max(1, Math.round((Date.now() - pedido.createdAt.getTime()) / 60_000));
  const painel = process.env.NEXT_PUBLIC_ADMIN_URL;

  await Promise.allSettled(
    pedido.store.staff.map(({ userId }) =>
      notificarUsuario({
        userId,
        title: `Pedido #${pedido.number} esperando você`,
        body: `${pedido.customerName} · ${formatCents(pedido.totalCents)} — há ${minutos} min sem aceite em ${pedido.store.name}. Abra o painel para aceitar.`,
        url: painel ? `${painel}/loja/pedidos` : '/loja/pedidos',
        canais: ['PUSH', 'WHATSAPP'],
        entity: { type: 'Order', id: pedido.id },
        tag: `aceite-${pedido.id}`,
      }),
    ),
  );
}
