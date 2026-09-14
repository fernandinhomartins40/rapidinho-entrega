import { headers } from 'next/headers';
import {
  AuthorizationError,
  requireStoreAccess,
  requireStoreOwner,
  type StoreAccess,
} from '@rapidinho/auth';
import { recordAudit } from '@rapidinho/database';
import { capturarErro, clientIpFromHeaders } from '@rapidinho/services';
import { ZodError } from 'zod';
import type { ActionResult } from './action-state';

/**
 * Base das Server Actions do painel da loja.
 *
 * A `storeId` NUNCA é lida do formulário: vem de `requireStoreAccess`, que
 * confere o vínculo do usuário na tabela StoreStaff. É esta função que torna o
 * isolamento multi-tenant uma propriedade da camada de dados, e não algo que
 * depende de cada tela lembrar de filtrar.
 */

export type { ActionResult } from './action-state';

export interface StoreAuditContext {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

type Handler = (access: StoreAccess) => Promise<{
  result: ActionResult;
  audit?: StoreAuditContext;
}>;

async function executar(access: () => Promise<StoreAccess>, handler: Handler) {
  let acesso: StoreAccess;

  try {
    acesso = await access();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  try {
    const { result, audit } = await handler(acesso);

    // Só o que um admin da plataforma faz dentro de uma loja vai para a
    // auditoria da plataforma; a rotina do lojista na própria loja não é
    // evento administrativo e encheria a tabela sem utilidade.
    if (result.ok && audit && acesso.isPlatformAdmin) {
      const requestHeaders = await headers();
      await recordAudit({
        actorId: acesso.user.id,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityId ?? null,
        before: audit.before,
        after: audit.after,
        ipAddress: clientIpFromHeaders(requestHeaders),
        userAgent: requestHeaders.get('user-agent'),
      });
    }

    return result;
  } catch (error) {
    return tratarErro(error);
  }
}

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

  void capturarErro(error, { origem: 'store-action' });
  return { ok: false, message: 'Não foi possível concluir. Tente de novo.' };
}

/** Ação que qualquer membro ativo da loja pode executar. */
export async function runStoreAction(handler: Handler): Promise<ActionResult> {
  return executar(() => requireStoreAccess(), handler);
}

/** Ação restrita ao dono: financeiro, plano, equipe, dados cadastrais. */
export async function runStoreOwnerAction(handler: Handler): Promise<ActionResult> {
  return executar(() => requireStoreOwner(), handler);
}
