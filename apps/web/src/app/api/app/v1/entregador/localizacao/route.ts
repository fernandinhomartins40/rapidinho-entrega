import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirEntregadorDoToken, rotaDoApp } from '@rapidinho/auth';
import { registrarPosicaoDoEntregador } from '@rapidinho/services/regras';
import { RATE_LIMITS } from '@rapidinho/shared';
import type { RespostaLocalizacao } from '@rapidinho/shared/app-api';
import { exigirOk, lerCorpo, limitar } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const POST = rotaDoApp(async (request: Request) => {
  const { courierId } = await exigirEntregadorDoToken(request);
  await limitar(`app:localizacao:${courierId}`, RATE_LIMITS.appLocalizacao);

  const dados = await lerCorpo(request, entradaSchema);
  const { gravada } = exigirOk(await registrarPosicaoDoEntregador(courierId, dados));

  const resposta: RespostaLocalizacao = { gravada };
  return NextResponse.json(resposta);
});
