import { prisma } from '@rapidinho/database';
import type { MediaContext } from '@rapidinho/database';
import { isPrivateContext, processAndStoreImage } from '../images/processor';
import { getStorage } from '../providers';

/**
 * Gera as variantes, guarda no bucket e registra o `MediaAsset`.
 *
 * Fora do índice de `regras`: carrega o sharp, que só as rotas de upload usam.
 */
export async function guardarImagem(entrada: {
  buffer: Buffer;
  context: MediaContext;
  userId: string;
}): Promise<{ id: string; url: string }> {
  const storage = getStorage();
  const processed = await processAndStoreImage(entrada.buffer, entrada.context, storage);

  const asset = await prisma.mediaAsset.create({
    data: {
      context: entrada.context,
      originalKey: processed.originalKey,
      thumbKey: processed.thumbKey,
      mediumKey: processed.mediumKey,
      largeKey: processed.largeKey,
      blurDataUrl: processed.blurDataUrl,
      mimeType: processed.mimeType,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
      checksum: processed.checksum,
      isProcessed: true,
      uploadedById: entrada.userId,
    },
    select: { id: true, mediumKey: true },
  });

  const chave = asset.mediumKey ?? processed.mediumKey;
  const url = isPrivateContext(entrada.context)
    ? await storage.getSignedUrl(chave)
    : storage.getPublicUrl(chave);

  return { id: asset.id, url };
}
