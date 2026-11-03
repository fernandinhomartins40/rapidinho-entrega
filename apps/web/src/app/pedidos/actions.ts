'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  anexarComprovantePix,
  avaliarPedidoDoCliente,
  cancelarPedidoDoCliente,
  repetirPedido,
  responderTrocaDoPedido,
} from '@rapidinho/services/regras';
import { cuidSchema, reviewSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Ações sobre pedidos já feitos. As regras são as mesmas do app e vivem em
 * `@rapidinho/services/regras`: aqui fica o que é do site, como ler o formulário
 * e revalidar as páginas.
 */

const comprovanteSchema = z.object({ orderId: cuidSchema, mediaId: cuidSchema });

export async function pedirNovamente(orderId: string): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const resultado = await repetirPedido(user.id, orderId);
    if (resultado.ok) revalidatePath('/carrinho');
    return resultado;
  });
}

export async function avaliarPedido(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = reviewSchema.parse({
      orderId: formData.get('orderId'),
      storeRating: formData.get('storeRating') ? Number(formData.get('storeRating')) : undefined,
      storeComment: formData.get('storeComment') || undefined,
      courierRating: formData.get('courierRating')
        ? Number(formData.get('courierRating'))
        : undefined,
      courierComment: formData.get('courierComment') || undefined,
    });

    const resultado = await avaliarPedidoDoCliente(user.id, dados);
    if (resultado.ok) revalidatePath(`/pedidos/${dados.orderId}`);
    return resultado;
  });
}

const respostaSchema = z.object({
  orderId: cuidSchema,
  itemId: cuidSchema,
  aceita: z.boolean(),
});

export async function responderTroca(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = respostaSchema.parse(entrada);
    const resultado = await responderTrocaDoPedido(user.id, dados);
    if (resultado.ok) revalidatePath(`/pedidos/${dados.orderId}`);
    return resultado;
  });
}

export async function cancelarMeuPedido(orderId: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const id = cuidSchema.parse(orderId);
    const resultado = await cancelarPedidoDoCliente(user.id, id);
    if (resultado.ok) {
      revalidatePath(`/pedidos/${id}`);
      revalidatePath('/pedidos');
    }
    return resultado;
  });
}

export async function anexarComprovanteDoPix(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = comprovanteSchema.parse(entrada);
    const resultado = await anexarComprovantePix(user.id, dados);
    if (resultado.ok) revalidatePath(`/pedidos/${dados.orderId}`);
    return resultado;
  });
}
