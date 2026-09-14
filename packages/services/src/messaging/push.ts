import webpush from 'web-push';
import type { PushProvider, PushPayload, PushSubscriptionData } from '@rapidinho/shared';
import { logger } from '../logger';

/**
 * Web Push com VAPID.
 *
 * Sem servidor intermediário: o navegador já entrega direto ao endpoint do
 * fornecedor (FCM, Mozilla, Apple), e as chaves VAPID provam que a mensagem
 * veio de nós.
 */

interface Config {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function createWebPushProvider(config: Config): PushProvider {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  return {
    async send(subscription: PushSubscriptionData, payload: PushPayload) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          },
          JSON.stringify(payload),
          // TTL: se o aparelho estiver desligado por mais de uma hora, a
          // notificação de "saiu para entrega" já não serve para nada.
          { TTL: 3600, urgency: 'high' },
        );

        return { ok: true };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        // 404/410 = a inscrição morreu (app desinstalado, permissão revogada).
        // Quem chamou usa isto para apagar do banco, senão a tabela enche de
        // endpoints mortos e cada envio desperdiça uma requisição.
        if (status === 404 || status === 410) {
          return { ok: false, expired: true };
        }

        logger.error({ err: error, status }, '[push] falha ao enviar');
        return { ok: false };
      }
    },
  };
}

/** Provider inerte, para ambiente sem chaves VAPID configuradas. */
export function createNoopPushProvider(): PushProvider {
  return {
    async send() {
      return { ok: false };
    },
  };
}
