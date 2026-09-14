import { prisma } from '@rapidinho/database';
import type { PushPayload } from '@rapidinho/shared';
import { getEmail, getPush, getWhatsApp } from '../providers';
import { logger } from '../logger';

/**
 * Envio de notificação ao usuário.
 *
 * Regra que orienta a escolha de canal: no interior o WhatsApp tem muito mais
 * alcance que push. Quem não instalou o PWA — a maioria, no começo — não tem
 * como receber push, e ficaria sem saber que o pedido saiu.
 *
 * Então push e WhatsApp saem JUNTOS para o que é urgente (mudança de status do
 * pedido), e não um como reserva do outro: esperar o push falhar para só então
 * mandar WhatsApp atrasaria o aviso justamente em quem mais precisa dele.
 */

export type CanalDeNotificacao = 'PUSH' | 'WHATSAPP' | 'EMAIL';

export interface NotificacaoInput {
  userId: string;
  title: string;
  body: string;
  /// Caminho interno aberto ao tocar na notificação.
  url?: string;
  canais: CanalDeNotificacao[];
  /// Liga a notificação ao pedido/loja que a originou.
  entity?: { type: string; id: string };
  /// Agrupa notificações do mesmo assunto em vez de empilhar.
  tag?: string;
}

/**
 * Envia e registra. Nunca lança: notificação é efeito colateral, e derrubar a
 * ação que a disparou seria trocar um aviso perdido por uma venda perdida.
 */
export async function notificarUsuario(entrada: NotificacaoInput): Promise<void> {
  const usuario = await prisma.user.findUnique({
    where: { id: entrada.userId },
    select: { id: true, phone: true, email: true, name: true },
  });

  if (!usuario) return;

  await Promise.allSettled([
    entrada.canais.includes('PUSH') ? enviarPush(entrada) : null,
    entrada.canais.includes('WHATSAPP') && usuario.phone
      ? enviarWhatsApp(entrada, usuario.phone)
      : null,
    entrada.canais.includes('EMAIL') && usuario.email ? enviarEmail(entrada, usuario.email) : null,
  ]);
}

async function registrar(
  entrada: NotificacaoInput,
  channel: CanalDeNotificacao,
  status: 'SENT' | 'FAILED',
  error?: string,
): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        userId: entrada.userId,
        channel,
        status,
        title: entrada.title,
        body: entrada.body,
        entityType: entrada.entity?.type ?? null,
        entityId: entrada.entity?.id ?? null,
        error: error ?? null,
        sentAt: status === 'SENT' ? new Date() : null,
      },
    });
  } catch (erro) {
    logger.error(
      { err: erro, userId: entrada.userId, channel },
      '[notificacao] falha ao registrar',
    );
  }
}

async function enviarPush(entrada: NotificacaoInput): Promise<void> {
  const inscricoes = await prisma.pushSubscription.findMany({
    where: { userId: entrada.userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (inscricoes.length === 0) return;

  const payload: PushPayload = {
    title: entrada.title,
    body: entrada.body,
    ...(entrada.url ? { url: entrada.url } : {}),
    ...(entrada.tag ? { tag: entrada.tag } : {}),
  };

  const push = getPush();
  const mortas: string[] = [];
  let algumaFoi = false;

  for (const inscricao of inscricoes) {
    const resultado = await push.send(
      {
        endpoint: inscricao.endpoint,
        keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
      },
      payload,
    );

    if (resultado.ok) algumaFoi = true;
    if (resultado.expired) mortas.push(inscricao.id);
  }

  // Inscrição morta fica para sempre se ninguém limpar, e cada envio futuro
  // desperdiça uma requisição por aparelho que não existe mais.
  if (mortas.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: mortas } } });
  }

  await registrar(entrada, 'PUSH', algumaFoi ? 'SENT' : 'FAILED');
}

async function enviarWhatsApp(entrada: NotificacaoInput, phone: string): Promise<void> {
  const whatsapp = getWhatsApp();

  if (!whatsapp.isConfigured()) return;

  const resultado = await whatsapp.sendText({
    to: phone,
    text: `*${entrada.title}*\n\n${entrada.body}`,
  });

  await registrar(entrada, 'WHATSAPP', resultado ? 'SENT' : 'FAILED');
}

async function enviarEmail(entrada: NotificacaoInput, email: string): Promise<void> {
  const resultado = await getEmail().send({
    to: email,
    subject: entrada.title,
    html: `<p>${entrada.body}</p>`,
    text: entrada.body,
  });

  await registrar(entrada, 'EMAIL', resultado ? 'SENT' : 'FAILED');
}
