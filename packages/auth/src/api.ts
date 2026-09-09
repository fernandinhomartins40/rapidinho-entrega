import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthorizationError } from './guards';

/**
 * Converte exceções em respostas HTTP previsíveis.
 *
 * Sem isto, uma falta de permissão viraria 500 e o cliente mostraria "erro
 * inesperado" para o que na verdade é "faça login". A mensagem devolvida é
 * sempre em português e voltada ao usuário; o detalhe técnico fica no log.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Dados inválidos',
        issues: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }

  console.error('[api] erro não tratado', error);
  return NextResponse.json({ error: 'Erro inesperado. Tente de novo.' }, { status: 500 });
}

/** Envolve um handler de rota, traduzindo exceções em resposta. */
export function apiHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
