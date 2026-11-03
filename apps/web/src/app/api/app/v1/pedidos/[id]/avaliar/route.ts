import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { avaliarPedidoDoCliente } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, okCom } from '@/lib/api-do-app';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

const nota = z.number().int().min(1).max(5).optional();

const entradaSchema = z.object({
  notaDaLoja: nota,
  comentarioDaLoja: z.string().max(1000).optional(),
  notaDoEntregador: nota,
  comentarioDoEntregador: z.string().max(1000).optional(),
});

export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  const entrada = await lerCorpo(request, entradaSchema);

  return okCom(
    exigirOk(
      await avaliarPedidoDoCliente(user.id, {
        orderId: id,
        storeRating: entrada.notaDaLoja,
        storeComment: entrada.comentarioDaLoja,
        courierRating: entrada.notaDoEntregador,
        courierComment: entrada.comentarioDoEntregador,
      }),
    ),
  );
});
