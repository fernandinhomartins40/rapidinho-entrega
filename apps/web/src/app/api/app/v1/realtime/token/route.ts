import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirEntregadorDoToken, exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import {
  CHANNEL_TOKEN_TTL_SECONDS,
  getPublicEnv,
  parseServerEnv,
  REALTIME_CHANNELS,
} from '@rapidinho/shared';
import type { RespostaTokenDeTempoReal } from '@rapidinho/shared/app-api';
import { createChannelToken } from '@rapidinho/shared/realtime/token';
import { naoEncontrado } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parametrosSchema = z.discriminatedUnion('canal', [
  z.object({ canal: z.literal('pedido'), id: z.string().min(1) }),
  z.object({ canal: z.literal('entregador') }),
]);

/**
 * Token de sala do Socket.io. A sala do pedido traz a posição do entregador, por
 * isso só o dono do pedido recebe; a do entregador é sempre a do próprio.
 */
export const GET = rotaDoApp(async (request: Request) => {
  const parametros = parametrosSchema.parse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  let canal: string;
  let userId: string;

  if (parametros.canal === 'entregador') {
    const { user, courierId } = await exigirEntregadorDoToken(request);
    canal = REALTIME_CHANNELS.courier(courierId);
    userId = user.id;
  } else {
    const user = await exigirUsuarioDoToken(request);
    const pedido = await prisma.order.findFirst({
      where: { id: parametros.id, userId: user.id },
      select: { id: true },
    });
    if (!pedido) throw naoEncontrado('Pedido não encontrado.');

    canal = REALTIME_CHANNELS.order(pedido.id);
    userId = user.id;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + CHANNEL_TOKEN_TTL_SECONDS;

  const resposta: RespostaTokenDeTempoReal = {
    canal,
    token: createChannelToken({ channel: canal, userId, expiresAt }, parseServerEnv().AUTH_SECRET),
    url: getPublicEnv().NEXT_PUBLIC_SOCKET_URL,
    expiraEm: new Date(expiresAt * 1000).toISOString(),
  };

  return NextResponse.json(resposta);
});
