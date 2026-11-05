import { revokeOtherSessions } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import { consumeRateLimit, resetRateLimit } from '@rapidinho/services';
import { RATE_LIMITS } from '@rapidinho/shared';
import { gerarHashDeSenha, senhaConfere } from '@rapidinho/shared/senha';
import type { ActionResult } from './action-state';
import { avisarSenhaAlterada } from './recuperar-senha';

/** Curta demais é adivinhável; a provisória do seed tem 9. */
const MINIMO = 8;

function erroNoCampo(campo: string, mensagem: string): ActionResult {
  return {
    ok: false,
    message: 'Confira os campos destacados.',
    fieldErrors: { [campo]: mensagem },
  };
}

/**
 * Troca a senha do próprio usuário: equipe da plataforma (/admin/senha) e
 * lojista ou funcionário (/loja/senha). Com senha atual, ela é conferida — uma
 * sessão esquecida aberta não basta para tomar a conta. Quem ainda não tem
 * senha pode criar uma.
 */
export async function trocarSenhaDoUsuario(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const atual = String(formData.get('atual') ?? '');
  const nova = String(formData.get('nova') ?? '');
  const confirmacao = String(formData.get('confirmacao') ?? '');

  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (usuario.passwordHash) {
    const chave = `senha:troca:${userId}`;
    const limite = await consumeRateLimit(
      chave,
      RATE_LIMITS.senhaLogin.points,
      RATE_LIMITS.senhaLogin.durationSeconds,
    );
    if (!limite.allowed) {
      return { ok: false, message: 'Muitas tentativas. Espere alguns minutos.' };
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
    where: { id: userId },
    data: { passwordHash: gerarHashDeSenha(nova) },
  });
  // Quem troca a senha por desconfiar de vazamento não pode continuar com o
  // invasor logado em outro aparelho.
  await revokeOtherSessions(userId);
  await avisarSenhaAlterada(userId);

  return { ok: true, message: usuario.passwordHash ? 'Senha trocada.' : 'Senha criada.' };
}
