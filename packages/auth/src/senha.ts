import { randomBytes } from 'node:crypto';
import { prisma } from '@rapidinho/database';
import { gerarHashDeSenha, senhaConfere } from '@rapidinho/shared/senha';

/**
 * Login com e-mail e senha, só para a equipe da plataforma (ADMIN e
 * SUPER_ADMIN). Lojista, motoboy e cliente entram por telefone e código.
 *
 * Devolve o id do usuário quando confere, ou null — sem dizer o que falhou,
 * para não revelar quais e-mails existem.
 */
export async function autenticarPorSenha(email: string, senha: string): Promise<string | null> {
  const usuario = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, role: true, status: true, deletedAt: true },
  });

  const autorizado =
    usuario != null &&
    usuario.status === 'ACTIVE' &&
    usuario.deletedAt == null &&
    (usuario.role === 'SUPER_ADMIN' || usuario.role === 'ADMIN');

  // Confere a senha mesmo sem usuário: o tempo de resposta não revela se o
  // e-mail existe.
  const senhaCerta = senhaConfere(senha, usuario?.passwordHash ?? hashDeEnchimento());
  return autorizado && senhaCerta ? usuario.id : null;
}

let enchimento: string | undefined;
function hashDeEnchimento(): string {
  enchimento ??= gerarHashDeSenha(randomBytes(16).toString('hex'));
  return enchimento;
}
