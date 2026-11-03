import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rotaDoApp } from '@rapidinho/auth';
import { montarPedido } from '@rapidinho/services/regras';
import { RATE_LIMITS } from '@rapidinho/shared';
import type { PedidoMontado } from '@rapidinho/shared/app-api';
import { exigirOk, lerCorpo, limitarPorIp } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ cidade: string }> };

const entradaSchema = z.object({ texto: z.string().max(2000) });

/** Só monta a proposta: nada entra no carrinho sem o cliente confirmar. */
export const POST = rotaDoApp(async (request: Request, { params }: Contexto) => {
  await limitarPorIp(request, 'pedir', RATE_LIMITS.search);

  const { cidade } = await params;
  const { texto } = await lerCorpo(request, entradaSchema);
  const { pedido } = exigirOk(await montarPedido(cidade, texto));

  const resposta: PedidoMontado = {
    ...pedido,
    lojas: pedido.lojas.map(({ imagem, produtos, ...loja }) => ({
      ...loja,
      imagemUrl: imagem,
      produtos: Object.fromEntries(
        Object.entries(produtos).map(([indice, lista]) => [
          indice,
          lista.map(({ imagem: imagemUrl, ...produto }) => ({ ...produto, imagemUrl })),
        ]),
      ),
    })),
  };

  return NextResponse.json(resposta);
});
