import { z } from 'zod';
import { exigirEntregadorDoToken, rotaDoApp } from '@rapidinho/auth';
import {
  aceitarCorridaAvulsaDoEntregador,
  aceitarCorridaDoPedido,
} from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, okCom } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

const entradaSchema = z.object({ tipo: z.enum(['pedido', 'avulsa']).default('pedido') });

export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const { user, courierId } = await exigirEntregadorDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  const { tipo } = await lerCorpo(request, entradaSchema);

  return okCom(
    exigirOk(
      tipo === 'avulsa'
        ? await aceitarCorridaAvulsaDoEntregador(courierId, id)
        : await aceitarCorridaDoPedido(courierId, id),
    ),
  );
});
