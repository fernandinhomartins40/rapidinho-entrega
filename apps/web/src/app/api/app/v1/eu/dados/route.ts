import { NextResponse } from 'next/server';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { reunirDadosDoTitular } from '@rapidinho/services/regras';
import { limitarEscrita, naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Limitada como escrita: cada exportação fica registrada como pedido do titular. */
export const GET = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const json = await reunirDadosDoTitular(user.id);
  if (!json) throw naoEncontrado('Conta não encontrada.');

  return new NextResponse(json, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
});
