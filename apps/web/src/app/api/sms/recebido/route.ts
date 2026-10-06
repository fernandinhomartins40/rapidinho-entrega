import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler, confirmInboundSms } from '@rapidinho/auth';
import {
  clientIpFromHeaders,
  consumeRateLimit,
  gatewayAutorizado,
  logger,
  registrarSinalDoGateway,
} from '@rapidinho/services';
import { parseServerEnv, RATE_LIMITS } from '@rapidinho/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const smsSchema = z.object({
  /** Remetente como a operadora entregou. */
  from: z.string().trim().min(3).max(40),
  body: z.string().max(2000),
  /** Quando o celular recebeu (ms desde 1970), só para o log. */
  receivedAt: z.number().int().optional(),
});

/**
 * SMS recebido pelo celular gateway (app Android da operação).
 *
 * Responde 200 para todo SMS processado, casando ou não: "não casou" é
 * resultado, não erro, e um erro faria o app tentar de novo para sempre um SMS
 * qualquer (propaganda, recado). O app só repete quando a resposta não é 2xx.
 */
export const POST = apiHandler(async (request: Request) => {
  if (!gatewayAutorizado(request.headers)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const limite = await consumeRateLimit(
    `sms-gateway:${clientIpFromHeaders(request.headers)}`,
    RATE_LIMITS.smsGateway.points,
    RATE_LIMITS.smsGateway.durationSeconds,
  );
  if (!limite.allowed) {
    return NextResponse.json(
      { error: 'Muitos SMS de uma vez.' },
      { status: 429, headers: { 'Retry-After': String(limite.retryAfterSeconds) } },
    );
  }

  const sms = smsSchema.parse(await request.json());
  const resultado = await confirmInboundSms({
    from: sms.from,
    body: sms.body,
    maxAttempts: parseServerEnv().OTP_MAX_ATTEMPTS,
  });

  // O texto do SMS não vai para o log: pode ser mensagem pessoal de alguém.
  logger.info(
    { casou: resultado.matched, motivo: resultado.matched ? undefined : resultado.reason },
    '[sms-gateway] SMS recebido',
  );

  await registrarSinalDoGateway(resultado.matched ? { ultimoSms: new Date().toISOString() } : {});

  return NextResponse.json({ ok: true, matched: resultado.matched });
});
