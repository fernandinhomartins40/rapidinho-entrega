'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AuthorizationError } from '@rapidinho/auth';
import { AUDIT_ACTIONS } from '@rapidinho/database';
import { gravarChaveDoGoogleMaps } from '@rapidinho/services';
import { runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

// Chave de API do Google: "AIza" e mais 35 caracteres.
const schema = z.object({
  chave: z
    .string()
    .trim()
    .regex(/^AIza[0-9A-Za-z_-]{35}$/, 'Cole a chave inteira, que começa com AIza.'),
});

/** Só o super admin: a chave vale para todos os mapas da plataforma. */
export async function salvarChaveDoGoogleMaps(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    if (admin.role !== 'SUPER_ADMIN') throw new AuthorizationError('Só o super admin muda isso.');

    const remover = formData.get('remover') === '1';
    const chave = remover ? null : schema.parse({ chave: formData.get('chave') }).chave;
    await gravarChaveDoGoogleMaps(chave, admin.id);
    revalidatePath('/admin/mapas');

    return {
      result: {
        ok: true,
        message: remover
          ? 'Chave removida. O app volta a abrir o Google Maps por fora.'
          : 'Chave salva. Os mapas do app já passam a usar ela.',
      },
      // Só o fato: o final da chave basta para saber qual foi posta.
      audit: {
        action: AUDIT_ACTIONS.settingUpdated,
        entityType: 'PlatformSetting',
        entityId: 'google_maps_api_key',
        after: { chave: chave ? `…${chave.slice(-4)}` : null },
      },
    };
  });
}
