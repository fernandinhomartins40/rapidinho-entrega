import { createServer } from 'node:http';
import { Redis } from 'ioredis';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { REALTIME_BRIDGE_CHANNEL, type RealtimeMessage } from '@rapidinho/shared/realtime';
import { verifyChannelToken } from '@rapidinho/shared/realtime/token';
import { logger } from './logger';

/**
 * Servidor de tempo real.
 *
 * Existe como processo separado porque o Next em modo standalone não expõe o
 * servidor HTTP para anexar um WebSocket. Ele não fala com o Postgres: a
 * autorização de canal é um token assinado pelo Next, conferido aqui em
 * microssegundos.
 *
 * O fluxo é: Server Action → publica no Redis → este processo → socket do
 * navegador. Assim o Next continua sem estado e pode escalar horizontalmente
 * sem que um pedido chegue só a quem calhou de estar na instância certa.
 */

function obrigatorio(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ausente: ${nome}`);
  }
  return valor;
}

const PORT = Number(process.env.REALTIME_PORT ?? 3002);
const REDIS_URL = obrigatorio('REDIS_URL');
// O mesmo segredo que o Next usa para assinar: é o que liga as duas pontas.
const AUTH_SECRET = obrigatorio('AUTH_SECRET');

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'realtime' }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server(httpServer, {
  path: '/socket.io',
  // O Nginx já restringe a origem; aqui aceitamos o proxy, e a autorização de
  // verdade é o token por canal, não o cabeçalho Origin (que é falsificável
  // fora do navegador).
  cors: { origin: true, credentials: true },
  // Conexão de interior cai muito: uma janela de recuperação generosa evita
  // que o lojista perca o alerta de pedido por causa de um túnel de 3G.
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  transports: ['websocket', 'polling'],
});

const pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const subClient = pubClient.duplicate();

// Adapter de Redis: com mais de uma instância deste servidor, um evento
// publicado numa chega às demais.
io.adapter(createAdapter(pubClient, subClient));

/**
 * Um socket só entra numa sala apresentando um token válido PARA AQUELA sala.
 * Sem isso, qualquer cliente conectado ouviria os pedidos de qualquer loja
 * bastando adivinhar o id.
 */
function registrarInscricoes(socket: Socket): void {
  socket.on('subscribe', (dados: unknown, confirmar?: (resposta: unknown) => void) => {
    const entrada = dados as { channel?: unknown; token?: unknown } | null;
    const channel = typeof entrada?.channel === 'string' ? entrada.channel : null;
    const token = typeof entrada?.token === 'string' ? entrada.token : null;

    if (!channel || !token) {
      confirmar?.({ ok: false, error: 'Canal ou token ausente' });
      return;
    }

    const payload = verifyChannelToken(token, AUTH_SECRET);

    if (!payload || payload.channel !== channel) {
      confirmar?.({ ok: false, error: 'Token inválido para este canal' });
      return;
    }

    void socket.join(channel);
    confirmar?.({ ok: true, channel });
  });

  socket.on('unsubscribe', (dados: unknown) => {
    const channel = (dados as { channel?: unknown } | null)?.channel;
    if (typeof channel === 'string') {
      void socket.leave(channel);
    }
  });
}

io.on('connection', registrarInscricoes);

/** Ponte Redis → sockets: é por aqui que os eventos do Next chegam. */
const bridgeClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

await bridgeClient.subscribe(REALTIME_BRIDGE_CHANNEL);

bridgeClient.on('message', (_canalRedis: string, bruto: string) => {
  try {
    const mensagem = JSON.parse(bruto) as RealtimeMessage;

    if (typeof mensagem.channel !== 'string' || typeof mensagem.event !== 'string') {
      logger.warn('[realtime] mensagem malformada descartada');
      return;
    }

    io.to(mensagem.channel).emit(mensagem.event, mensagem.payload);
  } catch (error) {
    // Uma mensagem inválida não pode derrubar a ponte: o próximo pedido
    // precisa continuar chegando.
    logger.error({ err: error }, '[realtime] falha ao processar mensagem');
  }
});

for (const cliente of [pubClient, subClient, bridgeClient]) {
  cliente.on('error', (error: Error) => {
    logger.error({ err: error.message }, '[realtime] erro no Redis');
  });
}

httpServer.listen(PORT, () => {
  logger.info({ porta: PORT }, '[realtime] escutando');
});

/**
 * Encerramento limpo: sem isso o container leva o SIGTERM e corta as conexões
 * no meio, e todo lojista conectado vê um erro em vez de uma reconexão.
 */
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    logger.info({ sinal }, '[realtime] encerrando');
    io.close(() => {
      void Promise.all([pubClient.quit(), subClient.quit(), bridgeClient.quit()]).finally(() => {
        process.exit(0);
      });
    });
  });
}
