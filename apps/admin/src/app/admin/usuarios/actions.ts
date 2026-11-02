'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { PAPEIS_COM_SENHA, revokeAllSessions } from '@rapidinho/auth';
import { gerarHashDeSenha } from '@rapidinho/shared/senha';
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

/** Sem 0/o, 1/l/i: a senha é ditada por telefone ou WhatsApp. */
const ALFABETO_DA_PROVISORIA = 'abcdefghjkmnpqrstuvwxyz23456789';

function senhaProvisoria(): string {
  return Array.from(
    { length: 10 },
    () => ALFABETO_DA_PROVISORIA[randomInt(ALFABETO_DA_PROVISORIA.length)],
  ).join('');
}

/**
 * Gera uma senha provisória para lojista, funcionário ou admin entrar no
 * painel — e é também o "esqueci minha senha": quem esqueceu pede à
 * plataforma. Só o super admin, porque quem gera a senha consegue entrar na
 * conta. A senha aparece uma vez, nesta resposta; o banco guarda só o hash.
 */
export async function gerarSenhaProvisoria(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    if (admin.role !== 'SUPER_ADMIN') {
      return { result: { ok: false, message: 'Apenas um super admin pode fazer isso.' } };
    }

    const userId = String(formData.get('userId'));
    const email = z.string().trim().toLowerCase().email().safeParse(formData.get('email'));

    if (!email.success) {
      return {
        result: {
          ok: false,
          message: 'Confira os campos destacados.',
          fieldErrors: { email: 'Informe um e-mail válido.' },
        },
      };
    }

    const usuario = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });

    if (!usuario) {
      return { result: { ok: false, message: 'Usuário não encontrado.' } };
    }

    if (!PAPEIS_COM_SENHA.has(usuario.role)) {
      return {
        result: {
          ok: false,
          message: 'Cliente e entregador entram por SMS no app, sem senha.',
        },
      };
    }

    const emailEmUso = await prisma.user.findFirst({
      where: { email: email.data, id: { not: usuario.id } },
      select: { id: true },
    });

    if (emailEmUso) {
      return {
        result: {
          ok: false,
          message: 'Confira os campos destacados.',
          fieldErrors: { email: 'Este e-mail já é de outra conta.' },
        },
      };
    }

    const senha = senhaProvisoria();

    await prisma.user.update({
      where: { id: usuario.id },
      data: { email: email.data, passwordHash: gerarHashDeSenha(senha) },
    });

    // Quem estava logado com a senha antiga sai: é o caso de senha vazada.
    await revokeAllSessions(usuario.id);

    revalidatePath('/admin/usuarios');

    return {
      result: {
        ok: true,
        message: `Senha provisória de ${usuario.name ?? email.data}: ${senha} — anote e envie agora, ela não aparece de novo. No painel, a pessoa troca em "Minha senha".`,
      },
      // Nunca a senha nem o hash: só o fato.
      audit: {
        action: AUDIT_ACTIONS.userPasswordChanged,
        entityType: 'User',
        entityId: usuario.id,
      },
    };
  });
}
