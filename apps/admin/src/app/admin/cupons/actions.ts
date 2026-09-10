'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { couponSchema } from '@rapidinho/shared';
import { boolFromForm, centsFromForm, runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

/**
 * Cupons custeados pela plataforma.
 *
 * O desconto percentual guarda o número inteiro (20 = 20%); o de valor fixo
 * guarda centavos. É a mesma coluna, e o tipo diz como lê-la.
 */
function lerFormulario(formData: FormData) {
  const tipo = String(formData.get('discountType'));

  const valor =
    tipo === 'PERCENTAGE'
      ? Number(formData.get('discountValue') ?? 0)
      : tipo === 'FIXED_AMOUNT'
        ? (centsFromForm(formData.get('discountValue')) ?? 0)
        : 0;

  return couponSchema.parse({
    code: formData.get('code'),
    description: formData.get('description') || undefined,
    scope: 'PLATFORM',
    cityId: formData.get('cityId') || undefined,
    discountType: tipo,
    discountValue: valor,
    maxDiscountCents: centsFromForm(formData.get('maxDiscount')),
    minOrderCents: centsFromForm(formData.get('minOrder')) ?? 0,
    usageLimit: formData.get('usageLimit') ? Number(formData.get('usageLimit')) : undefined,
    usagePerUser: formData.get('usagePerUser') ? Number(formData.get('usagePerUser')) : undefined,
    firstOrderOnly: boolFromForm(formData.get('firstOrderOnly')),
    startsAt: formData.get('startsAt') || new Date(),
    endsAt: formData.get('endsAt') || undefined,
    isActive: boolFromForm(formData.get('isActive')),
  });
}

export async function criarCupom(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const dados = lerFormulario(formData);

    const existente = await prisma.coupon.findFirst({
      where: { code: dados.code, storeId: null },
    });

    if (existente) {
      return {
        result: {
          ok: false,
          message: 'Já existe um cupom da plataforma com esse código.',
          fieldErrors: { code: 'Código já usado' },
        },
      };
    }

    const cupom = await prisma.coupon.create({
      data: { ...dados, storeId: null },
    });

    revalidatePath('/admin/cupons');

    return {
      result: { ok: true, message: `Cupom ${cupom.code} criado.` },
      audit: {
        action: AUDIT_ACTIONS.couponCreated,
        entityType: 'Coupon',
        entityId: cupom.id,
        after: cupom,
      },
    };
  });
}

export async function alternarCupom(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.coupon.findUnique({ where: { id } });

    if (!anterior) {
      return { result: { ok: false, message: 'Cupom não encontrado.' } };
    }

    const cupom = await prisma.coupon.update({
      where: { id },
      data: { isActive: !anterior.isActive },
    });

    revalidatePath('/admin/cupons');

    return {
      result: {
        ok: true,
        message: cupom.isActive
          ? `Cupom ${cupom.code} reativado.`
          : `Cupom ${cupom.code} desativado. Quem já usou não é afetado.`,
      },
      audit: {
        action: AUDIT_ACTIONS.couponUpdated,
        entityType: 'Coupon',
        entityId: cupom.id,
        before: { isActive: anterior.isActive },
        after: { isActive: cupom.isActive },
      },
    };
  });
}
