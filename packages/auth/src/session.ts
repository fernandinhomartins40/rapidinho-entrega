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

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** O Auth.js prefixa o cookie com `__Secure-` quando está em HTTPS. */
export function sessionCookieName(): string {
  const isSecure =
    process.env.NODE_ENV === 'production' &&
    (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? '').startsWith('https');

  return isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
}

export async function createDatabaseSession(userId: string): Promise<string> {
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: { sessionToken, userId, expires },
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: sessionCookieName().startsWith('__Secure-'),
    path: '/',
    expires,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
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

/** Revoga todas as sessões de um usuário (suspensão, exclusão LGPD, logout global). */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}
