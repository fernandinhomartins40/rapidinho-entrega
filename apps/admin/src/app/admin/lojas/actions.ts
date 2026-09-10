'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { IMPERSONATION_COOKIE, requireSuperAdmin, revokeAllSessions } from '@rapidinho/auth';
import { approveStoreSchema, impersonateSchema } from '@rapidinho/shared';
import { runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

/**
 * Aprovação de cadastro de loja.
 *
 * Aprovar coloca a loja no ar na hora. Recusar guarda o motivo, porque o
 * lojista vai ligar perguntando — e alguém precisa saber responder.
 */
export async function decidirCadastro(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (user) => {
    const dados = approveStoreSchema.parse({
      storeId: formData.get('storeId'),
      approved: formData.get('approved') === 'true',
      reason: formData.get('reason') || undefined,
    });

    const anterior = await prisma.store.findUnique({
      where: { id: dados.storeId },
      select: { id: true, name: true, status: true },
    });

    if (!anterior) {
      return { result: { ok: false, message: 'Loja não encontrada.' } };
    }

    if (!dados.approved && !dados.reason) {
      return {
        result: {
          ok: false,
          message: 'Informe o motivo da recusa.',
          fieldErrors: { reason: 'Obrigatório ao recusar' },
        },
      };
    }

    const loja = await prisma.store.update({
      where: { id: dados.storeId },
      data: dados.approved
        ? { status: 'ACTIVE', approvedAt: new Date(), approvedById: user.id }
        : { status: 'REJECTED' },
    });

    revalidatePath('/admin/lojas');
    revalidatePath('/admin');

    return {
      result: {
        ok: true,
        message: dados.approved ? `${loja.name} está no ar.` : `Cadastro de ${loja.name} recusado.`,
      },
      audit: {
        action: dados.approved ? AUDIT_ACTIONS.storeApproved : AUDIT_ACTIONS.storeRejected,
        entityType: 'Store',
        entityId: loja.id,
        before: { status: anterior.status },
        after: { status: loja.status, reason: dados.reason },
      },
    };
  });
}

/**
 * Suspende ou reativa uma loja já aprovada.
 *
 * Suspender derruba as sessões da equipe da loja: se a suspensão é por
 * problema sério, deixar o lojista logado seria inútil.
 */
export async function alternarSuspensao(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const storeId = String(formData.get('storeId'));
    const motivo = String(formData.get('reason') ?? '').trim();

    const anterior = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        status: true,
        staff: { select: { userId: true } },
      },
    });

    if (!anterior) {
      return { result: { ok: false, message: 'Loja não encontrada.' } };
    }

    const suspendendo = anterior.status !== 'SUSPENDED';

    if (suspendendo && motivo.length < 3) {
      return {
        result: {
          ok: false,
          message: 'Descreva o motivo da suspensão.',
          fieldErrors: { reason: 'Obrigatório' },
        },
      };
    }

    const loja = await prisma.store.update({
      where: { id: storeId },
      data: { status: suspendendo ? 'SUSPENDED' : 'ACTIVE' },
    });

    if (suspendendo) {
      await Promise.all(anterior.staff.map((membro) => revokeAllSessions(membro.userId)));
    }

    revalidatePath('/admin/lojas');
    revalidatePath(`/admin/lojas/${storeId}`);

    return {
      result: {
        ok: true,
        message: suspendendo ? `${loja.name} suspensa.` : `${loja.name} reativada.`,
      },
      audit: {
        action: suspendendo ? AUDIT_ACTIONS.storeSuspended : AUDIT_ACTIONS.storeReactivated,
        entityType: 'Store',
        entityId: loja.id,
        before: { status: anterior.status },
        after: { status: loja.status, reason: motivo || undefined },
      },
    };
  });
}

/**
 * Entra no painel como o lojista.
 *
 * Restrito ao super admin e sempre registrado: a sessão de impersonation é
 * validada no banco a cada request, então encerrar o registro corta o acesso
 * na hora. O motivo é obrigatório — sem ele, o log não serve para nada.
 */
export async function entrarComoLojista(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const superAdmin = await requireSuperAdmin();

  const parsed = impersonateSchema.safeParse({
    userId: formData.get('userId'),
    storeId: formData.get('storeId') || undefined,
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Descreva o motivo do acesso (mínimo 3 caracteres).',
      fieldErrors: { reason: 'Obrigatório' },
    };
  }

  const alvo = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, status: true, role: true },
  });

  if (!alvo || alvo.status !== 'ACTIVE') {
    return { ok: false, message: 'Usuário indisponível.' };
  }

  if (alvo.role === 'SUPER_ADMIN') {
    return { ok: false, message: 'Não é possível acessar como outro super admin.' };
  }

  const registro = await prisma.impersonationLog.create({
    data: {
      impersonatorId: superAdmin.id,
      impersonatedId: alvo.id,
      storeId: parsed.data.storeId ?? null,
      reason: parsed.data.reason,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, registro.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Acesso a conta de terceiro é temporário por natureza.
    maxAge: 60 * 60,
  });

  redirect('/loja');
}

/** Encerra a impersonation e volta para o painel da plataforma. */
export async function sairDoModoLojista(): Promise<void> {
  const cookieStore = await cookies();
  const registroId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  if (registroId) {
    await prisma.impersonationLog.updateMany({
      where: { id: registroId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect('/admin/lojas');
}
