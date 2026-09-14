import { APP_NAME, type OtpSender, type WhatsAppProvider } from '@rapidinho/shared';
import { logger } from '../logger';

/** Texto do código. Curto de propósito: aparece inteiro na prévia da notificação. */
function otpMessage(code: string, minutes: number): string {
  return `${code} é o seu código de acesso ao ${APP_NAME}. Vale por ${minutes} minutos. Nunca compartilhe este código.`;
}

export function createWhatsAppOtpSender(whatsapp: WhatsAppProvider): OtpSender {
  return {
    channel: 'whatsapp',
    async send({ phone, code, expiresInMinutes }) {
      await whatsapp.sendText({ to: phone, text: otpMessage(code, expiresInMinutes) });
    },
  };
}

/**
 * Desenvolvimento: imprime o código no log do servidor.
 * Nunca deve ser o provedor em produção — a validação de env barra isso.
 */
export function createConsoleOtpSender(): OtpSender {
  return {
    channel: 'console',
    async send({ phone, code, expiresInMinutes }) {
      logger.warn(`[otp] ${phone} → código ${code} (expira em ${expiresInMinutes} min)`);
    },
  };
}
