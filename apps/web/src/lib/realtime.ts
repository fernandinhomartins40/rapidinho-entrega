import { getPublicEnv, parseServerEnv, REALTIME_CHANNELS } from '@rapidinho/shared';
import { createChannelToken } from '@rapidinho/shared/realtime/token';

/**
 * Emissão do token de canal.
 *
 * Fica no servidor: assinar no cliente entregaria o AUTH_SECRET ao navegador,
 * e aí qualquer um emitiria token para o canal de qualquer pedido.
 */

export interface RealtimeCredenciais {
  channel: string;
  token: string;
  url: string;
}

export function orderRealtime(orderId: string, userId: string): RealtimeCredenciais {
  const channel = REALTIME_CHANNELS.order(orderId);

  return {
    channel,
    token: createChannelToken({ channel, userId }, parseServerEnv().AUTH_SECRET),
    url: getPublicEnv().NEXT_PUBLIC_SOCKET_URL,
  };
}
