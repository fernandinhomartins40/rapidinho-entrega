import { z } from 'zod';
import { exigirEntregadorDoToken, rotaDoApp } from '@rapidinho/auth';
import { alterarDisponibilidadeDoEntregador } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, okCom } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({ online: z.boolean() });

export const POST = rotaDoApp(async (request: Request) => {
  const { user, courierId } = await exigirEntregadorDoToken(request);
  await limitarEscrita(user);

  const { online } = await lerCorpo(request, entradaSchema);

  return okCom(exigirOk(await alterarDisponibilidadeDoEntregador(courierId, online)));
});
