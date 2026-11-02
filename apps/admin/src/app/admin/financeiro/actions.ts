'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
import { cuidSchema } from '@rapidinho/shared';
import type { ActionResult } from '@/lib/action-state';
import { runAdminAction } from '@/lib/admin-action';

/**
 * Baixa manual da fatura: o lojista paga por fora e a plataforma confirma.
 *
 * Se a loja saiu do ar por inadimplência e não sobrou outra fatura vencida, ela
 * volta sozinha. Suspensão manual não volta por aqui: foi decisão de alguém, por
 * outro motivo, e `suspendedForNonPaymentAt` vazio é o que marca esse caso.
 */
export async function marcarFaturaComoPaga(faturaId: unknown): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = cuidSchema.parse(faturaId);

    const fatura = await prisma.planInvoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        storeId: true,
        store: { select: { name: true, suspendedForNonPaymentAt: true } },
      },
    });

    if (!fatura) return { result: { ok: false, message: 'Fatura não encontrada.' } };

    const reativada = await prisma.$transaction(async (tx) => {
      // Condicional: dois cliques não dão baixa duas vezes.
      const { count } = await tx.planInvoice.updateMany({
        where: { id: fatura.id, status: { in: ['OPEN', 'OVERDUE'] } },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (count === 0) return null;

      const outrasVencidas = await tx.planInvoice.count({
        where: { storeId: fatura.storeId, status: 'OVERDUE' },
      });

      if (fatura.store.suspendedForNonPaymentAt == null || outrasVencidas > 0) return false;

      await tx.store.update({
        where: { id: fatura.storeId },
        data: { status: 'ACTIVE', suspendedForNonPaymentAt: null },
      });
      return true;
    });

    if (reativada === null) {
      return { result: { ok: false, message: 'Esta fatura já foi baixada.' } };
    }

    revalidatePath('/admin/financeiro');
    revalidatePath(`/admin/lojas/${fatura.storeId}`);

    return {
      result: {
        ok: true,
        message: reativada ? `Baixa feita. ${fatura.store.name} voltou ao ar.` : 'Baixa feita.',
      },
      audit: {
        action: 'invoice.paid',
        entityType: 'PlanInvoice',
        entityId: fatura.id,
        before: { status: fatura.status },
        after: { status: 'PAID', lojaReativada: reativada },
      },
    };
  });
}
