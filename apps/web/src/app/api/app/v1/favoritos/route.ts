import { NextResponse } from 'next/server';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { favoritosDoApp } from '@rapidinho/services/regras';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  return NextResponse.json({ lojas: await favoritosDoApp(user.id) });
});
