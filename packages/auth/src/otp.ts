import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@rapidinho/database';
import type { OtpSender } from '@rapidinho/shared';

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

  const existing = await prisma.user.findUnique({ where: { phone: options.phone } });

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
    data: {
      phone: options.phone,
      phoneVerified: new Date(),
      role: 'CUSTOMER',
    },
  });

  return { ok: true, userId: created.id, isNewUser: true };
}

/** Limpeza de códigos vencidos — roda por job. */
export async function purgeExpiredOtpCodes(): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return result.count;
}
