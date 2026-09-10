'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

/**
 * Aprova ou recusa o cadastro do entregador.
 *
 * Aprovar libera a pessoa para aceitar corridas, então o documento precisa ter
 * sido conferido antes — a recusa guarda o motivo para o suporte responder.
 */
export async function decidirEntregador(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const courierId = String(formData.get('courierId'));
    const aprovado = formData.get('approved') === 'true';
    const motivo = String(formData.get('reason') ?? '').trim();

    if (!aprovado && motivo.length < 3) {
      return {
        result: {
          ok: false,
          message: 'Informe o motivo da recusa.',
          fieldErrors: { reason: 'Obrigatório' },
        },
      };
    }

    const anterior = await prisma.courier.findUnique({
      where: { id: courierId },
      select: { id: true, status: true, user: { select: { name: true } } },
    });

    if (!anterior) {
      return { result: { ok: false, message: 'Entregador não encontrado.' } };
    }

    const entregador = await prisma.courier.update({
      where: { id: courierId },
      data: aprovado
        ? { status: 'ACTIVE', approvedAt: new Date(), approvedById: admin.id }
        : { status: 'REJECTED' },
    });

    // Os documentos ficam marcados junto: quem revisar depois vê o que valeu.
    await prisma.courierDocument.updateMany({
      where: { courierId, isApproved: null },
      data: {
        isApproved: aprovado,
        reviewedAt: new Date(),
        reviewedById: admin.id,
        rejectReason: aprovado ? null : motivo,
      },
    });

    revalidatePath('/admin/entregadores');
    revalidatePath('/admin');

    const nome = anterior.user.name ?? 'Entregador';

    return {
      result: {
        ok: true,
        message: aprovado
          ? `${nome} liberado para aceitar corridas.`
          : `Cadastro de ${nome} recusado.`,
      },
      audit: {
        action: aprovado ? AUDIT_ACTIONS.courierApproved : AUDIT_ACTIONS.courierRejected,
        entityType: 'Courier',
        entityId: entregador.id,
        before: { status: anterior.status },
        after: { status: entregador.status, reason: motivo || undefined },
      },
    };
  });
}

/** Suspende ou reativa um entregador já aprovado. */
export async function alternarSuspensaoEntregador(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const courierId = String(formData.get('courierId'));

    const anterior = await prisma.courier.findUnique({
      where: { id: courierId },
      select: { id: true, status: true, user: { select: { name: true } } },
    });

    if (!anterior) {
      return { result: { ok: false, message: 'Entregador não encontrado.' } };
    }

    const suspendendo = anterior.status !== 'SUSPENDED';

    const entregador = await prisma.courier.update({
      where: { id: courierId },
      data: {
        status: suspendendo ? 'SUSPENDED' : 'ACTIVE',
        // Suspender tira da fila de corridas na hora.
        ...(suspendendo ? { isOnline: false } : {}),
      },
    });

    revalidatePath('/admin/entregadores');

    const nome = anterior.user.name ?? 'Entregador';

    return {
      result: { ok: true, message: suspendendo ? `${nome} suspenso.` : `${nome} reativado.` },
      audit: {
        action: suspendendo ? AUDIT_ACTIONS.courierRejected : AUDIT_ACTIONS.courierApproved,
        entityType: 'Courier',
        entityId: entregador.id,
        before: { status: anterior.status },
        after: { status: entregador.status },
      },
    };
  });
}
