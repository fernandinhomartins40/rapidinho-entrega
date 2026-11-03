import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cadastroDeEntregador, ErroDaRota, exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { capturarErro } from '@rapidinho/services';
import { InvalidImageError } from '@rapidinho/services/images';
import { guardarImagem } from '@rapidinho/services/regras/upload';
import { MAX_UPLOAD_BYTES, RATE_LIMITS } from '@rapidinho/shared';
import type { RespostaUpload } from '@rapidinho/shared/app-api';
import { limitar } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lista fechada: o app não sobe imagem de catálogo, só as privadas do cliente. */
const CONTEXTOS = {
  receita: 'PRESCRIPTION',
  comprovante: 'PIX_PROOF',
  documento: 'COURIER_DOCUMENT',
} as const;

const contextoSchema = z.enum(['receita', 'comprovante', 'documento'], {
  errorMap: () => ({ message: 'Contexto de upload inválido' }),
});

export const POST = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitar(`app:upload:${user.id}`, RATE_LIMITS.upload);

  const formulario = await request.formData().catch(() => null);
  const arquivo = formulario?.get('arquivo');

  if (!(arquivo instanceof File)) {
    throw new ErroDaRota('Envie um arquivo.', 'DADOS_INVALIDOS');
  }
  if (arquivo.size > MAX_UPLOAD_BYTES) {
    throw new ErroDaRota('Imagem maior que 8 MB.', 'DADOS_INVALIDOS', 413);
  }

  const contexto = contextoSchema.parse(formulario?.get('contexto'));
  if (contexto === 'documento') await cadastroDeEntregador(user.id);

  try {
    const imagem: RespostaUpload = await guardarImagem({
      buffer: Buffer.from(await arquivo.arrayBuffer()),
      context: CONTEXTOS[contexto],
      userId: user.id,
    });

    return NextResponse.json(imagem, { status: 201 });
  } catch (erro) {
    if (erro instanceof InvalidImageError) {
      throw new ErroDaRota(erro.message, 'DADOS_INVALIDOS');
    }

    void capturarErro(erro, { origem: 'uploads-do-app' });
    throw new ErroDaRota(
      'Não foi possível guardar a imagem agora. Tente de novo.',
      'ARMAZENAMENTO_INDISPONIVEL',
    );
  }
});
