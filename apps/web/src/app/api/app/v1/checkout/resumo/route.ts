import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { resumoDoCheckoutDoApp } from '@rapidinho/services/regras';
import { exigirOk } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parametrosSchema = z.object({
  lojaId: z.string().min(1),
  tipo: z.enum(['DELIVERY', 'PICKUP']).optional(),
  enderecoId: z.string().min(1).optional(),
  cupom: z.string().max(40).optional(),
});

export const GET = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  const parametros = parametrosSchema.parse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  const { resumo } = exigirOk(await resumoDoCheckoutDoApp(user.id, parametros));
  return NextResponse.json(resumo);
});
