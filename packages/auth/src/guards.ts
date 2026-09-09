import { cookies } from 'next/headers';
import { prisma } from '@rapidinho/database';
import { isPlatformAdmin, type UserRole } from '@rapidinho/shared';
import { auth } from './index';

/**
 * Guardas de autorização.
 *
 * Regra central do multi-tenant: NENHUMA query de loja aceita um storeId vindo
 * da URL sem passar por `requireStoreAccess`. A UI esconder um botão não é
 * autorização — o vínculo é conferido aqui, contra a tabela StoreStaff.
 */

export const IMPERSONATION_COOKIE = 'rapidinho.impersonation';

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 = 403,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface CurrentUser {
  id: string;
  role: UserRole;
  name: string | null;
  phone: string | null;
  email: string | null;
  /// Preenchido quando um admin está operando como outro usuário.
  impersonatedBy?: { id: string; name: string | null };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, role: true, name: true, phone: true, email: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') return null;

  const impersonated = await resolveImpersonation(user.id, user.role);
  if (impersonated) return impersonated;

  return {
    id: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    email: user.email,
  };
}

/**
 * Se há impersonation ativa, o usuário efetivo passa a ser o impersonado.
 * O vínculo é validado no banco a cada request: um cookie forjado não basta.
 */
async function resolveImpersonation(
  actorId: string,
  actorRole: UserRole,
): Promise<CurrentUser | null> {
  if (!isPlatformAdmin(actorRole)) return null;

  const cookieStore = await cookies();
  const logId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!logId) return null;

  const log = await prisma.impersonationLog.findFirst({
    where: { id: logId, impersonatorId: actorId, endedAt: null },
    select: {
      impersonator: { select: { id: true, name: true } },
      impersonated: {
        select: { id: true, role: true, name: true, phone: true, email: true, status: true },
      },
    },
  });

  if (!log || log.impersonated.status !== 'ACTIVE') return null;

  return {
    id: log.impersonated.id,
    role: log.impersonated.role,
    name: log.impersonated.name,
    phone: log.impersonated.phone,
    email: log.impersonated.email,
    impersonatedBy: { id: log.impersonator.id, name: log.impersonator.name },
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError('É preciso entrar para continuar', 401);
  return user;
}

export async function requireRole(roles: readonly UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthorizationError('Você não tem permissão para esta ação');
  }
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  return requireRole(['ADMIN', 'SUPER_ADMIN']);
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  return requireRole(['SUPER_ADMIN']);
}

export interface StoreAccess {
  user: CurrentUser;
  storeId: string;
  storeName: string;
  staffRole: 'OWNER' | 'MANAGER' | 'OPERATOR' | null;
  /// Admin da plataforma acessando sem vínculo de funcionário.
  isPlatformAdmin: boolean;
}

/**
 * Resolve e AUTORIZA a loja do request.
 *
 * - sem `storeId`: devolve a loja do vínculo do usuário (o caso normal do
 *   lojista, que tem uma loja só);
 * - com `storeId`: confere o vínculo antes de devolver;
 * - admin da plataforma passa por qualquer loja, mas isso fica registrado no
 *   log de auditoria de quem chamou.
 */
export async function requireStoreAccess(storeId?: string): Promise<StoreAccess> {
  const user = await requireUser();

  if (isPlatformAdmin(user.role)) {
    const store = storeId
      ? await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } })
      : null;

    if (storeId && !store) {
      throw new AuthorizationError('Loja não encontrada', 403);
    }
    if (store) {
      return {
        user,
        storeId: store.id,
        storeName: store.name,
        staffRole: null,
        isPlatformAdmin: true,
      };
    }
  }

  const staff = await prisma.storeStaff.findFirst({
    where: {
      userId: user.id,
      isActive: true,
      ...(storeId ? { storeId } : {}),
      store: { deletedAt: null },
    },
    select: {
      role: true,
      store: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!staff) {
    throw new AuthorizationError('Você não tem acesso a esta loja');
  }

  if (staff.store.status === 'SUSPENDED') {
    throw new AuthorizationError('Esta loja está suspensa. Fale com o suporte.');
  }

  return {
    user,
    storeId: staff.store.id,
    storeName: staff.store.name,
    staffRole: staff.role,
    isPlatformAdmin: false,
  };
}

/** Ações que só o dono da loja pode fazer (financeiro, plano, equipe). */
export async function requireStoreOwner(storeId?: string): Promise<StoreAccess> {
  const access = await requireStoreAccess(storeId);

  if (!access.isPlatformAdmin && access.staffRole !== 'OWNER') {
    throw new AuthorizationError('Apenas o dono da loja pode fazer isso');
  }

  return access;
}

export async function requireCourier(): Promise<{ user: CurrentUser; courierId: string }> {
  const user = await requireUser();

  const courier = await prisma.courier.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true },
  });

  if (!courier) throw new AuthorizationError('Cadastro de entregador não encontrado');
  if (courier.status !== 'ACTIVE') {
    throw new AuthorizationError('Seu cadastro de entregador ainda não foi aprovado');
  }

  return { user, courierId: courier.id };
}

/** Lojas às quais o usuário tem acesso — usado no seletor de loja. */
export async function listAccessibleStores(userId: string) {
  return prisma.storeStaff.findMany({
    where: { userId, isActive: true, store: { deletedAt: null } },
    select: {
      role: true,
      store: { select: { id: true, name: true, slug: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}
