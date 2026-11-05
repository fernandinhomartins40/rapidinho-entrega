import { createHash, randomBytes } from 'node:crypto';
import { PAPEIS_COM_SENHA, revokeAllSessions } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import { getEmail, logger } from '@rapidinho/services';
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
  const nome = usuario.name?.trim().split(' ')[0] ?? '';

  const enviado = await getEmail().send({
    to: usuario.email,
    subject: 'Redefinir sua senha do painel Rapidinho',
    text: [
      `Olá${nome ? `, ${nome}` : ''}!`,
      '',
      'Recebemos um pedido para redefinir a senha do seu acesso ao painel do Rapidinho Entrega.',
      'Para criar uma senha nova, abra o link abaixo. Ele vale por 30 minutos e só funciona uma vez.',
      '',
      link,
      '',
      'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    ].join('\n'),
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1C1A2E">
  <h1 style="color:#FF5A1F;font-size:22px">Redefinir sua senha</h1>
  <p>Olá${nome ? `, ${escapar(nome)}` : ''}!</p>
  <p>Recebemos um pedido para redefinir a senha do seu acesso ao painel do Rapidinho Entrega.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#FF5A1F;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Criar senha nova</a></p>
  <p style="font-size:14px;color:#555">O link vale por 30 minutos e só funciona uma vez. Se o botão não abrir, copie este endereço:<br><span style="word-break:break-all">${link}</span></p>
  <p style="font-size:14px;color:#555">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
</div>`,
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
  return null;
}

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
