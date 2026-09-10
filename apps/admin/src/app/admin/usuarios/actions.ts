'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { revokeAllSessions } from '@rapidinho/auth';
import { runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

/**
 * Bloqueia ou desbloqueia uma conta.
 *
 * Bloquear derruba as sessões: o `getCurrentUser` já recusa conta não ativa,
 * mas apagar a sessão evita que o usuário fique navegando em páginas em cache.
 */
export async function alternarBloqueio(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const userId = String(formData.get('userId'));

    if (userId === admin.id) {
      return { result: { ok: false, message: 'Você não pode bloquear a si mesmo.' } };
    }

    const anterior = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, status: true, role: true },
    });

    if (!anterior) {
      return { result: { ok: false, message: 'Usuário não encontrado.' } };
    }

    if (anterior.role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return { result: { ok: false, message: 'Apenas um super admin pode fazer isso.' } };
    }

    const bloqueando = anterior.status === 'ACTIVE';

    const usuario = await prisma.user.update({
      where: { id: userId },
      data: { status: bloqueando ? 'BLOCKED' : 'ACTIVE' },
    });

    if (bloqueando) await revokeAllSessions(userId);

    revalidatePath('/admin/usuarios');

    return {
      result: {
        ok: true,
        message: bloqueando
          ? `${usuario.name ?? 'Usuário'} bloqueado e desconectado.`
          : `${usuario.name ?? 'Usuário'} desbloqueado.`,
      },
      audit: {
        action: bloqueando ? AUDIT_ACTIONS.userBlocked : AUDIT_ACTIONS.userUnblocked,
        entityType: 'User',
        entityId: usuario.id,
        before: { status: anterior.status },
        after: { status: usuario.status },
      },
    };
  });
}

/**
 * Muda o papel do usuário.
 *
 * Promover a ADMIN/SUPER_ADMIN é restrito ao super admin: um admin comum não
 * pode criar outro com o mesmo poder que ele.
 */
export async function alterarPapel(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const userId = String(formData.get('userId'));
    const novoPapel = String(formData.get('role'));

    const papeisValidos = [
      'CUSTOMER',
      'STORE_OWNER',
      'STORE_STAFF',
      'COURIER',
      'ADMIN',
      'SUPER_ADMIN',
    ];
    if (!papeisValidos.includes(novoPapel)) {
      return { result: { ok: false, message: 'Papel inválido.' } };
    }

    if (userId === admin.id) {
      return { result: { ok: false, message: 'Você não pode alterar o seu próprio papel.' } };
    }

    const elevado = novoPapel === 'ADMIN' || novoPapel === 'SUPER_ADMIN';
    if (elevado && admin.role !== 'SUPER_ADMIN') {
      return {
        result: { ok: false, message: 'Apenas um super admin concede acesso administrativo.' },
      };
    }

    const anterior = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });

    if (!anterior) {
      return { result: { ok: false, message: 'Usuário não encontrado.' } };
    }

    if (anterior.role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return { result: { ok: false, message: 'Apenas um super admin pode fazer isso.' } };
    }

    const usuario = await prisma.user.update({
      where: { id: userId },
      data: { role: novoPapel as never },
    });

    // O papel vive na sessão: sem derrubar, a mudança só valeria no próximo
    // login e o usuário seguiria com a permissão antiga.
    await revokeAllSessions(userId);

    revalidatePath('/admin/usuarios');

    return {
      result: {
        ok: true,
        message: `Papel atualizado. ${usuario.name ?? 'O usuário'} precisará entrar de novo.`,
      },
      audit: {
        action: AUDIT_ACTIONS.userRoleChanged,
        entityType: 'User',
        entityId: usuario.id,
        before: { role: anterior.role },
        after: { role: usuario.role },
      },
    };
  });
}
