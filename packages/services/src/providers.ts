import {
  getPublicEnv,
  parseServerEnv,
  type EmailProvider,
  type OtpSender,
  type PaymentGateway,
  type PushProvider,
  type StorageProvider,
  type WhatsAppProvider,
} from '@rapidinho/shared';
import { createS3Storage } from './storage/s3';
import { createEvolutionWhatsApp, createFakeWhatsApp } from './messaging/whatsapp';
import { createConsoleOtpSender, createWhatsAppOtpSender } from './messaging/otp';
import { createFakePaymentGateway } from './payments/fake';
import { createFakeEmailProvider, createResendEmailProvider } from './messaging/email';
import { createNoopPushProvider, createWebPushProvider } from './messaging/push';
import { createMercadoPagoGateway } from './payments/mercadopago';

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
let paymentGatewayInstance: PaymentGateway | null = null;
let emailInstance: EmailProvider | null = null;
let pushInstance: PushProvider | null = null;

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
export function getPaymentGateway(): PaymentGateway {
  if (paymentGatewayInstance) return paymentGatewayInstance;

  const env = parseServerEnv();

  if (env.PAYMENT_PROVIDER === 'mercadopago') {
    paymentGatewayInstance = createMercadoPagoGateway({
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN!,
      ...(env.MERCADOPAGO_WEBHOOK_SECRET ? { webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET } : {}),
      notificationUrl: `${getPublicEnv().NEXT_PUBLIC_WEB_URL}/api/webhooks/pagamento`,
    });
  } else {
    if (env.NODE_ENV === 'production') {
      throw new Error('PAYMENT_PROVIDER=fake não pode ser usado em produção');
    }
    paymentGatewayInstance = createFakePaymentGateway();
  }

  return paymentGatewayInstance;
}

export function getEmail(): EmailProvider {
  if (emailInstance) return emailInstance;

  const env = parseServerEnv();

  emailInstance =
    env.RESEND_API_KEY && env.EMAIL_FROM
      ? createResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
      : createFakeEmailProvider();

  return emailInstance;
}

export function getPush(): PushProvider {
  if (pushInstance) return pushInstance;

  const env = parseServerEnv();

  // Sem chaves VAPID o push simplesmente não existe — e isso é aceitável,
  // porque o WhatsApp cobre o mesmo aviso com mais alcance.
  pushInstance =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? createWebPushProvider({
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT,
        })
      : createNoopPushProvider();

  return pushInstance;
}
