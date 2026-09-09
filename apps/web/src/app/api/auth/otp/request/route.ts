import { NextResponse } from 'next/server';
import { apiHandler, requestOtp } from '@rapidinho/auth';
import { clientIpFromHeaders, consumeRateLimit, getOtpSender } from '@rapidinho/services';
import { parseServerEnv, RATE_LIMITS, requestOtpSchema } from '@rapidinho/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Envia o código de acesso por WhatsApp.
 *
 * Dois limites independentes: por telefone (protege o dono do número de ser
 * bombardeado) e por IP (protege o crédito de envio da operação). A resposta é
 * sempre igual, com ou sem cadastro — dizer "número não existe" entregaria a
 * base de clientes a quem enumerar telefones.
 */
export const POST = apiHandler(async (request: Request) => {
  const body = await request.json();
  const { phone } = requestOtpSchema.parse(body);

  const env = parseServerEnv();
  const ip = clientIpFromHeaders(request.headers);

  const byPhone = await consumeRateLimit(
    `otp:request:phone:${phone}`,
    RATE_LIMITS.otpRequest.points,
    RATE_LIMITS.otpRequest.durationSeconds,
  );

  const byIp = await consumeRateLimit(
    `otp:request:ip:${ip}`,
    RATE_LIMITS.otpRequest.points * 3,
    RATE_LIMITS.otpRequest.durationSeconds,
  );

  if (!byPhone.allowed || !byIp.allowed) {
    const retryAfter = Math.max(byPhone.retryAfterSeconds, byIp.retryAfterSeconds);
    return NextResponse.json(
      {
        error: `Muitas tentativas. Tente de novo em ${Math.ceil(retryAfter / 60)} minutos.`,
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const result = await requestOtp({
    phone,
    sender: getOtpSender(),
    ttlSeconds: env.OTP_TTL_SECONDS,
    requestIp: ip,
    exposeCode: env.NODE_ENV === 'development',
  });

  return NextResponse.json({
    sent: true,
    expiresAt: result.expiresAt.toISOString(),
    ...(result.code ? { devCode: result.code } : {}),
  });
});
