import { NextResponse } from 'next/server';
import { encerrarSessaoDoToken, exigirSessaoDoToken, rotaDoApp } from '@rapidinho/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Apaga a sessão no banco: o token deixa de valer na hora, e o aparelho sai junto. */
export const POST = rotaDoApp(async (request: Request) => {
  await exigirSessaoDoToken(request);
  await encerrarSessaoDoToken(request);
  return NextResponse.json({ ok: true });
});
