import { NextResponse } from 'next/server';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { detalharPedidoDoApp } from '@rapidinho/services/regras';
import { naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const GET = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  const { id } = await params;

  const pedido = await detalharPedidoDoApp(user.id, id);
  if (!pedido) throw naoEncontrado('Pedido não encontrado.');

  return NextResponse.json(pedido);
});
