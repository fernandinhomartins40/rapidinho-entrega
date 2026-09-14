'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createDatabaseSession, requestOtp, verifyOtp } from '@rapidinho/auth';
import {
  clientIpFromHeaders,
  consumeRateLimit,
  getOtpSender,
  resetRateLimit,
} from '@rapidinho/services';
import { parseServerEnv, RATE_LIMITS, requestOtpSchema, verifyOtpSchema } from '@rapidinho/shared';

/**
 * Login do cliente por telefone e código.
 *
 * Sem e-mail e sem senha: no interior, exigir cadastro completo antes da
 * primeira compra é a maior causa de desistência. O usuário é criado no
 * primeiro código confirmado; nome e termos vêm depois, no checkout.
 *
 * Mesma proteção de força bruta do painel — o limite é por telefone E por IP,
 * porque travar só por IP não protege um número alvo, e o contrário deixa
 * passar quem varre vários números do mesmo lugar.
 */

export interface LoginState {
  step: 'phone' | 'code';
  phone?: string;
  error?: string;
  /// Em desenvolvimento o código volta aqui, para não depender do WhatsApp.
  devCode?: string;
}

export const LOGIN_INITIAL_STATE: LoginState = { step: 'phone' };

async function currentIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export async function autenticar(previous: LoginState, formData: FormData): Promise<LoginState> {
  const intencao = formData.get('intencao');

  if (intencao === 'trocar-telefone') {
    return LOGIN_INITIAL_STATE;
  }

  return intencao === 'verificar' ? verificarCodigo(previous, formData) : solicitarCodigo(formData);
}

async function solicitarCodigo(formData: FormData): Promise<LoginState> {
  const parsed = requestOtpSchema.safeParse({ phone: formData.get('phone') });

  if (!parsed.success) {
    return { step: 'phone', error: 'Informe um telefone válido com DDD.' };
  }

  const { phone } = parsed.data;
  const env = parseServerEnv();

  const limit = await consumeRateLimit(
    `otp:request:phone:${phone}`,
    RATE_LIMITS.otpRequest.points,
    RATE_LIMITS.otpRequest.durationSeconds,
  );

  if (!limit.allowed) {
    return {
      step: 'phone',
      error: `Muitas tentativas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} minutos.`,
    };
  }

  const result = await requestOtp({
    phone,
    sender: getOtpSender(),
    ttlSeconds: env.OTP_TTL_SECONDS,
    requestIp: await currentIp(),
    exposeCode: env.NODE_ENV === 'development',
  });

  return { step: 'code', phone, ...(result.code ? { devCode: result.code } : {}) };
}

async function verificarCodigo(previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = verifyOtpSchema.safeParse({
    phone: previous.phone,
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return { ...previous, error: 'O código tem 6 números.' };
  }

  const { phone, code } = parsed.data;
  const env = parseServerEnv();
  const limitKey = `otp:verify:${phone}:${await currentIp()}`;

  const limit = await consumeRateLimit(
    limitKey,
    RATE_LIMITS.otpVerify.points,
    RATE_LIMITS.otpVerify.durationSeconds,
  );

  if (!limit.allowed) {
    return { ...previous, error: 'Muitas tentativas. Peça um novo código.' };
  }

  const result = await verifyOtp({ phone, code, maxAttempts: env.OTP_MAX_ATTEMPTS });

  if (!result.ok) {
    return { ...previous, error: result.reason };
  }

  await createDatabaseSession(result.userId);
  await resetRateLimit(limitKey);

  // Só caminho interno: um destino absoluto viraria redirecionamento aberto,
  // de graça, para quem montar o link.
  const destino = String(formData.get('destino') ?? '/');
  redirect(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/');
}
