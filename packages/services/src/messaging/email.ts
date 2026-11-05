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

/** E-mail transacional pelo Velomail, com o domínio autenticado no painel deles. */
export function createVelomailEmailProvider(
  apiKey: string,
  from: string,
  apiUrl: string,
): EmailProvider {
  // O Velomail recusa "Nome <email>" no `from`: o nome vai em `from_name`.
  const partes = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  const remetente = partes ? partes[2]!.trim() : from.trim();
  const nome = partes?.[1]?.replace(/^"|"$/g, '').trim();

  return {
    name: 'velomail',

    async send(message: EmailMessage) {
      try {
        const resposta = await fetch(`${apiUrl.replace(/\/$/, '')}/emails/send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({
            from: remetente,
            ...(nome ? { from_name: nome } : {}),
            to: message.to,
            subject: message.subject,
            html: message.html,
            ...(message.text ? { text: message.text } : {}),
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
            // Link de senha não pode passar por redirecionador de clique.
            tracking_enabled: false,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        const corpo = (await resposta.json().catch(() => null)) as {
          success?: boolean;
          message?: string;
          details?: unknown;
          message_id?: string;
          id?: string | number;
          data?: { id?: string | number };
        } | null;

        if (!resposta.ok || corpo?.success !== true) {
          // O motivo vem em `details` (campo e mensagem), sem dado do destinatário.
          logger.error(
            { status: resposta.status, detalhes: corpo?.details ?? corpo?.message },
            '[email] Velomail recusou',
          );
          return null;
        }

        const id = corpo.message_id ?? corpo.id ?? corpo.data?.id;
        return { id: id != null ? String(id) : `velomail_${Date.now()}` };
      } catch (error) {
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
