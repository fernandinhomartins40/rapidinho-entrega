import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { apiHandler, requireUser } from '@rapidinho/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Registro do aparelho para receber notificações.
 *
 * A inscrição é do par (usuário, aparelho): a mesma pessoa no celular e no
 * computador tem duas, e as duas recebem. O `endpoint` é único no banco, então
 * reinstalar o app troca a inscrição em vez de duplicar.
 */
const inscricaoSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const dados = inscricaoSchema.parse(await request.json());

  await prisma.pushSubscription.upsert({
    where: { endpoint: dados.endpoint },
    update: { userId: user.id, lastUsedAt: new Date() },
    create: {
      userId: user.id,
      endpoint: dados.endpoint,
      p256dh: dados.keys.p256dh,
      auth: dados.keys.auth,
      userAgent: request.headers.get('user-agent'),
    },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await request.json());

  // Filtrado pelo dono: ninguém cancela a inscrição de outra pessoa mandando
  // o endpoint dela.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });

  return NextResponse.json({ ok: true });
});
