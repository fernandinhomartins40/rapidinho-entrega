import { prisma } from './client';

/**
 * Trilha de auditoria das ações administrativas.
 *
 * Toda ação do super admin que muda dados de terceiros (aprovar loja,
 * suspender usuário, editar plano, entrar como lojista) passa por aqui. O
 * registro guarda o antes e o depois para reconstruir o que mudou.
 */

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: (entry.before ?? undefined) as never,
      after: (entry.after ?? undefined) as never,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

/** Ações registradas — string livre gera log inconsultável. */
export const AUDIT_ACTIONS = {
  storeApproved: 'store.approved',
  storeRejected: 'store.rejected',
  storeSuspended: 'store.suspended',
  storeReactivated: 'store.reactivated',
  storeUpdated: 'store.updated',
  userBlocked: 'user.blocked',
  userUnblocked: 'user.unblocked',
  userRoleChanged: 'user.role_changed',
  courierApproved: 'courier.approved',
  courierRejected: 'courier.rejected',
  planCreated: 'plan.created',
  planUpdated: 'plan.updated',
  planDeleted: 'plan.deleted',
  cityCreated: 'city.created',
  cityUpdated: 'city.updated',
  couponCreated: 'coupon.created',
  couponUpdated: 'coupon.updated',
  boostCreated: 'boost.created',
  impersonationStarted: 'impersonation.started',
  impersonationEnded: 'impersonation.ended',
  payoutCreated: 'payout.created',
  payoutPaid: 'payout.paid',
  dataExported: 'lgpd.data_exported',
  dataDeleted: 'lgpd.data_deleted',
} as const;
