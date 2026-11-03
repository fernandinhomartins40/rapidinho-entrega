import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { colocarListaNoCarrinhoDoCliente } from '@rapidinho/services/regras';
import type { RespostaListaNoCarrinho } from '@rapidinho/shared/app-api';
import { exigirOk, lerCorpo, limitarEscrita } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({
  itens: z
    .array(
      z.object({
        lojaId: z.string().min(1),
        produtoId: z.string().min(1),
        quantidade: z.number().int().min(1).max(99),
        gramas: z.number().int().min(1).max(50_000).nullable(),
      }),
    )
    .min(1)
    .max(40),
});

export const POST = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { itens } = await lerCorpo(request, entradaSchema);

  const resultado = exigirOk(
    await colocarListaNoCarrinhoDoCliente(
      user.id,
      itens.map(({ lojaId, produtoId, ...item }) => ({
        ...item,
        storeId: lojaId,
        productId: produtoId,
      })),
    ),
  );

  const resposta: RespostaListaNoCarrinho = {
    adicionados: resultado.adicionados,
    mensagem: resultado.message ?? null,
  };

  return NextResponse.json(resposta);
});
