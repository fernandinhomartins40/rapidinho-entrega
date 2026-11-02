import { NextResponse } from 'next/server';
import { getCurrentUser } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import {
  avisoDeStatusAoCliente,
  isActiveStatus,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from '@rapidinho/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Pedido encerrado há pouco ainda volta, para o app avisar "foi entregue". */
const JANELA_DO_ENCERRADO_MS = 15 * 60_000;

/**
 * Pedidos que o app acompanha com a tela fechada.
 *
 * O APK consulta aqui a cada 30 segundos enquanto há pedido em andamento e
 * avisa o cliente quando o status muda. Sem pedido em andamento, ele para: o
 * custo é zero fora dos minutos em que a pessoa espera a entrega.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ativo: false, pedidos: [] }, { status: 401 });

  const pedidos = await prisma.order.findMany({
    where: {
      userId: user.id,
      OR: [
        { status: { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED'] } },
        { updatedAt: { gte: new Date(Date.now() - JANELA_DO_ENCERRADO_MS) } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, number: true, status: true },
  });

  const lista = pedidos.map((pedido) => {
    const status = pedido.status as OrderStatus;
    const aviso = avisoDeStatusAoCliente(pedido.id, status);

    return {
      id: pedido.id,
      numero: pedido.number,
      status,
      rotulo: ORDER_STATUS_LABEL[status],
      mensagem: aviso.body,
      caminho: aviso.url,
      ativo: isActiveStatus(status),
    };
  });

  return NextResponse.json(
    { ativo: lista.some((pedido) => pedido.ativo), pedidos: lista },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
