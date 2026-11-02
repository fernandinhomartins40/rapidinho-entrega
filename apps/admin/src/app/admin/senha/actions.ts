'use server';

import { AUDIT_ACTIONS } from '@rapidinho/database';
import { runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';
import { trocarSenhaDoUsuario } from '@/lib/trocar-senha';

/** Senha de quem está logado na equipe da plataforma. */
export async function trocarSenha(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const result = await trocarSenhaDoUsuario(admin.id, formData);

    return {
      result,
      // Nunca a senha nem o hash: só o fato.
      ...(result.ok
        ? {
            audit: {
              action: AUDIT_ACTIONS.userPasswordChanged,
              entityType: 'User',
              entityId: admin.id,
            },
          }
        : {}),
    };
  });
}
