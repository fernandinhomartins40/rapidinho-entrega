import type { WhatsAppMessage, WhatsAppProvider } from '@rapidinho/shared';
import { logger } from '../logger';

/**
 * WhatsApp via Evolution API (self-hosted).
 *
 * No interior o WhatsApp alcança muito mais gente que push, então ele é o
 * canal principal de confirmação de pedido. A Evolution API evita depender da
 * aprovação e do custo da Cloud API da Meta na largada; trocar para a oficial
 * é escrever outra implementação desta mesma interface.
 */

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

export function createEvolutionWhatsApp(config: EvolutionConfig): WhatsAppProvider {
  return {
    name: 'evolution',

    isConfigured() {
      return Boolean(config.apiUrl && config.apiKey && config.instance);
    },

    async sendText(message: WhatsAppMessage) {
      const endpoint = `${config.apiUrl.replace(/\/$/, '')}/message/sendText/${config.instance}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.apiKey,
        },
        body: JSON.stringify({
          number: message.to.replace(/\D/g, ''),
          text: message.text,
        }),
        // A confirmação do pedido não pode segurar a resposta do checkout.
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        logger.error(
          { status: response.status, corpo: await response.text() },
          '[whatsapp] falha ao enviar',
        );
        return null;
      }

      const body = (await response.json()) as { key?: { id?: string } };
      return { messageId: body.key?.id ?? '' };
    },
  };
}

/** Implementação de desenvolvimento: registra no log em vez de enviar. */
export function createFakeWhatsApp(): WhatsAppProvider {
  return {
    name: 'fake',
    isConfigured: () => true,
    async sendText(message) {
      logger.info(`[whatsapp:fake] para ${message.to}: ${message.text}`);
      return { messageId: `fake-${Date.now()}` };
    },
  };
}
