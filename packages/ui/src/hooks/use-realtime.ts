'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Inscrição num canal de tempo real.
 *
 * O socket é um só por página, compartilhado entre os hooks: abrir uma conexão
 * por componente multiplicaria sockets à toa no servidor.
 */

let socketCompartilhado: Socket | null = null;
let inscritos = 0;

function obterSocket(url: string): Socket {
  socketCompartilhado ??= io(url, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    // Reconexão paciente: no interior a conexão cai e volta o tempo todo, e
    // desistir cedo deixaria a tela de pedidos muda justamente na hora ruim.
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  });

  return socketCompartilhado;
}

export interface UseRealtimeOptions {
  /// Canal autorizado pelo token (ex.: `store:abc`).
  channel: string;
  /// Token assinado pelo servidor para ESTE canal.
  token: string;
  /// Base do servidor de sockets; vazio usa a própria origem.
  url?: string;
  /// Mapa evento → tratador. Recriar o objeto a cada render é normal: o hook
  /// lê sempre a versão mais recente por referência.
  handlers: Record<string, (payload: unknown) => void>;
  enabled?: boolean;
}

export function useRealtime({
  channel,
  token,
  url,
  handlers,
  enabled = true,
}: UseRealtimeOptions): { conectado: boolean } {
  const [conectado, setConectado] = useState(false);

  // Os tratadores mudam a cada render; guardá-los numa ref evita reinscrever o
  // canal (e perder eventos) a cada renderização do componente.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !channel || !token) return;

    const socket = obterSocket(url ?? '');
    inscritos += 1;

    function inscrever() {
      socket.emit('subscribe', { channel, token }, (resposta: unknown) => {
        const ok = (resposta as { ok?: boolean } | null)?.ok === true;
        if (!ok) {
          console.error('[realtime] inscrição recusada', resposta);
        }
        setConectado(ok);
      });
    }

    // Reinscreve a cada reconexão: as salas vivem no servidor e se perdem
    // quando o socket cai.
    socket.on('connect', inscrever);
    socket.on('disconnect', () => setConectado(false));

    if (socket.connected) inscrever();

    const eventos = Object.keys(handlersRef.current);
    const ouvintes = eventos.map((evento) => {
      const ouvinte = (payload: unknown) => handlersRef.current[evento]?.(payload);
      socket.on(evento, ouvinte);
      return [evento, ouvinte] as const;
    });

    return () => {
      for (const [evento, ouvinte] of ouvintes) socket.off(evento, ouvinte);
      socket.off('connect', inscrever);
      socket.emit('unsubscribe', { channel });

      inscritos -= 1;
      // Só fecha quando ninguém mais usa: fechar no primeiro desmonte
      // derrubaria os outros hooks da mesma página.
      if (inscritos <= 0) {
        socket.close();
        socketCompartilhado = null;
        inscritos = 0;
      }
    };
    // `handlers` fica FORA das dependências de propósito: o objeto é recriado
    // a cada render e reinscreveria o canal toda vez, perdendo eventos no
    // intervalo. `handlersRef` mantém os tratadores sempre atualizados.
  }, [channel, token, url, enabled]);

  return { conectado };
}
