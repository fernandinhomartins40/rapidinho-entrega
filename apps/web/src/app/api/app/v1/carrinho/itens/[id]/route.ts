import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { alterarQuantidadeDoItem } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita } from '@/lib/api-do-app';
import { responderCarrinho } from '@/lib/carrinho-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

const entradaSchema = z.object({ quantidade: z.number().int().min(0).max(99) });

export const PATCH = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  const { quantidade } = await lerCorpo(request, entradaSchema);

  exigirOk(await alterarQuantidadeDoItem(user.id, { cartItemId: id, quantity: quantidade }));
  return responderCarrinho(user.id);
});

export const DELETE = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;

  exigirOk(await alterarQuantidadeDoItem(user.id, { cartItemId: id, quantity: 0 }));
  return responderCarrinho(user.id);
});
