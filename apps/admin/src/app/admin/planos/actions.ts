'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { planSchema, slugify } from '@rapidinho/shared';
import { boolFromForm, centsFromForm, runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';
import { RECURSOS_DO_PLANO } from './recursos';

function numeroOuNulo(valor: FormDataEntryValue | null): number | null {
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : null;
}

function lerFormulario(formData: FormData) {
  const features: Record<string, boolean> = {};
  for (const recurso of RECURSOS_DO_PLANO) {
    features[recurso.chave] = boolFromForm(formData.get(`feature_${recurso.chave}`));
  }

  return planSchema.parse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    monthlyPriceCents: centsFromForm(formData.get('monthlyPrice')) ?? 0,
    commissionRate: Number(String(formData.get('commissionRate') ?? '0').replace(',', '.')),
    maxProducts: numeroOuNulo(formData.get('maxProducts')),
    maxPhotos: numeroOuNulo(formData.get('maxPhotos')),
    maxStaff: numeroOuNulo(formData.get('maxStaff')),
    features,
    trialDays: Number(formData.get('trialDays') ?? 0),
    isActive: boolFromForm(formData.get('isActive')),
    isDefault: boolFromForm(formData.get('isDefault')),
  });
}

/** Só um plano pode ser o padrão de loja nova. */
async function garantirPadraoUnico(planoId: string) {
  await prisma.plan.updateMany({
    where: { id: { not: planoId }, isDefault: true },
    data: { isDefault: false },
  });
}

export async function criarPlano(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const dados = lerFormulario(formData);
    const slug = slugify(dados.name);

    if (await prisma.plan.findUnique({ where: { slug } })) {
      return {
        result: {
          ok: false,
          message: 'Já existe um plano com esse nome.',
          fieldErrors: { name: 'Nome já usado' },
        },
      };
    }

    const plano = await prisma.plan.create({ data: { ...dados, slug } });

    if (plano.isDefault) await garantirPadraoUnico(plano.id);

    revalidatePath('/admin/planos');

    return {
      result: { ok: true, message: `Plano ${plano.name} criado.` },
      audit: {
        action: AUDIT_ACTIONS.planCreated,
        entityType: 'Plan',
        entityId: plano.id,
        after: plano,
      },
    };
  });
}

export async function atualizarPlano(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.plan.findUnique({ where: { id } });

    if (!anterior) {
      return { result: { ok: false, message: 'Plano não encontrado.' } };
    }

    const dados = lerFormulario(formData);
    const plano = await prisma.plan.update({ where: { id }, data: dados });

    if (plano.isDefault) await garantirPadraoUnico(plano.id);

    revalidatePath('/admin/planos');

    return {
      result: {
        ok: true,
        // A mudança de comissão vale para os pedidos seguintes; os já feitos
        // guardam a taxa aplicada na hora.
        message: `Plano ${plano.name} atualizado. A nova comissão vale para os próximos pedidos.`,
      },
      audit: {
        action: AUDIT_ACTIONS.planUpdated,
        entityType: 'Plan',
        entityId: plano.id,
        before: anterior,
        after: plano,
      },
    };
  });
}

/**
 * Desativa o plano em vez de apagar.
 *
 * Apagar quebraria o histórico de cobrança das lojas que já assinaram; um
 * plano inativo apenas some da lista de contratação.
 */
export async function desativarPlano(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });

    if (!anterior) {
      return { result: { ok: false, message: 'Plano não encontrado.' } };
    }

    if (anterior.isDefault && anterior.isActive) {
      return {
        result: {
          ok: false,
          message: 'Este é o plano padrão. Defina outro plano como padrão antes de desativar.',
        },
      };
    }

    const plano = await prisma.plan.update({
      where: { id },
      data: { isActive: !anterior.isActive },
    });

    revalidatePath('/admin/planos');

    return {
      result: {
        ok: true,
        message: plano.isActive
          ? `Plano ${plano.name} reativado.`
          : `Plano ${plano.name} desativado. As ${anterior._count.subscriptions} lojas que já assinaram continuam nele.`,
      },
      audit: {
        action: AUDIT_ACTIONS.planUpdated,
        entityType: 'Plan',
        entityId: plano.id,
        before: { isActive: anterior.isActive },
        after: { isActive: plano.isActive },
      },
    };
  });
}
