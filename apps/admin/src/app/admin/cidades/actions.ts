'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
import { AUDIT_ACTIONS } from '@rapidinho/database';
import { citySchema, slugify } from '@rapidinho/shared';
import { boolFromForm, centsFromForm, runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

function lerFormulario(formData: FormData) {
  return citySchema.parse({
    name: formData.get('name'),
    state: formData.get('state'),
    ibgeCode: formData.get('ibgeCode') || undefined,
    isActive: boolFromForm(formData.get('isActive')),
    latitude: formData.get('latitude') ? Number(formData.get('latitude')) : undefined,
    longitude: formData.get('longitude') ? Number(formData.get('longitude')) : undefined,
    serviceRadiusMeters: formData.get('serviceRadiusKm')
      ? Math.round(Number(formData.get('serviceRadiusKm')) * 1000)
      : undefined,
    defaultCommissionRate: formData.get('defaultCommissionRate')
      ? Number(String(formData.get('defaultCommissionRate')).replace(',', '.'))
      : undefined,
    defaultDeliveryFeeCents: centsFromForm(formData.get('defaultDeliveryFee')),
    defaultPricePerKmCents: centsFromForm(formData.get('defaultPricePerKm')),
  });
}

export async function criarCidade(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const dados = lerFormulario(formData);
    const slug = slugify(`${dados.name}-${dados.state}`);

    const existente = await prisma.city.findUnique({ where: { slug } });
    if (existente) {
      return {
        result: {
          ok: false,
          message: 'Já existe uma cidade com esse nome neste estado.',
          fieldErrors: { name: 'Cidade já cadastrada' },
        },
      };
    }

    const cidade = await prisma.city.create({
      data: {
        ...dados,
        slug,
        launchedAt: dados.isActive ? new Date() : null,
      },
    });

    revalidatePath('/admin/cidades');

    return {
      result: { ok: true, message: `${cidade.name} cadastrada.` },
      audit: {
        action: AUDIT_ACTIONS.cityCreated,
        entityType: 'City',
        entityId: cidade.id,
        after: cidade,
      },
    };
  });
}

export async function atualizarCidade(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.city.findUnique({ where: { id } });

    if (!anterior) {
      return { result: { ok: false, message: 'Cidade não encontrada.' } };
    }

    const dados = lerFormulario(formData);

    const cidade = await prisma.city.update({
      where: { id },
      data: {
        ...dados,
        // A data de lançamento marca a primeira abertura e não se repete.
        launchedAt: anterior.launchedAt ?? (dados.isActive ? new Date() : null),
      },
    });

    revalidatePath('/admin/cidades');

    return {
      result: { ok: true, message: `${cidade.name} atualizada.` },
      audit: {
        action: AUDIT_ACTIONS.cityUpdated,
        entityType: 'City',
        entityId: cidade.id,
        before: anterior,
        after: cidade,
      },
    };
  });
}

/**
 * Liga e desliga a cidade.
 *
 * Fechar não apaga nada: as lojas continuam cadastradas e voltam a aparecer
 * quando a cidade for reaberta.
 */
export async function alternarCidade(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.city.findUnique({ where: { id } });

    if (!anterior) {
      return { result: { ok: false, message: 'Cidade não encontrada.' } };
    }

    const cidade = await prisma.city.update({
      where: { id },
      data: {
        isActive: !anterior.isActive,
        launchedAt: anterior.launchedAt ?? (!anterior.isActive ? new Date() : null),
      },
    });

    revalidatePath('/admin/cidades');
    revalidatePath('/admin');

    return {
      result: {
        ok: true,
        message: cidade.isActive
          ? `${cidade.name} está aberta para pedidos.`
          : `${cidade.name} foi fechada.`,
      },
      audit: {
        action: AUDIT_ACTIONS.cityUpdated,
        entityType: 'City',
        entityId: cidade.id,
        before: { isActive: anterior.isActive },
        after: { isActive: cidade.isActive },
      },
    };
  });
}
