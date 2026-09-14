import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { apiHandler, requireUser } from '@rapidinho/auth';
import { capturarErro, getStorage } from '@rapidinho/services';
import {
  InvalidImageError,
  isPrivateContext,
  processAndStoreImage,
} from '@rapidinho/services/images';
import { ASPECT_RATIOS, MAX_UPLOAD_BYTES } from '@rapidinho/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uploadSchema = z.object({
  context: z.enum(Object.keys(ASPECT_RATIOS) as [keyof typeof ASPECT_RATIOS]),
});

/**
 * Recebe a imagem já recortada e comprimida pelo `<ImageUploader />`, gera as
 * variantes com sharp e devolve o id do MediaAsset.
 *
 * Só usuário autenticado sobe arquivo: upload aberto vira hospedagem grátis
 * para terceiros no primeiro dia.
 */
export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie um arquivo' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Imagem maior que 8 MB' }, { status: 413 });
  }

  const parsed = uploadSchema.safeParse({ context: formData.get('context') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contexto de upload inválido' }, { status: 400 });
  }

  const { context } = parsed.data;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processAndStoreImage(buffer, context, getStorage());

    const asset = await prisma.mediaAsset.create({
      data: {
        context,
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
        uploadedById: user.id,
      },
      select: { id: true, mediumKey: true },
    });

    const storage = getStorage();
    const url = isPrivateContext(context)
      ? await storage.getSignedUrl(asset.mediumKey ?? processed.mediumKey)
      : storage.getPublicUrl(asset.mediumKey ?? processed.mediumKey);

    return NextResponse.json({ id: asset.id, url }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    void capturarErro(error, { origem: 'uploads' });
    return NextResponse.json({ error: 'Não foi possível processar a imagem' }, { status: 500 });
  }
});
