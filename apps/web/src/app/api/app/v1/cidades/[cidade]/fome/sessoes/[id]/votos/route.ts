import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { CHAVE_DE_PRATO, votarNaSessao } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, okCom } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

const entradaSchema = z.object({
  chave: z.string().regex(CHAVE_DE_PRATO),
  gostou: z.boolean(),
  apelido: z.string().trim().min(1).max(24),
});

/** No site o participante é um cookie; aqui é a conta, que ninguém consegue forjar. */
export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { id } = await params;
  const { chave, gostou, apelido } = await lerCorpo(request, entradaSchema);

  return okCom(
    exigirOk(
      await votarNaSessao({
        sessaoId: id,
        chave,
        gostou,
        participante: { id: `app:${user.id}`, apelido },
      }),
    ),
  );
});
