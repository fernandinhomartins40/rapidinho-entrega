import { NextResponse } from 'next/server';
import { rotaDoApp, usuarioDoToken } from '@rapidinho/auth';
import { lojaDoApp } from '@rapidinho/services/regras';
import { naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ cidade: string; loja: string }> };

/** Pública; o token, quando vem, só serve para marcar o favorito. */
export const GET = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const { cidade, loja: slug } = await params;
  const user = await usuarioDoToken(request);

  const loja = await lojaDoApp(cidade, slug, user?.id ?? null);
  if (!loja) throw naoEncontrado('Loja não encontrada.');

  return NextResponse.json(loja);
});
