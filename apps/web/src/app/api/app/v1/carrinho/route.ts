import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { responderCarrinho } from '@/lib/carrinho-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  return responderCarrinho(user.id);
});
