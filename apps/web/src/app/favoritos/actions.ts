'use server';

import { revalidatePath } from 'next/cache';
import { alternarFavoritoDoCliente } from '@rapidinho/services/regras';
import { cuidSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Marca ou desmarca a loja como favorita e devolve o estado final.
 *
 * O estado vem do banco, não do botão: dois toques rápidos em abas diferentes
 * não podem deixar a tela dizendo o contrário do que ficou salvo.
 */
export async function alternarFavorito(
  storeId: string,
): Promise<ActionResult & { favorita?: boolean }> {
  return runAuthedAction(async (user) => {
    const id = cuidSchema.parse(storeId);

    const resultado = await alternarFavoritoDoCliente(user.id, id);
    if (!resultado) return { ok: false, message: 'Loja indisponível.' };

    revalidatePath('/favoritos');
    return { ok: true, favorita: resultado.favorita };
  });
}
