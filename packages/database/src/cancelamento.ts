import type { Prisma } from '../generated/client';

/**
 * Desfaz o que um pedido reservou quando ele é cancelado ou recusado.
 *
 * Três coisas ficam presas a um pedido e precisam voltar juntas, dentro da
 * mesma transação do cancelamento:
 *
 * - o estoque baixado no checkout (senão cada cancelamento "some" com
 *   unidades que a loja ainda tem na prateleira);
 * - a corrida do entregador (senão ele continua vendo uma entrega que não
 *   existe mais);
 * - o cupom usado (o pedido não aconteceu; o cliente pode usar de novo e o
 *   limite de uso da campanha volta).
 *
 * Todo caminho de cancelamento chama esta função — loja, plataforma e
 * expiração de Pix —, para nenhum deles esquecer uma das três.
 */
export async function desfazerReservasDoPedido(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const pedido = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      couponId: true,
      items: { select: { productId: true, quantity: true, weightGrams: true } },
    },
  });
  if (!pedido) return;

  // Estoque: só item por unidade de produto com estoque controlado.
  const porProduto = new Map<string, number>();
  for (const item of pedido.items) {
    if (item.productId && item.weightGrams == null) {
      porProduto.set(item.productId, (porProduto.get(item.productId) ?? 0) + item.quantity);
    }
  }
  for (const [productId, quantidade] of porProduto) {
    await tx.product.updateMany({
      where: { id: productId, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: quantidade } },
    });
  }

  await tx.delivery.updateMany({
    where: { orderId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  if (pedido.couponId) {
    const { count } = await tx.couponRedemption.deleteMany({ where: { orderId } });
    // Só devolve o uso se havia resgate: cancelar duas vezes não pode
    // descontar duas vezes.
    if (count > 0) {
      await tx.coupon.update({
        where: { id: pedido.couponId },
        data: { usageCount: { decrement: 1 } },
      });
    }
  }
}
