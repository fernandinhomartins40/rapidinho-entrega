import { NextResponse } from 'next/server';
import { exigirUsuarioDoToken, registrarAceiteDosTermos, rotaDoApp } from '@rapidinho/auth';
import { clientIpFromHeaders } from '@rapidinho/services';
import type { RespostaAceiteDeTermos } from '@rapidinho/shared/app-api';
import { limitarEscrita } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  await registrarAceiteDosTermos(user.id, clientIpFromHeaders(request.headers));

  const resposta: RespostaAceiteDeTermos = { ok: true, termosPendentes: false };
  return NextResponse.json(resposta);
});
