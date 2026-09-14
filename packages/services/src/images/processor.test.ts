import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '@rapidinho/shared';
import { InvalidImageError, isPrivateContext, processAndStoreImage } from './processor';

/** Storage em memória, para o teste não depender de MinIO. */
function fakeStorage() {
  const objects = new Map<string, { body: Buffer; contentType: string }>();

  const storage: StorageProvider = {
    async put({ key, body, contentType }) {
      objects.set(key, { body: Buffer.from(body), contentType });
      return { key, url: `http://storage.local/${key}` };
    },
    async get(key) {
      return objects.get(key)?.body ?? null;
    },
    async delete(key) {
      objects.delete(key);
    },
    getPublicUrl: (key) => `http://storage.local/${key}`,
    getSignedUrl: async (key) => `http://storage.local/${key}?assinada`,
  };

  return { storage, objects };
}

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 220, g: 100, b: 30 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('processamento de imagem', () => {
  it('gera as três variantes mais o original', async () => {
    const { storage, objects } = fakeStorage();
    const result = await processAndStoreImage(await makeJpeg(1200, 1200), 'PRODUCT', storage);

    expect(objects.size).toBe(4);
    expect(objects.has(result.thumbKey)).toBe(true);
    expect(objects.has(result.mediumKey)).toBe(true);
    expect(objects.has(result.largeKey)).toBe(true);
    expect(objects.has(result.originalKey)).toBe(true);
  });

  it('converte tudo para WebP, inclusive um JPEG de entrada', async () => {
    const { storage, objects } = fakeStorage();
    const result = await processAndStoreImage(await makeJpeg(800, 800), 'PRODUCT', storage);

    expect(result.mimeType).toBe('image/webp');
    for (const object of objects.values()) {
      expect(object.contentType).toBe('image/webp');
    }
  });

  it('respeita o tamanho máximo de cada variante', async () => {
    const { storage, objects } = fakeStorage();
    const result = await processAndStoreImage(await makeJpeg(1600, 1600), 'PRODUCT', storage);

    const thumb = await sharp(objects.get(result.thumbKey)?.body).metadata();
    const medium = await sharp(objects.get(result.mediumKey)?.body).metadata();
    const large = await sharp(objects.get(result.largeKey)?.body).metadata();

    expect(thumb.width).toBe(150);
    expect(medium.width).toBe(400);
    expect(large.width).toBe(800);
  });

  it('não amplia imagem menor que a variante', async () => {
    const { storage, objects } = fakeStorage();
    const result = await processAndStoreImage(await makeJpeg(100, 100), 'PRODUCT', storage);

    const large = await sharp(objects.get(result.largeKey)?.body).metadata();
    expect(large.width).toBe(100);
  });

  it('produz um placeholder blur pequeno o bastante para caber no banco', async () => {
    const { storage } = fakeStorage();
    const result = await processAndStoreImage(await makeJpeg(1200, 1200), 'PRODUCT', storage);

    expect(result.blurDataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    expect(result.blurDataUrl.length).toBeLessThan(2000);
  });

  it('recusa arquivo que não é imagem, mesmo com nome de imagem', async () => {
    const { storage } = fakeStorage();
    const naoEhImagem = Buffer.from('<?php echo "isto não é uma foto"; ?>');

    await expect(processAndStoreImage(naoEhImagem, 'PRODUCT', storage)).rejects.toThrow(
      InvalidImageError,
    );
  });

  it('recusa imagem com resolução absurda (bomba de descompressão)', async () => {
    const { storage } = fakeStorage();
    const metadataFalsa = vi.spyOn(sharp.prototype, 'metadata').mockResolvedValue({
      format: 'png',
      width: 30_000,
      height: 30_000,
    } as never);

    try {
      await expect(
        processAndStoreImage(await makeJpeg(10, 10), 'PRODUCT', storage),
      ).rejects.toThrow(/resolução acima do permitido/);
    } finally {
      metadataFalsa.mockRestore();
    }
  });

  it('mesma imagem gera o mesmo hash, evitando arquivo duplicado', async () => {
    const { storage } = fakeStorage();
    const buffer = await makeJpeg(500, 500);

    const primeira = await processAndStoreImage(buffer, 'PRODUCT', storage);
    const segunda = await processAndStoreImage(buffer, 'PRODUCT', storage);

    expect(primeira.checksum).toBe(segunda.checksum);
    expect(primeira.thumbKey).toBe(segunda.thumbKey);
  });

  it('separa documento pessoal do que é público', () => {
    expect(isPrivateContext('COURIER_DOCUMENT')).toBe(true);
    expect(isPrivateContext('STORE_DOCUMENT')).toBe(true);
    expect(isPrivateContext('PRODUCT')).toBe(false);
    expect(isPrivateContext('STORE_LOGO')).toBe(false);
  });

  it('guarda documento fora do prefixo público', async () => {
    const { storage } = fakeStorage();
    const result = await processAndStoreImage(
      await makeJpeg(600, 450),
      'COURIER_DOCUMENT',
      storage,
    );

    expect(result.thumbKey.startsWith('private/')).toBe(true);
  });
});
