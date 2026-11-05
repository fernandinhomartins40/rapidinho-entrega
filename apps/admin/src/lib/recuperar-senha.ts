import { createHash, randomBytes } from 'node:crypto';
import { PAPEIS_COM_SENHA, revokeAllSessions } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import {
  emailDeRecuperacaoDeSenha,
  emailDeSenhaAlterada,
  getEmail,
  logger,
} from '@rapidinho/services';
import { gerarHashDeSenha } from '@rapidinho/shared/senha';

/**
 * "Esqueci minha senha" do painel, por link no e-mail.
 *
 * O token vai só no e-mail; o banco guarda o SHA-256 dele, em
 * `VerificationToken`, com o id do usuário no `identifier`. Vale 30 minutos e
 * uma vez: pedir de novo apaga o anterior, e usar apaga o usado.
 */

const VALIDADE_MS = 30 * 60_000;
const PREFIXO = 'senha:';
export const MINIMO_DA_SENHA = 8;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

async function usuarioQuePodeRecuperar(email: string) {
  const usuario = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true, deletedAt: true },
  });
  return usuario &&
    usuario.status === 'ACTIVE' &&
    usuario.deletedAt == null &&
    PAPEIS_COM_SENHA.has(usuario.role)
    ? usuario
    : null;
}

/**
 * Manda o link, se o e-mail for de quem entra no painel com senha. Quem chama
 * responde igual nos dois casos: a tela não pode revelar quais e-mails existem.
 */
export async function enviarLinkDeRecuperacao(email: string, painel: string): Promise<void> {
  const usuario = await usuarioQuePodeRecuperar(email);
  if (!usuario?.email) return;

  const token = randomBytes(32).toString('hex');
  const identifier = `${PREFIXO}${usuario.id}`;

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: hash(token), expires: new Date(Date.now() + VALIDADE_MS) },
    }),
  ]);

  // No fragmento (#), o token não chega ao servidor nem aos logs de acesso.
  const link = `${painel.replace(/\/$/, '')}/entrar/nova-senha#${token}`;

  const enviado = await getEmail().send({
    to: usuario.email,
    ...emailDeRecuperacaoDeSenha({ nome: usuario.name, link }),
  });

  // Sem o endereço nem o token no log: só o fato.
  if (!enviado) logger.error({ userId: usuario.id }, '[senha] e-mail de recuperação não saiu');
}

/** Troca a senha com o token do link. Devolve a mensagem de erro, ou null quando deu certo. */
export async function redefinirSenhaComToken(token: string, nova: string): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return 'Link inválido. Peça um novo.';
  if (nova.length < MINIMO_DA_SENHA) return `Use pelo menos ${MINIMO_DA_SENHA} caracteres.`;

  const registro = await prisma.verificationToken.findUnique({ where: { token: hash(token) } });
  if (!registro?.identifier.startsWith(PREFIXO)) return 'Link inválido. Peça um novo.';

  // Consome antes de trocar: dois cliques no mesmo link não trocam duas vezes.
  const consumido = await prisma.verificationToken.deleteMany({
    where: { token: registro.token, expires: { gt: new Date() } },
  });
  if (consumido.count !== 1) return 'Este link expirou. Peça um novo.';

  const userId = registro.identifier.slice(PREFIXO.length);
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, deletedAt: true },
  });
  if (
    !usuario ||
    usuario.status !== 'ACTIVE' ||
    usuario.deletedAt ||
    !PAPEIS_COM_SENHA.has(usuario.role)
  ) {
    return 'Esta conta não pode entrar no painel.';
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: gerarHashDeSenha(nova) },
  });
  // Senha esquecida pode ser senha vazada: todas as sessões abertas caem.
  await revokeAllSessions(userId);
  await avisarSenhaAlterada(userId);
  return null;
}

/**
 * Aviso de segurança para o dono da conta. Falhar aqui não desfaz a troca:
 * a senha já mudou, e o e-mail é só o alerta.
 */
export async function avisarSenhaAlterada(userId: string): Promise<void> {
  try {
    const usuario = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!usuario?.email) return;
    const painel = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://painel.rapidinhoentrega.com.br';
    const enviado = await getEmail().send({
      to: usuario.email,
      ...emailDeSenhaAlterada({ nome: usuario.name, painel }),
    });
    if (!enviado) logger.error({ userId }, '[senha] aviso de senha alterada não saiu');
  } catch (erro) {
    logger.error({ err: erro, userId }, '[senha] falha no aviso de senha alterada');
  }
}
