import { NextResponse } from 'next/server';
import type { ZodTypeAny, z } from 'zod';
import { ErroDaRota, type CurrentUser } from '@rapidinho/auth';
import { clientIpFromHeaders, consumeRateLimit } from '@rapidinho/services';
import { RATE_LIMITS } from '@rapidinho/shared';
import type { CodigoDeErro } from '@rapidinho/shared/app-api';

/** Peças comuns das rotas de `api/app/v1`. */

type Limite = { points: number; durationSeconds: number };

/** Corpo validado. JSON quebrado cai na mesma resposta de dado inválido. */
export async function lerCorpo<T extends ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  const corpo: unknown = await request.json().catch(() => undefined);
  return schema.parse(corpo ?? {});
}

export async function limitar(chave: string, limite: Limite): Promise<void> {
  const resultado = await consumeRateLimit(chave, limite.points, limite.durationSeconds);

  if (!resultado.allowed) {
    throw new ErroDaRota('Muitas tentativas. Espere um pouco.', 'MUITAS_TENTATIVAS', 429, {
      'Retry-After': String(resultado.retryAfterSeconds),
    });
  }
}

/** Escrita comum: por usuário, porque o IP do interior é dividido (CGNAT). */
export function limitarEscrita(user: CurrentUser): Promise<void> {
  return limitar(`app:escrita:${user.id}`, RATE_LIMITS.appEscrita);
}

export function limitarPorIp(request: Request, nome: string, limite: Limite): Promise<void> {
  return limitar(`app:${nome}:${clientIpFromHeaders(request.headers)}`, limite);
}

type ResultadoDaRegra<T> =
  ({ ok: true; message?: string } & T) | { ok: false; message: string; codigo: CodigoDeErro };

/** Falha de regra vira erro da rota; sucesso segue com os dados. */
export function exigirOk<T extends object>(
  resultado: ResultadoDaRegra<T>,
): { ok: true; message?: string } & T {
  if (!resultado.ok) throw new ErroDaRota(resultado.message, resultado.codigo);
  return resultado;
}

export function okCom(resultado: { message?: string }): NextResponse {
  return NextResponse.json({
    ok: true,
    ...(resultado.message ? { mensagem: resultado.message } : {}),
  });
}

export function naoEncontrado(mensagem: string): ErroDaRota {
  return new ErroDaRota(mensagem, 'NAO_ENCONTRADO');
}
