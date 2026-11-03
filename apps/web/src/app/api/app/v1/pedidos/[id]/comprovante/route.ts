import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { anexarComprovantePix } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, okCom } from '@/lib/api-do-app';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

const entradaSchema = z.object({ imagemId: z.string().min(1) });

export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  const { imagemId } = await lerCorpo(request, entradaSchema);

  return okCom(exigirOk(await anexarComprovantePix(user.id, { orderId: id, mediaId: imagemId })));
});
