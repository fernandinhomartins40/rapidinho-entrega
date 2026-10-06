import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@rapidinho/database';
import { codigosNoSms, remetenteDoSms, type OtpSender } from '@rapidinho/shared';

/**
 * Login por telefone com código de 6 dígitos.
 *
 * Regras de segurança:
 *  - o código nunca é guardado em claro, só o hash;
 *  - a comparação é em tempo constante;
 *  - tentativas são contadas por código e o excesso invalida o código;
 *  - códigos anteriores do mesmo telefone são invalidados a cada novo pedido,
 *    para não deixar vários códigos válidos circulando.
 */

const CODE_LENGTH = 6;

function hashCode(phone: string, code: string): string {
  // O telefone entra no hash para o código não valer em outro número.
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

export interface RequestOtpOptions {
  phone: string;
  sender: OtpSender;
  ttlSeconds: number;
  requestIp?: string;
  /// Em desenvolvimento o código volta na resposta para facilitar o teste.
  exposeCode?: boolean;
}

export interface RequestOtpResult {
  expiresAt: Date;
  code?: string;
}

export async function requestOtp(options: RequestOtpOptions): Promise<RequestOtpResult> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + options.ttlSeconds * 1000);

  await prisma.$transaction([
    // Invalida códigos anteriores ainda vivos deste telefone.
    prisma.otpCode.updateMany({
      where: { phone: options.phone, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    }),
    prisma.otpCode.create({
      data: {
        phone: options.phone,
        codeHash: hashCode(options.phone, code),
        expiresAt,
        requestIp: options.requestIp ?? null,
      },
    }),
  ]);

  await options.sender.send({
    phone: options.phone,
    code,
    expiresInMinutes: Math.round(options.ttlSeconds / 60),
  });

  return options.exposeCode ? { expiresAt, code } : { expiresAt };
}

export type VerifyOtpResult =
  { ok: true; userId: string; isNewUser: boolean } | { ok: false; reason: string };

export interface VerifyOtpOptions {
  phone: string;
  code: string;
  maxAttempts: number;
}

export async function verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
  const record = await prisma.otpCode.findFirst({
    where: {
      phone: options.phone,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      // Código de confirmação reversa aparece na tela de quem pediu: se
      // valesse digitado, qualquer um entraria na conta de qualquer número.
      browserTokenHash: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    return { ok: false, reason: 'Código expirado. Peça um novo.' };
  }

  if (record.attempts >= options.maxAttempts) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: 'Muitas tentativas. Peça um novo código.' };
  }

  if (!safeCompare(record.codeHash, hashCode(options.phone, options.code))) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: 'Código incorreto.' };
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return entrarComTelefoneConfirmado(options.phone);
}

/** Telefone confirmado: devolve o usuário, criando o cliente no primeiro acesso. */
async function entrarComTelefoneConfirmado(phone: string): Promise<VerifyOtpResult> {
  const existing = await prisma.user.findUnique({ where: { phone } });

  if (existing) {
    if (existing.status === 'BLOCKED') {
      return { ok: false, reason: 'Esta conta está bloqueada.' };
    }
    if (!existing.phoneVerified) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { phoneVerified: new Date() },
      });
    }
    return { ok: true, userId: existing.id, isNewUser: false };
  }

  const created = await prisma.user.create({
    data: { phone, phoneVerified: new Date(), role: 'CUSTOMER' },
  });

  return { ok: true, userId: created.id, isNewUser: true };
}

// ---------------------------------------------------------------------------
// Confirmação reversa: o cliente envia o SMS
// ---------------------------------------------------------------------------
//
// A plataforma não envia nada (e não paga por envio). O cliente manda, do
// aparelho dele, um SMS com o código para o número da operação; o gateway (app
// Android) repassa remetente e texto ao servidor.
//
// O que cada peça prova:
//  - o REMETENTE do SMS prova a posse do número — é a operadora que o informa;
//  - o código liga o SMS ao pedido de login certo (não é segredo: está na tela);
//  - o segredo do navegador garante que só quem PEDIU o login entra por ele,
//    e não outra pessoa que conheça o telefone e chute o código.

export interface RequestReverseOtpOptions {
  phone: string;
  ttlSeconds: number;
  requestIp?: string;
}

export interface RequestReverseOtpResult {
  /** Vai no texto do SMS e aparece na tela. */
  code: string;
  /** Fica só com o navegador que pediu o login. */
  browserToken: string;
  expiresAt: Date;
}

export async function requestReverseOtp(
  options: RequestReverseOtpOptions,
): Promise<RequestReverseOtpResult> {
  const code = generateCode();
  const browserToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + options.ttlSeconds * 1000);

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { phone: options.phone, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    }),
    prisma.otpCode.create({
      data: {
        phone: options.phone,
        codeHash: hashCode(options.phone, code),
        browserTokenHash: hashCode(options.phone, browserToken),
        expiresAt,
        requestIp: options.requestIp ?? null,
      },
    }),
  ]);

  return { code, browserToken, expiresAt };
}

export type InboundSmsResult =
  | { matched: true; phone: string }
  | {
      matched: false;
      reason: 'remetente-invalido' | 'sem-codigo' | 'sem-pedido' | 'codigo-errado';
    };

/**
 * SMS recebido pelo gateway. Confirma o pedido de login quando o texto traz o
 * código pedido PARA o número que enviou o SMS.
 *
 * Código errado conta como tentativa, igual ao código digitado: o limite
 * impede que alguém fique mandando SMS até acertar o código de um pedido que
 * outra pessoa abriu para o mesmo número.
 */
export async function confirmInboundSms(options: {
  from: string;
  body: string;
  maxAttempts: number;
}): Promise<InboundSmsResult> {
  const phone = remetenteDoSms(options.from);
  if (!phone) return { matched: false, reason: 'remetente-invalido' };

  const codigos = codigosNoSms(options.body);
  if (codigos.length === 0) return { matched: false, reason: 'sem-codigo' };

  const record = await prisma.otpCode.findFirst({
    where: {
      phone,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      browserTokenHash: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { matched: false, reason: 'sem-pedido' };
  // Reenvio do mesmo SMS: já estava confirmado.
  if (record.confirmedAt) return { matched: true, phone };

  if (record.attempts >= options.maxAttempts) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return { matched: false, reason: 'codigo-errado' };
  }

  const acertou = codigos.some((codigo) => safeCompare(record.codeHash, hashCode(phone, codigo)));

  if (!acertou) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { matched: false, reason: 'codigo-errado' };
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { confirmedAt: new Date() } });
  return { matched: true, phone };
}

export type CompleteReverseOtpResult =
  | { status: 'ok'; userId: string; isNewUser: boolean }
  /** O SMS ainda não chegou: a tela continua esperando. */
  | { status: 'aguardando' }
  | { status: 'erro'; reason: string };

/**
 * Chamado pelo navegador que pediu o login, enquanto espera o SMS chegar.
 * Só entra com o segredo daquele navegador E com o SMS já confirmado.
 */
export async function completeReverseOtp(options: {
  phone: string;
  browserToken: string;
}): Promise<CompleteReverseOtpResult> {
  const record = await prisma.otpCode.findFirst({
    where: {
      phone: options.phone,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      browserTokenHash: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || !record.browserTokenHash) {
    return { status: 'erro', reason: 'O tempo acabou. Peça um novo código.' };
  }

  if (!safeCompare(record.browserTokenHash, hashCode(options.phone, options.browserToken))) {
    return { status: 'erro', reason: 'Este pedido de acesso não vale mais. Peça um novo código.' };
  }

  if (!record.confirmedAt) return { status: 'aguardando' };

  // `consumedAt: null` no filtro: duas consultas simultâneas não criam duas
  // sessões com o mesmo pedido.
  const { count } = await prisma.otpCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count === 0) return { status: 'erro', reason: 'Este pedido de acesso já foi usado.' };

  const entrada = await entrarComTelefoneConfirmado(options.phone);
  return entrada.ok
    ? { status: 'ok', userId: entrada.userId, isNewUser: entrada.isNewUser }
    : { status: 'erro', reason: entrada.reason };
}

/** Limpeza de códigos vencidos — roda por job. */
export async function purgeExpiredOtpCodes(): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return result.count;
}
