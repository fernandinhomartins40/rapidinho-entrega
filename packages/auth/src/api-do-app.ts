import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { capturarErro } from '@rapidinho/services/observability';
import type { CodigoDeErro, ErroDaApiDoApp } from '@rapidinho/shared/app-api';
import { AuthorizationError } from './erros';

/**
 * Par do `apiHandler` para a API do app: mesma ideia, com o erro no formato do
 * contrato (`{ erro, codigo }`). O `apiHandler` segue como está porque as rotas
 * do site e o app gateway dependem do `{ error }` dele.
 */

const STATUS_DO_CODIGO: Partial<Record<CodigoDeErro, number>> = {
  NAO_AUTENTICADO: 401,
  PROIBIDO: 403,
  NAO_ENCONTRADO: 404,
  CONFLITO: 409,
  CARRINHO_VAZIO: 409,
  LOJA_INDISPONIVEL: 409,
  LOJA_FECHADA: 409,
  ESTOQUE_INSUFICIENTE: 409,
  CHAVE_REUTILIZADA: 409,
  CONTA_COM_ATIVIDADE: 409,
  PEDIDO_DE_ACESSO_ENCERRADO: 410,
  TOKEN_FIREBASE_INVALIDO: 401,
  FIREBASE_DESLIGADO: 503,
  FIREBASE_INDISPONIVEL: 503,
  MUITAS_TENTATIVAS: 429,
  ARMAZENAMENTO_INDISPONIVEL: 503,
};

/** Regra e validação recusadas viram 422, como os erros de campo do site. */
export function statusDoCodigo(codigo: CodigoDeErro): number {
  return STATUS_DO_CODIGO[codigo] ?? 422;
}

/** Erro esperado de uma rota: a mensagem vai ao cliente como está. */
export class ErroDaRota extends Error {
  constructor(
    message: string,
    readonly codigo: CodigoDeErro,
    readonly status: number = statusDoCodigo(codigo),
    readonly cabecalhos?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ErroDaRota';
  }
}

function respostaDeErro(
  erro: string,
  status: number,
  codigo: CodigoDeErro,
  cabecalhos?: Record<string, string>,
): NextResponse<ErroDaApiDoApp> {
  return NextResponse.json(
    { erro, codigo },
    { status, ...(cabecalhos ? { headers: cabecalhos } : {}) },
  );
}

export function erroParaResposta(error: unknown): NextResponse<ErroDaApiDoApp> {
  if (error instanceof ErroDaRota) {
    return respostaDeErro(error.message, error.status, error.codigo, error.cabecalhos);
  }

  if (error instanceof AuthorizationError) {
    return respostaDeErro(
      error.message,
      error.status,
      error.status === 401 ? 'NAO_AUTENTICADO' : 'PROIBIDO',
    );
  }

  if (error instanceof ZodError) {
    const primeiro = error.issues[0];
    return respostaDeErro(primeiro?.message ?? 'Dados inválidos.', 422, 'DADOS_INVALIDOS');
  }

  void capturarErro(error, { origem: 'api-do-app' });
  return respostaDeErro('Erro inesperado. Tente de novo.', 500, 'ERRO_INTERNO');
}

/** Envolve um handler de rota do app, traduzindo exceções em resposta. */
export function rotaDoApp<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      return erroParaResposta(error);
    }
  };
}
