import { getPublicEnv, parseServerEnv, REALTIME_CHANNELS } from '@rapidinho/shared';
import { createChannelToken } from '@rapidinho/shared/realtime/token';

/**
 * Emissão do token de canal.
 *
 * Fica no servidor: assinar no cliente entregaria o AUTH_SECRET ao navegador,
 * e aí qualquer um emitiria token para o canal de qualquer loja.
 */

export interface RealtimeCredenciais {
  channel: string;
  token: string;
  url: string;
}

function credenciais(channel: string, userId: string): RealtimeCredenciais {
  const env = parseServerEnv();

  return {
    channel,
    token: createChannelToken({ channel, userId }, env.AUTH_SECRET),
    // Mesma origem pública do app: o Nginx encaminha /socket.io para o
    // serviço de realtime, então não há porta extra exposta.
    url: getPublicEnv().NEXT_PUBLIC_SOCKET_URL,
  };
}

export function storeRealtime(storeId: string, userId: string): RealtimeCredenciais {
  return credenciais(REALTIME_CHANNELS.store(storeId), userId);
}

export function orderRealtime(orderId: string, userId: string): RealtimeCredenciais {
  return credenciais(REALTIME_CHANNELS.order(orderId), userId);
}

export function courierRealtime(courierId: string, userId: string): RealtimeCredenciais {
  return credenciais(REALTIME_CHANNELS.courier(courierId), userId);
}
