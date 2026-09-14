/**
 * Contrato do tempo real — parte pura.
 *
 * Sem `node:crypto`: este arquivo é exportado pelo índice do pacote e chega ao
 * bundle do navegador junto com `formatCents` e companhia. A assinatura do
 * token vive em `./token`, importado só pelo servidor.
 */

/** Validade curta: o token é emitido a cada carregamento de página. */
export const CHANNEL_TOKEN_TTL_SECONDS = 60 * 60 * 8;

export interface ChannelTokenPayload {
  /// Canal ao qual o token dá acesso (ex.: `store:abc123`).
  channel: string;
  /// Usuário para quem foi emitido — serve para log e para revogação futura.
  userId: string;
  /// Epoch em segundos.
  expiresAt: number;
}

/** Canal do Redis por onde o Next publica para o servidor de sockets. */
export const REALTIME_BRIDGE_CHANNEL = 'rapidinho:realtime';

export interface RealtimeMessage {
  channel: string;
  event: string;
  payload: unknown;
  /// Epoch em ms; o cliente usa para descartar mensagem atrasada.
  at: number;
}
