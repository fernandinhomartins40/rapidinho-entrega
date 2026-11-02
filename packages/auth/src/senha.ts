import { randomBytes } from 'node:crypto';
import { prisma } from '@rapidinho/database';
import type { UserRole } from '@rapidinho/shared';
import { gerarHashDeSenha, senhaConfere } from '@rapidinho/shared/senha';

/** Quem entra no painel por e-mail e senha. Cliente e entregador: SMS no app. */
export const PAPEIS_COM_SENHA: ReadonlySet<UserRole> = new Set<UserRole>([
  'SUPER_ADMIN',
  'ADMIN',
  'STORE_OWNER',
  'STORE_STAFF',
]);

/**
 * Login com e-mail e senha: lojista, funcionário da loja e equipe da
 * plataforma. Cliente e entregador entram por telefone e código no app.
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
    PAPEIS_COM_SENHA.has(usuario.role);

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
