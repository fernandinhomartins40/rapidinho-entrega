/** Contrato de storage de objetos (MinIO hoje, S3/R2 amanhã). */

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  /// Cache longo: o nome do arquivo carrega hash, então o conteúdo é imutável.
  cacheControl?: string;
}

export interface StorageProvider {
  put(input: PutObjectInput): Promise<{ key: string; url: string }>;
  /// Lê o objeto de volta. Usado para reprocessar imagens já guardadas.
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  /// URL assinada para documentos privados (RG, contrato social).
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

/** Tamanhos gerados para toda imagem. A original nunca é servida em listagem. */
export const IMAGE_SIZES = {
  thumb: 150,
  medium: 400,
  large: 800,
} as const;

export type ImageSizeName = keyof typeof IMAGE_SIZES;

/** Proporção travada por contexto de upload. */
export const ASPECT_RATIOS = {
  PRODUCT: 1,
  STORE_LOGO: 1,
  STORE_COVER: 16 / 9,
  PROMO_BANNER: 21 / 9,
  CATEGORY_ICON: 1,
  COURIER_DOCUMENT: 4 / 3,
  STORE_DOCUMENT: 4 / 3,
  PIZZA_FLAVOR: 1,
} as const;

export type UploadContext = keyof typeof ASPECT_RATIOS;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;
