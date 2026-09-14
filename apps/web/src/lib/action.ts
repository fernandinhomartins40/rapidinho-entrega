import { AuthorizationError, getCurrentUser, type CurrentUser } from '@rapidinho/auth';
import { ZodError } from 'zod';
import type { ActionResult } from './action-state';

/**
 * Base das Server Actions do app do cliente.
 *
 * Mais simples que a do painel: aqui não há multi-tenant nem auditoria. O que
 * importa é que erro de validação vire mensagem legível em vez de estouro, e
 * que a ação saiba se há alguém logado.
 */

export type { ActionResult } from './action-state';

function tratarErro(error: unknown): ActionResult {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const campo = issue.path.join('.') || 'geral';
      fieldErrors[campo] ??= issue.message;
    }
    return { ok: false, message: 'Confira os campos destacados.', fieldErrors };
  }

  if (error instanceof AuthorizationError) {
    return { ok: false, message: error.message };
  }

  // `redirect()` e `notFound()` do Next sinalizam por exceção.
  if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
  if (typeof error === 'object' && error !== null && 'digest' in error) throw error;

  console.error('[action] falha', error);
  return { ok: false, message: 'Não foi possível concluir. Tente de novo.' };
}

/** Ação que funciona com ou sem login (carrinho de visitante, por exemplo). */
export async function runAction<T extends ActionResult>(
  handler: (user: CurrentUser | null) => Promise<T>,
): Promise<T | ActionResult> {
  try {
    return await handler(await getCurrentUser());
  } catch (error) {
    return tratarErro(error);
  }
}

/** Ação que exige login; devolve mensagem em vez de estourar. */
export async function runAuthedAction<T extends ActionResult>(
  handler: (user: CurrentUser) => Promise<T>,
): Promise<T | ActionResult> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { ok: false, message: 'Entre com seu telefone para continuar.' };
    }

    return await handler(user);
  } catch (error) {
    return tratarErro(error);
  }
}
