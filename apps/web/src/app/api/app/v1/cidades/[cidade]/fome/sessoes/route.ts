import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rotaDoApp } from '@rapidinho/auth';
import { CHAVE_DE_PRATO, criarSessaoDeFome, MAXIMO_DE_PRATOS } from '@rapidinho/services/regras';
import { RATE_LIMITS } from '@rapidinho/shared';
import { exigirOk, lerCorpo, limitarPorIp } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ cidade: string }> };

const entradaSchema = z.object({
  chaves: z.array(z.string().regex(CHAVE_DE_PRATO)).min(2).max(MAXIMO_DE_PRATOS),
  apelido: z.string().trim().min(1).max(24),
});

export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  await limitarPorIp(request, 'fome', RATE_LIMITS.appEscrita);

  const { cidade } = await params;
  const { chaves } = await lerCorpo(request, entradaSchema);
  const { id } = exigirOk(await criarSessaoDeFome({ cidadeSlug: cidade, chaves }));

  return NextResponse.json({ id }, { status: 201 });
});
