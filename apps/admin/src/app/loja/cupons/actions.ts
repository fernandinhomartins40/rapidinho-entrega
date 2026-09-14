'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { runStoreAction, type ActionResult } from '@/lib/store-action';
import { centsFromForm } from '@/lib/admin-action';

/**
 * Cupons da loja.
 *
 * Custeados pelo lojista, ao contrário dos cupons globais da plataforma. O
 * escopo é sempre STORE aqui — o painel nunca deixa a loja criar cupom que a
 * plataforma paga.
 */

const cupomSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Use pelo menos 3 caracteres')
      .max(24)
      // Cupom é digitado à mão, muitas vezes ditado pelo telefone: espaço e
      // minúscula viram fonte de "não funciona" que não é culpa do cliente.
      .transform((valor) => valor.trim().toUpperCase().replace(/\s+/g, '')),
    description: z.string().max(200).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY']),
    discountValue: z.number().int().min(0),
    maxDiscountCents: z.number().int().min(0).nullable(),
    minOrderCents: z.number().int().min(0),
    usageLimit: z.number().int().min(1).nullable(),
    usagePerUser: z.number().int().min(1).nullable(),
    firstOrderOnly: z.boolean(),
    endsAt: z.coerce.date().nullable(),
  })
  .refine(
    (dados) =>
      dados.discountType !== 'PERCENTAGE' ||
      (dados.discountValue > 0 && dados.discountValue <= 100),
    { message: 'Informe um percentual entre 1 e 100', path: ['discountValue'] },
  )
  .refine((dados) => dados.discountType !== 'FIXED_AMOUNT' || dados.discountValue > 0, {
    message: 'Informe o valor do desconto',
    path: ['discountValue'],
  });

export async function salvarCupom(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const tipo = String(formData.get('discountType'));

    const dados = cupomSchema.parse({
      code: formData.get('code'),
      description: formData.get('description') || undefined,
      discountType: tipo,
      // Percentual chega como número inteiro; valor fixo, como centavos.
      discountValue:
        tipo === 'PERCENTAGE'
          ? Number(formData.get('discountValue') ?? 0)
          : (centsFromForm(formData.get('discountValue')) ?? 0),
      maxDiscountCents: centsFromForm(formData.get('maxDiscountCents')) ?? null,
      minOrderCents: centsFromForm(formData.get('minOrderCents')) ?? 0,
      usageLimit: formData.get('usageLimit') ? Number(formData.get('usageLimit')) : null,
      usagePerUser: formData.get('usagePerUser') ? Number(formData.get('usagePerUser')) : 1,
      firstOrderOnly: formData.get('firstOrderOnly') === 'on',
      endsAt: formData.get('endsAt') || null,
    });

    const duplicado = await prisma.coupon.findFirst({
      where: { code: dados.code, storeId: access.storeId },
      select: { id: true },
    });

    if (duplicado) {
      return {
        result: {
          ok: false,
          message: 'Você já tem um cupom com esse código.',
          fieldErrors: { code: 'Código repetido' },
        },
      };
    }

    const cupom = await prisma.coupon.create({
      data: {
        ...dados,
        scope: 'STORE',
        storeId: access.storeId,
        isActive: true,
      },
      select: { id: true, code: true },
    });

    revalidatePath('/loja/cupons');

    return {
      result: { ok: true, message: `Cupom ${cupom.code} criado.` },
      audit: { action: 'coupon.created', entityType: 'Coupon', entityId: cupom.id },
    };
  });
}

export async function alternarCupom(id: string, ativo: boolean): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.coupon.updateMany({
      where: { id, storeId: access.storeId },
      data: { isActive: ativo },
    });

    if (count === 0) return { result: { ok: false, message: 'Cupom não encontrado.' } };

    revalidatePath('/loja/cupons');
    return { result: { ok: true, message: ativo ? 'Cupom ativado.' : 'Cupom desativado.' } };
  });
}
