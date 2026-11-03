'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { capturarErro } from '@rapidinho/services';
import { colocarListaNoCarrinhoDoCliente, montarPedido } from '@rapidinho/services/regras';
import { cuidSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';
import type { RespostaDaMontagem } from './tipos';

/** Pedido por lista. A regra é a do app, em `@rapidinho/services/regras`. */

const montarSchema = z.object({
  cidadeSlug: z.string().min(1).max(80),
  texto: z.string().max(2000),
});

export async function montarPedidoPorLista(entrada: unknown): Promise<RespostaDaMontagem> {
  try {
    const { cidadeSlug, texto } = montarSchema.parse(entrada);
    return await montarPedido(cidadeSlug, texto);
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: 'Lista inválida.' };
    void capturarErro(error, { origem: 'pedido-por-lista' });
    return { ok: false, message: 'Não foi possível montar agora. Tente de novo.' };
  }
}

const carrinhoSchema = z
  .array(
    z.object({
      storeId: cuidSchema,
      productId: cuidSchema,
      quantidade: z.number().int().min(1).max(99),
      gramas: z.number().int().min(1).max(50_000).nullable(),
    }),
  )
  .min(1)
  .max(40);

export async function colocarListaNoCarrinho(
  entrada: unknown,
): Promise<ActionResult & { adicionados?: number }> {
  return runAuthedAction(async (user) => {
    const resultado = await colocarListaNoCarrinhoDoCliente(user.id, carrinhoSchema.parse(entrada));
    if (resultado.ok) revalidatePath('/carrinho');
    return resultado;
  });
}
