import {
  parseServerEnv,
  type OtpSender,
  type StorageProvider,
  type WhatsAppProvider,
} from '@rapidinho/shared';
import { createS3Storage } from './storage/s3';
import { createEvolutionWhatsApp, createFakeWhatsApp } from './messaging/whatsapp';
import { createConsoleOtpSender, createWhatsAppOtpSender } from './messaging/otp';

/**
 * Fábricas dos serviços externos.
 *
 * Este é o único lugar que decide QUAL implementação usar. O resto do código
 * recebe a interface e não sabe se por trás está MinIO ou S3, Evolution API ou
 * Cloud API — que é o que torna a troca de provedor uma mudança de env.
 */

let storageInstance: StorageProvider | null = null;
let whatsappInstance: WhatsAppProvider | null = null;
let otpSenderInstance: OtpSender | null = null;

export function getStorage(): StorageProvider {
  if (storageInstance) return storageInstance;

  const env = parseServerEnv();
  storageInstance = createS3Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    publicUrl: env.S3_PUBLIC_URL,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });

  return storageInstance;
}

export function getWhatsApp(): WhatsAppProvider {
  if (whatsappInstance) return whatsappInstance;

  const env = parseServerEnv();

  whatsappInstance =
    env.WHATSAPP_PROVIDER === 'evolution'
      ? createEvolutionWhatsApp({
          apiUrl: env.EVOLUTION_API_URL ?? '',
          apiKey: env.EVOLUTION_API_KEY ?? '',
          instance: env.EVOLUTION_INSTANCE ?? 'rapidinho',
        })
      : createFakeWhatsApp();

  return whatsappInstance;
}

export function getOtpSender(): OtpSender {
  if (otpSenderInstance) return otpSenderInstance;

  const env = parseServerEnv();

  if (env.OTP_PROVIDER === 'console') {
    if (env.NODE_ENV === 'production') {
      throw new Error('OTP_PROVIDER=console não pode ser usado em produção');
    }
    otpSenderInstance = createConsoleOtpSender();
  } else {
    otpSenderInstance = createWhatsAppOtpSender(getWhatsApp());
  }

  return otpSenderInstance;
}

/**
 * O processamento de imagem (sharp) fica fora deste barrel de propósito:
 * importe de `@rapidinho/services/images` onde ele for realmente usado, para
 * que rotas sem upload não carreguem o binário nativo.
 */
export * from './rate-limit';
export * from './storage/s3';
export * from './messaging/whatsapp';
export * from './messaging/otp';
