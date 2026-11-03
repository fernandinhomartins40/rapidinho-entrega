import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { repetirPedido } from '@rapidinho/services/regras';
import { exigirOk, limitarEscrita, okCom } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  return okCom(exigirOk(await repetirPedido(user.id, id)));
});
