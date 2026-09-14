import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PutObjectInput, StorageProvider } from '@rapidinho/shared';

/**
 * Storage compatível com S3. Em produção aponta para MinIO no docker-compose;
 * trocar para S3/R2 é só mudar as variáveis de ambiente.
 */

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl: string;
  forcePathStyle: boolean;
}

export function createS3Storage(config: S3StorageConfig): StorageProvider {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  function getPublicUrl(key: string): string {
    return `${config.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  return {
    async put(input: PutObjectInput) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          // O nome do arquivo carrega hash do conteúdo, então a URL é imutável.
          CacheControl: input.cacheControl ?? 'public, max-age=31536000, immutable',
        }),
      );

      return { key: input.key, url: getPublicUrl(input.key) };
    },

    async get(key: string) {
      try {
        const resposta = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        );

        if (!resposta.Body) return null;

        // `transformToByteArray` existe no SDK v3 e evita montar o stream na
        // mão, que é onde se esquece de tratar o erro de leitura parcial.
        const bytes = await resposta.Body.transformToByteArray();
        return Buffer.from(bytes);
      } catch (error) {
        // Objeto ausente é resposta válida para quem chama (a imagem pode ter
        // sido apagada), não uma exceção a propagar.
        const nome = (error as { name?: string }).name;
        if (nome === 'NoSuchKey' || nome === 'NotFound') return null;
        throw error;
      }
    },

    async delete(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },

    getPublicUrl,

    async getSignedUrl(key: string, expiresInSeconds = 300) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
  };
}
