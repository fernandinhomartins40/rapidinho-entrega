'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { bannerSchema } from '@rapidinho/shared';
import { boolFromForm, runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

export async function criarBanner(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const dados = bannerSchema.parse({
      title: formData.get('title'),
      imageId: formData.get('imageId'),
      linkUrl: formData.get('linkUrl') || undefined,
      storeId: formData.get('storeId') || undefined,
      cityId: formData.get('cityId') || undefined,
      placement: formData.get('placement') || 'TOP_BANNER',
      sortOrder: Number(formData.get('sortOrder') ?? 0),
      isActive: boolFromForm(formData.get('isActive')),
      startsAt: formData.get('startsAt') || undefined,
      endsAt: formData.get('endsAt') || undefined,
    });

    const banner = await prisma.banner.create({ data: dados });

    revalidatePath('/admin/banners');

    return {
      result: { ok: true, message: 'Banner publicado.' },
      audit: {
        action: AUDIT_ACTIONS.boostCreated,
        entityType: 'Banner',
        entityId: banner.id,
        after: banner,
      },
    };
  });
}

export async function alternarBanner(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.banner.findUnique({ where: { id } });

    if (!anterior) {
      return { result: { ok: false, message: 'Banner não encontrado.' } };
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: { isActive: !anterior.isActive },
    });

    revalidatePath('/admin/banners');

    return {
      result: { ok: true, message: banner.isActive ? 'Banner no ar.' : 'Banner retirado do ar.' },
      audit: {
        action: AUDIT_ACTIONS.boostCreated,
        entityType: 'Banner',
        entityId: banner.id,
        before: { isActive: anterior.isActive },
        after: { isActive: banner.isActive },
      },
    };
  });
}

/**
 * Remove o banner de vez.
 *
 * Diferente de loja ou plano, banner não tem histórico que dependa dele — só
 * as métricas, que somem junto e não fazem falta depois da campanha.
 */
export async function excluirBanner(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const id = String(formData.get('id'));
    const anterior = await prisma.banner.findUnique({ where: { id } });

    if (!anterior) {
      return { result: { ok: false, message: 'Banner não encontrado.' } };
    }

    await prisma.banner.delete({ where: { id } });
    revalidatePath('/admin/banners');

    return {
      result: { ok: true, message: 'Banner excluído.' },
      audit: {
        action: AUDIT_ACTIONS.boostCreated,
        entityType: 'Banner',
        entityId: id,
        before: anterior,
      },
    };
  });
}
