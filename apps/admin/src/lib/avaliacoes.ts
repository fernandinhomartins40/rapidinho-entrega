import type { Prisma } from '@rapidinho/database';

/**
 * Avaliação que pede resposta da loja: tem comentário ou nota de 3 para baixo,
 * e ninguém respondeu ainda. Cinco estrelas sem texto não pede nada — contar
 * essas encheria a fila de "pendências" que não são pendência.
 *
 * Fica num lugar só porque a visão geral conta e a tela de avaliações lista
 * com a mesma regra; regras diferentes dariam números diferentes.
 */
export function ondeParaResponder(storeId: string): Prisma.ReviewWhereInput {
  return {
    storeId,
    replyText: null,
    OR: [{ comment: { not: null } }, { rating: { lte: 3 } }],
  };
}
