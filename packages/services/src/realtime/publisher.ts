import { REALTIME_BRIDGE_CHANNEL, type RealtimeMessage } from '@rapidinho/shared/realtime';
import { getRedis } from '../redis';

/**
 * Publicação de eventos em tempo real.
 *
 * O app Next não mantém sockets: ele publica no Redis e o serviço de realtime
 * entrega a quem estiver inscrito. Isso mantém o Next sem estado — dá para
 * rodar várias instâncias sem que um pedido chegue só a quem calhou de estar
 * conectado na instância certa.
 */

export async function publishRealtime(
  channel: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const mensagem: RealtimeMessage = { channel, event, payload, at: Date.now() };

  try {
    await getRedis().publish(REALTIME_BRIDGE_CHANNEL, JSON.stringify(mensagem));
  } catch (error) {
    // Realtime é melhoria de experiência, não fonte de verdade: o pedido já
    // está no banco e a tela do lojista recarrega. Derrubar a Server Action
    // porque o Redis piscou seria trocar um aviso perdido por uma venda
    // perdida.
    console.error('[realtime] falha ao publicar', { channel, event, error });
  }
}

/** Publica o mesmo evento em vários canais (loja + pedido + entregador). */
export async function publishRealtimeMany(
  channels: readonly string[],
  event: string,
  payload: unknown,
): Promise<void> {
  await Promise.all(channels.map((channel) => publishRealtime(channel, event, payload)));
}
