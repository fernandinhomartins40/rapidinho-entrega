'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
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

    const loja = await prisma.store.findFirst({
      where: { id, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!loja) return { ok: false, message: 'Loja indisponível.' };

    const chave = { userId_storeId: { userId: user.id, storeId: loja.id } };
    const existente = await prisma.favoriteStore.findUnique({
      where: chave,
      select: { userId: true },
    });

    if (existente) {
      await prisma.favoriteStore.delete({ where: chave });
    } else {
      await prisma.favoriteStore.create({ data: { userId: user.id, storeId: loja.id } });
    }

    revalidatePath('/favoritos');
    return { ok: true, favorita: !existente };
  });
}
