import { NextResponse } from 'next/server';
import { apiHandler, createDatabaseSession, verifyOtp } from '@rapidinho/auth';
import { clientIpFromHeaders, consumeRateLimit, resetRateLimit } from '@rapidinho/services';
import { parseServerEnv, RATE_LIMITS, verifyOtpSchema } from '@rapidinho/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confere o código e abre a sessão.
 *
 * O usuário é criado aqui no primeiro acesso: exigir cadastro antes de provar
 * o telefone só adicionaria uma tela que faz o cliente desistir. Nome e termos
 * são pedidos depois, na primeira compra.
 */
export const POST = apiHandler(async (request: Request) => {
  const body = await request.json();
  const { phone, code } = verifyOtpSchema.parse(body);

  const env = parseServerEnv();
  const ip = clientIpFromHeaders(request.headers);

  const limit = await consumeRateLimit(
    `otp:verify:${phone}:${ip}`,
    RATE_LIMITS.otpVerify.points,
    RATE_LIMITS.otpVerify.durationSeconds,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Peça um novo código em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const result = await verifyOtp({ phone, code, maxAttempts: env.OTP_MAX_ATTEMPTS });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  await createDatabaseSession(result.userId);
  await resetRateLimit(`otp:verify:${phone}:${ip}`);

  return NextResponse.json({
    ok: true,
    isNewUser: result.isNewUser,
    // O cliente novo cai na tela de completar o perfil.
    next: result.isNewUser ? '/completar-cadastro' : '/',
  });
});
