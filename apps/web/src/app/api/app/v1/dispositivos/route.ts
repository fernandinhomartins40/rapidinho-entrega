import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirSessaoDoToken, rotaDoApp } from '@rapidinho/auth';
import { registrarDispositivo } from '@rapidinho/services/regras';
import { lerCorpo, limitarEscrita } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({
  expoPushToken: z
    .string()
    .max(200)
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Token de aparelho inválido'),
  plataforma: z.enum(['android', 'ios']),
});

export const POST = rotaDoApp(async (request: Request) => {
  const { sessionId, user } = await exigirSessaoDoToken(request);
  await limitarEscrita(user);

  const dados = await lerCorpo(request, entradaSchema);
  await registrarDispositivo({ ...dados, userId: user.id, sessionId });

  return NextResponse.json({ ok: true });
});
