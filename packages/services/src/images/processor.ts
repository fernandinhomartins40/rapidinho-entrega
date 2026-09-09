import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  type StorageProvider,
  type UploadContext,
} from '@rapidinho/shared';

/**
 * Processamento de imagem no SERVIDOR.
 *
 * A imagem original nunca é servida em listagem: aqui ela vira três variantes
 * (150/400/800) mais um placeholder blur minúsculo que vai para o banco e
 * segura o layout enquanto a foto real carrega — é o que faz a home parecer
 * rápida num 3G.
 *
 * Também é a última linha de validação: o cliente já filtrou o arquivo, mas
 * quem chama a API pode não ser o nosso cliente.
 */

export interface ProcessedUpload {
  originalKey: string;
  thumbKey: string;
  mediumKey: string;
  largeKey: string;
  blurDataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  checksum: string;
}

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

const CONTEXT_PREFIX: Record<UploadContext, string> = {
  PRODUCT: 'public/produtos',
  STORE_LOGO: 'public/lojas/logo',
  STORE_COVER: 'public/lojas/capa',
  PROMO_BANNER: 'public/banners',
  CATEGORY_ICON: 'public/categorias',
  PIZZA_FLAVOR: 'public/sabores',
  // Documentos não vão para o prefixo público: só acessíveis por URL assinada.
  COURIER_DOCUMENT: 'private/entregadores',
  STORE_DOCUMENT: 'private/lojas',
};

export function isPrivateContext(context: UploadContext): boolean {
  return CONTEXT_PREFIX[context].startsWith('private/');
}

export async function processAndStoreImage(
  buffer: Buffer,
  context: UploadContext,
  storage: StorageProvider,
): Promise<ProcessedUpload> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new InvalidImageError('Imagem maior que o limite de 8 MB');
  }

  // `sharp` lê o cabeçalho real do arquivo: extensão e Content-Type do
  // multipart são informação do cliente e não valem como validação.
  const source = sharp(buffer, { failOn: 'error' });

  // Arquivo que não é imagem faz o sharp lançar erro próprio; traduzimos para
  // o erro do domínio, senão a rota devolveria 500 em vez de dizer ao lojista
  // o que houve com a foto.
  let metadata: sharp.Metadata;
  try {
    metadata = await source.metadata();
  } catch {
    throw new InvalidImageError('Arquivo não é uma imagem válida (JPEG, PNG, WebP ou AVIF)');
  }

  const detectedMime = metadata.format ? `image/${metadata.format}` : null;
  if (!detectedMime || !ALLOWED_IMAGE_MIME_TYPES.includes(detectedMime as never)) {
    throw new InvalidImageError('Arquivo não é uma imagem válida (JPEG, PNG, WebP ou AVIF)');
  }

  if (!metadata.width || !metadata.height) {
    throw new InvalidImageError('Não foi possível ler as dimensões da imagem');
  }

  // Bomba de descompressão: um PNG de poucos KB pode declarar 30000x30000.
  if (metadata.width * metadata.height > 50_000_000) {
    throw new InvalidImageError('Imagem com resolução acima do permitido');
  }

  const checksum = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
  const prefix = CONTEXT_PREFIX[context];

  // `rotate()` sem argumento aplica a orientação do EXIF e, junto com o
  // pipeline do sharp, descarta os demais metadados (inclusive GPS).
  const normalized = source.rotate();

  async function renderVariant(size: number): Promise<{ buffer: Buffer; key: string }> {
    const output = await normalized
      .clone()
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    return { buffer: output, key: `${prefix}/${checksum}-${size}.webp` };
  }

  const [thumb, medium, large] = await Promise.all([
    renderVariant(IMAGE_SIZES.thumb),
    renderVariant(IMAGE_SIZES.medium),
    renderVariant(IMAGE_SIZES.large),
  ]);

  const original = await normalized.clone().webp({ quality: 88 }).toBuffer();
  const originalKey = `${prefix}/${checksum}-original.webp`;

  // Placeholder de 16px: pesa ~300 bytes em base64 e cabe no banco.
  const blurBuffer = await normalized
    .clone()
    .resize(16, 16, { fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();

  await Promise.all([
    storage.put({ key: originalKey, body: original, contentType: 'image/webp' }),
    storage.put({ key: thumb.key, body: thumb.buffer, contentType: 'image/webp' }),
    storage.put({ key: medium.key, body: medium.buffer, contentType: 'image/webp' }),
    storage.put({ key: large.key, body: large.buffer, contentType: 'image/webp' }),
  ]);

  return {
    originalKey,
    thumbKey: thumb.key,
    mediumKey: medium.key,
    largeKey: large.key,
    blurDataUrl: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
    mimeType: 'image/webp',
    width: metadata.width,
    height: metadata.height,
    sizeBytes: original.byteLength,
    checksum,
  };
}
