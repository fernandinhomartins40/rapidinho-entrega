import { NextResponse } from 'next/server';
import { exigirEntregadorDoToken, rotaDoApp } from '@rapidinho/auth';
import { carregarPainelDoEntregador, corridasRecusadas } from '@rapidinho/services/regras';
import { paraPainelDoApp } from '@/lib/entregador-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = rotaDoApp(async (request: Request) => {
  const { courierId } = await exigirEntregadorDoToken(request);

  const painel = await carregarPainelDoEntregador(courierId, await corridasRecusadas(courierId));
  return NextResponse.json(paraPainelDoApp(painel));
});
