import { NextResponse } from 'next/server';
import { rotaDoApp } from '@rapidinho/auth';
import { buscaDoApp } from '@rapidinho/services/regras';
import { RATE_LIMITS } from '@rapidinho/shared';
import { limitarPorIp, naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ cidade: string }> };

export const GET = rotaDoApp(async (request: Request, { params }: Contexto) => {
  await limitarPorIp(request, 'busca', RATE_LIMITS.search);

  const { cidade } = await params;
  const termo = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 80);

  const resultado = await buscaDoApp(cidade, termo);
  if (!resultado) throw naoEncontrado('Cidade não encontrada.');

  return NextResponse.json(resultado);
});
