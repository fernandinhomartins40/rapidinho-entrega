'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { boostPackageSchema } from '@rapidinho/shared';
import { boolFromForm, centsFromForm, runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

function lerFormulario(formData: FormData) {
  return boostPackageSchema.parse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    placement: formData.get('placement'),
    priceCents: centsFromForm(formData.get('price')) ?? 0,
    durationDays: Number(formData.get('durationDays') ?? 7),
    priority: Number(formData.get('priority') ?? 0),
    isActive: boolFromForm(formData.get('isActive')),
  });
}

export async function salvarPacote(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = formData.get('id') ? String(formData.get('id')) : null;
    const dados = lerFormulario(formData);

    if (id) {
      const anterior = await prisma.boostPackage.findUnique({ where: { id } });
      if (!anterior) {
        return { result: { ok: false, message: 'Pacote não encontrado.' } };
      }

      const pacote = await prisma.boostPackage.update({ where: { id }, data: dados });
      revalidatePath('/admin/impulsionamento');

      return {
        result: {
          ok: true,
          // Boost já comprado mantém o preço e a duração da compra.
          message: `Pacote ${pacote.name} atualizado. Impulsionamentos em andamento não mudam.`,
        },
        audit: {
          action: AUDIT_ACTIONS.boostCreated,
          entityType: 'BoostPackage',
          entityId: pacote.id,
          before: anterior,
          after: pacote,
        },
      };
    }

    const pacote = await prisma.boostPackage.create({ data: dados });
    revalidatePath('/admin/impulsionamento');

    return {
      result: { ok: true, message: `Pacote ${pacote.name} criado.` },
      audit: {
        action: AUDIT_ACTIONS.boostCreated,
        entityType: 'BoostPackage',
        entityId: pacote.id,
        after: pacote,
      },
    };
  });
}

export async function alternarPacote(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.boostPackage.findUnique({ where: { id } });

    if (!anterior) {
      return { result: { ok: false, message: 'Pacote não encontrado.' } };
    }

    const pacote = await prisma.boostPackage.update({
      where: { id },
      data: { isActive: !anterior.isActive },
    });

    revalidatePath('/admin/impulsionamento');

    return {
      result: {
        ok: true,
        message: pacote.isActive ? 'Pacote disponível para venda.' : 'Pacote retirado da vitrine.',
      },
      audit: {
        action: AUDIT_ACTIONS.boostCreated,
        entityType: 'BoostPackage',
        entityId: pacote.id,
        before: { isActive: anterior.isActive },
        after: { isActive: pacote.isActive },
      },
    };
  });
}
