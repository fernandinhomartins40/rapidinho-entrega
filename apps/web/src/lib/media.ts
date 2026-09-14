import { getPublicEnv } from '@rapidinho/shared';

/**
 * URL pública de uma imagem.
 *
 * O banco guarda a CHAVE no bucket, não a URL: o endereço muda quando se troca
 * MinIO por S3 ou se põe um CDN na frente, e guardar a URL montada exigiria
 * reescrever a tabela inteira nesse dia.
 */

export interface ImagemDoBanco {
  thumbKey: string | null;
  mediumKey: string | null;
  largeKey: string | null;
  blurDataUrl: string | null;
}

export type TamanhoDeImagem = 'thumb' | 'medium' | 'large';

export interface ImagemExibivel {
  url: string | null;
  blurDataUrl: string | null;
}

export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `${getPublicEnv().NEXT_PUBLIC_WEB_URL.replace(/\/$/, '')}/uploads/${key}`;
}

/**
 * Escolhe a variante e cai para a maior disponível.
 *
 * As variantes são geradas em segundo plano: entre o upload e o fim do
 * processamento existe uma janela em que só a original está pronta, e nela o
 * cardápio não pode ficar sem imagem.
 */
export function imagemExibivel(
  imagem: ImagemDoBanco | null | undefined,
  tamanho: TamanhoDeImagem = 'thumb',
): ImagemExibivel {
  if (!imagem) return { url: null, blurDataUrl: null };

  const porTamanho: Record<TamanhoDeImagem, (string | null)[]> = {
    thumb: [imagem.thumbKey, imagem.mediumKey, imagem.largeKey],
    medium: [imagem.mediumKey, imagem.largeKey, imagem.thumbKey],
    large: [imagem.largeKey, imagem.mediumKey, imagem.thumbKey],
  };

  const chave = porTamanho[tamanho].find((valor) => valor != null) ?? null;

  return { url: mediaUrl(chave), blurDataUrl: imagem.blurDataUrl };
}

export const SELECT_IMAGEM = {
  thumbKey: true,
  mediumKey: true,
  largeKey: true,
  blurDataUrl: true,
} as const;
