import { logger } from './logger';

/**
 * Captura de erro.
 *
 * O Sentry entra por variável de ambiente. Sem DSN configurado, o erro vai
 * para o log estruturado — que já é o suficiente numa operação de uma cidade,
 * e evita obrigar quem sobe o projeto a criar conta em serviço de terceiro só
 * para o app rodar.
 *
 * A importação é dinâmica de propósito: sem DSN, o SDK — que passa de 2 MB —
 * nunca é carregado, e o processo não paga pelo peso de inicializá-lo.
 */

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureException: (erro: unknown, contexto?: Record<string, unknown>) => void;
  setUser: (usuario: { id: string } | null) => void;
};

let sentry: SentryModule | null = null;
let tentouCarregar = false;

async function carregarSentry(): Promise<SentryModule | null> {
  if (tentouCarregar) return sentry;
  tentouCarregar = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    const modulo = (await import('@sentry/node')) as unknown as SentryModule;

    modulo.init({
      dsn,
      environment: process.env.NODE_ENV,
      // 10% das transações: o suficiente para ver tendência sem estourar a
      // cota gratuita nem pesar na VPS compartilhada.
      tracesSampleRate: 0.1,
      // O telefone é o identificador de login aqui; mandá-lo para um serviço
      // externo seria transferir dado pessoal sem necessidade.
      sendDefaultPii: false,
      beforeSend(evento: Record<string, unknown>) {
        const usuario = evento.user as Record<string, unknown> | undefined;
        if (usuario) {
          delete usuario.email;
          delete usuario.ip_address;
          delete usuario.phone;
        }
        return evento;
      },
    });

    sentry = modulo;
    logger.info('[observabilidade] Sentry ativo');
  } catch (erro) {
    // Falhar ao iniciar o monitoramento não pode derrubar o app: o log
    // estruturado continua registrando tudo.
    logger.warn({ erro }, '[observabilidade] não foi possível iniciar o Sentry');
  }

  return sentry;
}

/**
 * Registra um erro.
 *
 * Sempre grava no log; manda ao Sentry quando houver DSN. Nunca lança: um erro
 * ao reportar erro não pode derrubar o fluxo que já estava com problema.
 */
export async function capturarErro(
  erro: unknown,
  contexto?: Record<string, unknown>,
): Promise<void> {
  logger.error({ err: erro, ...contexto }, 'erro capturado');

  try {
    const modulo = await carregarSentry();
    modulo?.captureException(erro, contexto ? { extra: contexto } : undefined);
  } catch {
    // Silêncio proposital: já registramos no log acima.
  }
}

/** Associa os próximos eventos a um usuário, sem enviar dado pessoal. */
export async function identificarUsuario(userId: string | null): Promise<void> {
  try {
    const modulo = await carregarSentry();
    modulo?.setUser(userId ? { id: userId } : null);
  } catch {
    // Ver acima.
  }
}
