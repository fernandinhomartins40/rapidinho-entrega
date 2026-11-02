'use server';

import { runStoreAction, type ActionResult } from '@/lib/store-action';
import { trocarSenhaDoUsuario } from '@/lib/trocar-senha';

/** Senha do lojista ou funcionário logado — é com ela que ele entra no painel. */
export async function trocarMinhaSenha(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (acesso) => ({
    result: await trocarSenhaDoUsuario(acesso.user.id, formData),
  }));
}
