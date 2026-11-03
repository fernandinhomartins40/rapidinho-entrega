import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ErroDaRota, exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { alternarFavoritoDoCliente } from '@rapidinho/services/regras';
import { lerCorpo, limitarEscrita } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({ lojaId: z.string().min(1) });

export const POST = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { lojaId } = await lerCorpo(request, entradaSchema);

  const resultado = await alternarFavoritoDoCliente(user.id, lojaId);
  if (!resultado) throw new ErroDaRota('Loja indisponível.', 'LOJA_INDISPONIVEL');

  return NextResponse.json(resultado);
});
