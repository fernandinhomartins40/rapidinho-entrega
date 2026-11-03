import { NextResponse } from 'next/server';
import { rotaDoApp, usuarioDoToken } from '@rapidinho/auth';
import { placarDaSessao } from '@rapidinho/services/regras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const GET = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const { id } = await params;
  const user = await usuarioDoToken(request);

  return NextResponse.json(await placarDaSessao(id, user ? `app:${user.id}` : null));
});
