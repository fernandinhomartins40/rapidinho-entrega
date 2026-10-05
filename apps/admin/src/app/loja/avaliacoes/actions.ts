'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { cuidSchema } from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

const respostaSchema = z.object({
  reviewId: cuidSchema,
  texto: z.string().trim().min(3, 'Escreva pelo menos uma frase.').max(500, 'Até 500 caracteres.'),
});

/**
 * Resposta da loja a uma avaliação.
 *
 * A avaliação é buscada já filtrada pela loja do vínculo — a de outra loja não
 * é encontrada — e só responde uma vez: a resposta é o que o cliente recebe, e
 * trocar o texto depois de enviado faria o aviso dizer uma coisa e a tela
 * outra.
 */
export async function responderAvaliacao(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = respostaSchema.parse(entrada);

    const avaliacao = await prisma.review.findFirst({
      where: { id: dados.reviewId, storeId: access.storeId },
      select: {
        id: true,
        userId: true,
        replyText: true,
        order: { select: { id: true, number: true } },
        store: { select: { name: true } },
      },
    });

    if (!avaliacao) {
      return { result: { ok: false, message: 'Avaliação não encontrada nesta loja.' } };
    }
    if (avaliacao.replyText) {
      return { result: { ok: false, message: 'Esta avaliação já foi respondida.' } };
    }

    // `replyText: null` no filtro: duas pessoas da equipe respondendo ao mesmo
    // tempo não sobrescrevem uma à outra.
    const { count } = await prisma.review.updateMany({
      where: { id: avaliacao.id, replyText: null },
      data: { replyText: dados.texto, repliedAt: new Date() },
    });

    if (count === 0) {
      return { result: { ok: false, message: 'Esta avaliação já foi respondida.' } };
    }

    // Só push: é uma resposta, não um aviso urgente do pedido. WhatsApp para
    // isso pareceria cobrança.
    await notificarUsuario({
      userId: avaliacao.userId,
      title: `${avaliacao.store?.name ?? 'A loja'} respondeu sua avaliação`,
      body: dados.texto,
      url: `/pedidos/${avaliacao.order.id}`,
      canais: ['PUSH'],
      entity: { type: 'Review', id: avaliacao.id },
      tag: `avaliacao-${avaliacao.id}`,
    });

    revalidatePath('/loja/avaliacoes');
    revalidatePath('/loja');

    return {
      result: {
        ok: true,
        message: `Resposta enviada ao cliente do pedido #${avaliacao.order.number}.`,
      },
      audit: {
        action: 'review.replied',
        entityType: 'Review',
        entityId: avaliacao.id,
        after: { replyText: dados.texto },
      },
    };
  });
}
