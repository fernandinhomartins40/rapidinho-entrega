'use server';

import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { consumeRateLimit, resetRateLimit } from '@rapidinho/services';
import { RATE_LIMITS } from '@rapidinho/shared';
import { gerarHashDeSenha, senhaConfere } from '@rapidinho/shared/senha';
import { runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

/** Curta demais é adivinhável; a provisória do seed tem 9. */
const MINIMO = 8;

function erroNoCampo(campo: string, mensagem: string) {
  return {
    result: {
      ok: false,
      message: 'Confira os campos destacados.',
      fieldErrors: { [campo]: mensagem },
    },
  };
}

/**
 * Troca a senha de quem está logado. Com senha atual, ela é conferida — uma
 * sessão esquecida aberta não basta para tomar a conta. Admin que entrou por
 * telefone e ainda não tem senha pode criar uma.
 */
export async function trocarSenha(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const atual = String(formData.get('atual') ?? '');
    const nova = String(formData.get('nova') ?? '');
    const confirmacao = String(formData.get('confirmacao') ?? '');

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
      select: { passwordHash: true },
    });

    if (usuario.passwordHash) {
      const chave = `senha:troca:${admin.id}`;
      const limite = await consumeRateLimit(
        chave,
        RATE_LIMITS.senhaLogin.points,
        RATE_LIMITS.senhaLogin.durationSeconds,
      );
      if (!limite.allowed) {
        return { result: { ok: false, message: 'Muitas tentativas. Espere alguns minutos.' } };
      }
      if (!senhaConfere(atual, usuario.passwordHash)) {
        return erroNoCampo('atual', 'Senha atual incorreta.');
      }
      await resetRateLimit(chave);
    }

    if (nova.length < MINIMO) {
      return erroNoCampo('nova', `Use pelo menos ${MINIMO} caracteres.`);
    }
    if (usuario.passwordHash && nova === atual) {
      return erroNoCampo('nova', 'A nova senha precisa ser diferente da atual.');
    }
    if (nova !== confirmacao) {
      return erroNoCampo('confirmacao', 'As duas senhas não são iguais.');
    }

    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: gerarHashDeSenha(nova) },
    });

    return {
      result: { ok: true, message: usuario.passwordHash ? 'Senha trocada.' : 'Senha criada.' },
      // Nunca a senha nem o hash: só o fato.
      audit: {
        action: AUDIT_ACTIONS.userPasswordChanged,
        entityType: 'User',
        entityId: admin.id,
      },
    };
  });
}
