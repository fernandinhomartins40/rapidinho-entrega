import { NextResponse } from 'next/server';
import { rotaDoApp } from '@rapidinho/auth';
import { contarNoBanner } from '@rapidinho/services/regras';
import { RATE_LIMITS } from '@rapidinho/shared';
import { limitarPorIp, naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  await limitarPorIp(request, 'banner', RATE_LIMITS.appBanner);

  const { id } = await params;
  if (!(await contarNoBanner(id, 'impressions'))) throw naoEncontrado('Banner não encontrado.');

  return NextResponse.json({ ok: true });
});
