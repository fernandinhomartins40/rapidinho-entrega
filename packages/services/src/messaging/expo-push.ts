import { logger } from '../logger';

/**
 * Push do app nativo pela Expo Push API, que entrega pelo FCM no Android.
 *
 * Interface própria, separada do Web Push: lá cada envio vai a um endpoint do
 * navegador; aqui vai tudo a um só serviço, em lote, e a resposta diz quais
 * aparelhos saíram do ar.
 */

export interface ExpoPushMensagem {
  tokens: string[];
  title: string;
  body: string;
  /** Lido pelo app ao tocar na notificação. */
  data?: Record<string, string>;
}

export interface ExpoPushResultado {
  enviados: number;
  /** Aparelhos que desinstalaram o app: quem chamou apaga do banco. */
  invalidos: string[];
}

export interface ExpoPushProvider {
  send(mensagem: ExpoPushMensagem): Promise<ExpoPushResultado>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Limite da Expo por requisição. */
const POR_LOTE = 100;

interface Recibo {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export function createExpoPushProvider(enviar: typeof fetch = fetch): ExpoPushProvider {
  return {
    async send({ tokens, title, body, data }) {
      let enviados = 0;
      const invalidos: string[] = [];

      for (let inicio = 0; inicio < tokens.length; inicio += POR_LOTE) {
        const lote = tokens.slice(inicio, inicio + POR_LOTE);

        const resposta = await enviar(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(
            lote.map((to) => ({ to, title, body, sound: 'default', priority: 'high', data })),
          ),
          // O envio roda dentro da ação de quem avançou o pedido, que não pode
          // ficar presa num serviço que não responde.
          signal: AbortSignal.timeout(10_000),
        });

        if (!resposta.ok) throw new Error(`Expo Push respondeu HTTP ${resposta.status}`);

        const { data: recibos } = (await resposta.json()) as { data: Recibo[] };

        recibos.forEach((recibo, indice) => {
          if (recibo.status === 'ok') enviados += 1;
          else if (recibo.details?.error === 'DeviceNotRegistered') invalidos.push(lote[indice]!);
        });
      }

      return { enviados, invalidos };
    },
  };
}

/** Desenvolvimento e teste: registra no log e não sai da máquina. */
export function createConsoleExpoPushProvider(): ExpoPushProvider {
  return {
    async send({ tokens, title }) {
      logger.info({ aparelhos: tokens.length, title }, '[expo-push] envio simulado');
      return { enviados: tokens.length, invalidos: [] };
    },
  };
}
