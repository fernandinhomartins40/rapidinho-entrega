import { prisma } from '@rapidinho/database';
import { cadastroDeEntregador, conferirEntregador } from './entregador';
import { AuthorizationError, type CurrentUser } from './erros';
import { SESSION_MAX_AGE_SECONDS } from './session';

/**
 * Sessão do app nativo por `Authorization: Bearer`.
 *
 * O token é o `sessionToken` da mesma tabela `sessions` do site, sem sistema
 * paralelo: revogar, sair e suspender valem igual. Impersonation não se aplica:
 * ela vive num cookie do painel, que o app não tem.
 */

/** Como o Auth.js: o prazo só é regravado uma vez por dia, não a cada request. */
const RENOVAR_A_CADA_SEGUNDOS = 60 * 60 * 24;

export interface SessaoDoToken {
  sessionId: string;
  sessionToken: string;
  user: CurrentUser;
}

export function lerBearer(headers: Headers): string | null {
  const [esquema, token, ...resto] = (headers.get('authorization') ?? '').trim().split(/\s+/);
  if (esquema?.toLowerCase() !== 'bearer' || !token || resto.length > 0) return null;
  return token;
}

export async function sessaoDoToken(request: Request): Promise<SessaoDoToken | null> {
  const sessionToken = lerBearer(request.headers);
  if (!sessionToken) return null;

  const sessao = await prisma.session.findUnique({
    where: { sessionToken },
    select: {
      id: true,
      expires: true,
      user: {
        select: { id: true, role: true, name: true, phone: true, email: true, status: true },
      },
    },
  });

  if (!sessao) return null;

  const agora = Date.now();

  if (sessao.expires.getTime() <= agora) {
    await prisma.session.deleteMany({ where: { id: sessao.id } });
    return null;
  }

  // Bloqueio e exclusão valem na hora, mesmo com sessão dentro do prazo.
  const { status, ...user } = sessao.user;
  if (status !== 'ACTIVE') return null;

  const validaAte = agora + SESSION_MAX_AGE_SECONDS * 1000;
  if (validaAte - sessao.expires.getTime() >= RENOVAR_A_CADA_SEGUNDOS * 1000) {
    // `updateMany`: sair em paralelo não pode virar erro aqui.
    await prisma.session.updateMany({
      where: { id: sessao.id },
      data: { expires: new Date(validaAte) },
    });
  }

  return { sessionId: sessao.id, sessionToken, user };
}

export async function usuarioDoToken(request: Request): Promise<CurrentUser | null> {
  return (await sessaoDoToken(request))?.user ?? null;
}

export async function exigirSessaoDoToken(request: Request): Promise<SessaoDoToken> {
  const sessao = await sessaoDoToken(request);
  if (!sessao) throw new AuthorizationError('É preciso entrar para continuar', 401);
  return sessao;
}

export async function exigirUsuarioDoToken(request: Request): Promise<CurrentUser> {
  return (await exigirSessaoDoToken(request)).user;
}

export async function exigirEntregadorDoToken(
  request: Request,
): Promise<{ user: CurrentUser; courierId: string }> {
  const user = await exigirUsuarioDoToken(request);
  return { user, courierId: await conferirEntregador(user.id) };
}

/** Para o que o entregador faz antes da aprovação, como enviar a CNH. */
export async function exigirCadastroDeEntregadorDoToken(
  request: Request,
): Promise<{ user: CurrentUser; courierId: string }> {
  const user = await exigirUsuarioDoToken(request);
  return { user, courierId: await cadastroDeEntregador(user.id) };
}

/** Sair apaga a sessão, e com ela o aparelho registrado (cascata no banco). */
export async function encerrarSessaoDoToken(request: Request): Promise<void> {
  const sessionToken = lerBearer(request.headers);
  if (sessionToken) await prisma.session.deleteMany({ where: { sessionToken } });
}
