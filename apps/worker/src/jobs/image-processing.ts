import { prisma } from '@rapidinho/database';

/**
 * Gera as variantes de uma imagem em segundo plano.
 *
 * O upload já devolve a imagem processada de forma síncrona — o lojista
 * precisa ver a foto na hora. Este job existe para reprocessar o que ficou
 * pendente: upload interrompido, deploy no meio do processamento, mudança nos
 * tamanhos gerados.
 */
export async function processarImagem(mediaId: string): Promise<void> {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { id: true, isProcessed: true, originalKey: true },
  });

  if (!media || media.isProcessed) return;

  // O processador é importado aqui dentro, e não no topo: ele carrega o
  // binário nativo do sharp, e um worker que só manda notificação não tem por
  // que pagar esse custo de inicialização.
  const [{ reprocessStoredImage }, { getStorage }] = await Promise.all([
    import('@rapidinho/services/images'),
    import('@rapidinho/services'),
  ]);

  try {
    const resultado = await reprocessStoredImage(media.originalKey, getStorage());

    await prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        thumbKey: resultado.thumbKey,
        mediumKey: resultado.mediumKey,
        largeKey: resultado.largeKey,
        blurDataUrl: resultado.blurDataUrl,
        width: resultado.width,
        height: resultado.height,
        isProcessed: true,
      },
    });
  } catch (erro) {
    console.error('[imagem] falha ao reprocessar', { mediaId, erro });
    throw erro;
  }
}
