import { Resend } from 'resend';
import type { EmailMessage, EmailProvider } from '@rapidinho/shared';
import { logger } from '../logger';

/**
 * E-mail transacional pelo Resend.
 *
 * Canal secundário de propósito: no interior, muito cliente não usa e-mail com
 * frequência. Serve para comprovante, recuperação e comunicação com o lojista,
 * não para avisar que o pedido saiu para entrega — isso é WhatsApp e push.
 */

export function createResendEmailProvider(apiKey: string, from: string): EmailProvider {
  const resend = new Resend(apiKey);

  return {
    name: 'resend',

    async send(message: EmailMessage) {
      try {
        const resultado = await resend.emails.send({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          ...(message.text ? { text: message.text } : {}),
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        });

        if (resultado.error) {
          logger.error({ err: resultado.error }, '[email] Resend recusou');
          return null;
        }

        return resultado.data ? { id: resultado.data.id } : null;
      } catch (error) {
        // E-mail é o canal menos crítico: falhar aqui não pode derrubar o
        // fluxo que o disparou.
        logger.error({ err: error }, '[email] falha ao enviar');
        return null;
      }
    },
  };
}

export function createFakeEmailProvider(): EmailProvider {
  return {
    name: 'fake',

    async send(message: EmailMessage) {
      logger.info({ assunto: message.subject, para: message.to }, '[email:fake] não enviado');
      return { id: `fake_${Date.now()}` };
    },
  };
}
