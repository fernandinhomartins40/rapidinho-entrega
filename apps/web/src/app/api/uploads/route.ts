import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler, requireUser } from '@rapidinho/auth';
import { capturarErro } from '@rapidinho/services';
import { InvalidImageError } from '@rapidinho/services/images';
import { guardarImagem } from '@rapidinho/services/regras/upload';
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
    const imagem = await guardarImagem({ buffer, context, userId: user.id });

    return NextResponse.json(imagem, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    void capturarErro(error, { origem: 'uploads' });
    return NextResponse.json({ error: 'Não foi possível processar a imagem' }, { status: 500 });
  }
});
