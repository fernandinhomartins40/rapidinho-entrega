import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler, autenticarPorSenha } from '@rapidinho/auth';
import { clientIpFromHeaders, consumeRateLimit, logger } from '@rapidinho/services';
import { parseServerEnv, RATE_LIMITS } from '@rapidinho/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().max(200),
  senha: z.string().max(200),
});

/**
 * Login do app gateway: e-mail e senha trocados pelo token do app, para
 * ninguém precisar copiar o token do painel para o celular.
 *
 * Poucas tentativas por IP: quem acerta a senha passa a confirmar login de
 * qualquer número.
 */
export const POST = apiHandler(async (request: Request) => {
  const ip = clientIpFromHeaders(request.headers);
  const limite = await consumeRateLimit(
    `sms-app-login:${ip}`,
    RATE_LIMITS.senhaLogin.points,
    RATE_LIMITS.senhaLogin.durationSeconds,
  );
  if (!limite.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Espere alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(limite.retryAfterSeconds) } },
    );
  }

  const dados = loginSchema.safeParse(await request.json().catch(() => ({})));
  const userId = dados.success
    ? await autenticarPorSenha(dados.data.email, dados.data.senha)
    : null;
  // O token só existe com o login por SMS configurado no servidor.
  const token = userId ? parseServerEnv().SMS_GATEWAY_TOKEN : null;

  if (!token) {
    logger.warn({ ip }, '[sms-gateway] login do app recusado');
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  logger.info({ ip }, '[sms-gateway] login do app');
  return NextResponse.json({ token });
});
