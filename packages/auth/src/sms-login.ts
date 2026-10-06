import { cookies } from 'next/headers';
import { completeReverseOtp, requestReverseOtp } from './otp';
import { createDatabaseSession } from './session';

/**
 * Login por confirmação reversa, do ponto de vista do navegador.
 *
 * O segredo que liga o navegador ao pedido de login fica num cookie httpOnly:
 * o JavaScript da página não o lê, e ele não aparece na tela nem no estado do
 * formulário — só o código, que é feito para ser visto.
 */

const COOKIE = 'rapidinho-sms-login';

export async function iniciarLoginPorSms(options: {
  phone: string;
  ttlSeconds: number;
  requestIp?: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const pedido = await requestReverseOtp(options);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, `${options.phone}|${pedido.browserToken}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: pedido.expiresAt,
  });

  return { code: pedido.code, expiresAt: pedido.expiresAt };
}

export type ConferenciaDoLoginPorSms =
  { status: 'ok' } | { status: 'aguardando' } | { status: 'erro'; reason: string };

/**
 * A tela pergunta de tempos em tempos se o SMS já chegou. Quando chegou, cria
 * a sessão e apaga o cookie do pedido.
 */
export async function conferirLoginPorSms(): Promise<ConferenciaDoLoginPorSms> {
  const cookieStore = await cookies();
  const valor = cookieStore.get(COOKIE)?.value;
  const [phone, browserToken] = valor?.split('|') ?? [];

  if (!phone || !browserToken) {
    return { status: 'erro', reason: 'O tempo acabou. Peça um novo código.' };
  }

  const resultado = await completeReverseOtp({ phone, browserToken });

  if (resultado.status === 'aguardando') return resultado;

  cookieStore.delete(COOKIE);
  if (resultado.status === 'erro') return resultado;

  await createDatabaseSession(resultado.userId);
  return { status: 'ok' };
}

export async function cancelarLoginPorSms(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
