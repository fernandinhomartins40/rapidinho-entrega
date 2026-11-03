import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@rapidinho/database';

/**
 * Criação e destruição de sessão fora do fluxo de Provider do Auth.js.
 *
 * Necessário porque o login principal é por telefone + OTP, e o Auth.js só
 * aceita Credentials com sessão em JWT. Como a sessão precisa ficar no banco
 * (para revogação imediata), escrevemos na mesma tabela `sessions` e usamos o
 * mesmo cookie que o Auth.js lê — sem fork nem gambiarra de token paralelo.
 */

/**
 * 30 dias no painel. O site do cliente define RAPIDINHO_SESSAO_DIAS=400 no
 * next.config: lá o login é por SMS pago, e o cliente deve ficar conectado
 * como no WhatsApp. 400 dias é o teto que o Chrome aceita para um cookie; o
 * prazo recomeça a cada uso (renovação do Auth.js no banco, middleware do
 * site no cookie).
 */
export const SESSION_MAX_AGE_SECONDS =
  60 * 60 * 24 * Number(process.env.RAPIDINHO_SESSAO_DIAS ?? 30);

/** O Auth.js prefixa o cookie com `__Secure-` quando está em HTTPS. */
export function sessionCookieName(): string {
  const isSecure =
    process.env.NODE_ENV === 'production' &&
    (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? '').startsWith('https');

  return isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
}

/**
 * Cria a sessão sem cookie: é o que o app nativo recebe como token. Mesma tabela
 * e mesma revogação do site, sem um segundo sistema de sessão.
 */
export async function criarSessaoSemCookie(
  userId: string,
): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: { sessionToken, userId, expires },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return { sessionToken, expires };
}

export async function createDatabaseSession(userId: string): Promise<string> {
  const { sessionToken, expires } = await criarSessaoSemCookie(userId);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: sessionCookieName().startsWith('__Secure-'),
    path: '/',
    expires,
  });

  return sessionToken;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const name = sessionCookieName();
  const token = cookieStore.get(name)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: token } });
  }

  cookieStore.delete(name);
}

/**
 * Encerra as sessões do usuário em outros aparelhos e mantém a deste. É o que
 * se espera ao trocar a senha por desconfiar de vazamento.
 */
export async function revokeOtherSessions(userId: string): Promise<number> {
  const atual = (await cookies()).get(sessionCookieName())?.value;
  const result = await prisma.session.deleteMany({
    where: { userId, ...(atual ? { sessionToken: { not: atual } } : {}) },
  });
  return result.count;
}

/** Revoga todas as sessões de um usuário (suspensão, exclusão LGPD, logout global). */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}
