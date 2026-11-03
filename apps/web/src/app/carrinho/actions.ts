'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { adicionarItemAoCarrinho, alterarQuantidadeDoItem } from '@rapidinho/services/regras';
import { cuidSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Manutenção do carrinho.
 *
 * Nenhum preço entra por aqui: o cliente informa O QUE quer, e o valor é
 * calculado na leitura, a partir do catálogo. Um preço adulterado no navegador
 * simplesmente não tem onde aterrissar.
 */

export async function adicionarAoCarrinho(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const resultado = await adicionarItemAoCarrinho(user.id, entrada);

    if (resultado.ok) {
      revalidatePath('/carrinho');
      revalidatePath(`/loja/${resultado.lojaSlug}`);
    }

    return resultado;
  });
}

const alterarSchema = z.object({
  cartItemId: cuidSchema,
  quantity: z.number().int().min(0).max(99),
});

export async function alterarQuantidade(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const resultado = await alterarQuantidadeDoItem(user.id, alterarSchema.parse(entrada));
    if (resultado.ok) revalidatePath('/carrinho');
    return resultado;
  });
}

export async function removerItem(cartItemId: string): Promise<ActionResult> {
  return alterarQuantidade({ cartItemId, quantity: 0 });
}

export async function esvaziarCarrinho(storeId: string): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    await prisma.cart.deleteMany({ where: { userId: user.id, storeId } });

    revalidatePath('/carrinho');
    return { ok: true, message: 'Carrinho esvaziado.' };
  });
}

const observacaoSchema = z.object({
  storeId: cuidSchema,
  notes: z.string().max(500),
});

export async function salvarObservacao(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = observacaoSchema.parse(entrada);

    await prisma.cart.updateMany({
      where: { userId: user.id, storeId: dados.storeId },
      data: { notes: dados.notes || null },
    });

    revalidatePath('/carrinho');
    return { ok: true };
  });
}
