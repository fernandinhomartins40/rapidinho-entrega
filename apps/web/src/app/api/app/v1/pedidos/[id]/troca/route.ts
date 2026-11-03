import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { responderTrocaDoPedido } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, okCom } from '@/lib/api-do-app';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

const entradaSchema = z.object({ itemId: z.string().min(1), aceita: z.boolean() });

export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  const dados = await lerCorpo(request, entradaSchema);

  return okCom(exigirOk(await responderTrocaDoPedido(user.id, { orderId: id, ...dados })));
});
