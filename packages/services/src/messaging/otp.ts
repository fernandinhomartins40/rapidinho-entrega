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

const SMSDEV_SEND_URL = 'https://api.smsdev.com.br/v1/send';

interface SmsDevResposta {
  situacao: string;
  codigo: string;
  id?: string;
  descricao: string;
}

/**
 * Texto do SMS. Sem acento de propósito: um acento faz o SMS sair em UCS-2,
 * que cabe 70 caracteres em vez de 160, e cada pedaço é cobrado à parte. A
 * última linha é o formato de código vinculado ao domínio, que o iPhone e o
 * Chrome no Android usam para sugerir o código no teclado.
 */
export function smsDoCodigo(code: string, minutes: number, domain: string): string {
  return `${APP_NAME}: seu codigo de acesso e ${code}. Vale por ${minutes} minutos. Nao compartilhe.\n\n@${domain} #${code}`;
}

/**
 * SMS pago pela operação, enviado pela SMSDev
 * (https://www.smsdev.com.br/envio-sms/).
 *
 * A SMSDev ecoa a chave na descrição do erro de autenticação; ela sai do texto
 * antes de virar exceção, que vai para o log e para o Sentry.
 */
export function createSmsDevOtpSender(config: { apiKey: string; domain: string }): OtpSender {
  return {
    channel: 'sms',
    async send({ phone, code, expiresInMinutes }) {
      const response = await fetch(SMSDEV_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            key: config.apiKey,
            type: 9,
            number: Number(phone.replace(/\D/g, '')),
            msg: smsDoCodigo(code, expiresInMinutes, config.domain),
          },
        ]),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`SMSDev respondeu HTTP ${response.status}`);
      }

      const corpo = (await response.json()) as SmsDevResposta | SmsDevResposta[];
      const resultado = Array.isArray(corpo) ? corpo[0] : corpo;

      if (resultado?.situacao !== 'OK') {
        const descricao = (resultado?.descricao ?? 'sem resposta').split(config.apiKey).join('***');
        throw new Error(`SMSDev recusou o envio (${resultado?.codigo ?? '?'}): ${descricao}`);
      }

      logger.info({ smsId: resultado.id }, '[otp] SMS enviado pela SMSDev');
    },
  };
}
