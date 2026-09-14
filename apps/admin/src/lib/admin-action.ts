import { headers } from 'next/headers';
import { AuthorizationError, requireAdmin, type CurrentUser } from '@rapidinho/auth';
import { recordAudit } from '@rapidinho/database';
import { capturarErro, clientIpFromHeaders } from '@rapidinho/services';
import { ZodError } from 'zod';
import type { ActionResult } from './action-state';

/**
 * Base das Server Actions do painel da plataforma.
 *
 * Duas garantias em um lugar só: a ação exige papel de plataforma e deixa
 * rastro na auditoria. Ação administrativa sem registro de quem fez é o tipo
 * de buraco que só aparece quando já houve problema.
 */

export type { ActionResult } from './action-state';

export interface AuditContext {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Executa a ação já autenticada e grava a auditoria com o que ela devolver.
 * Se a ação lançar, nada é registrado — auditoria de ação que não aconteceu
 * é pior que auditoria nenhuma.
 */
export async function runAdminAction(
  handler: (user: CurrentUser) => Promise<{ result: ActionResult; audit?: AuditContext }>,
): Promise<ActionResult> {
  let user: CurrentUser;

  try {
    user = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  try {
    const { result, audit } = await handler(user);

    if (result.ok && audit) {
      const requestHeaders = await headers();
      await recordAudit({
        actorId: user.id,
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

    // `redirect()` do Next sinaliza por exceção: não pode ser engolido aqui.
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;

    void capturarErro(error, { origem: 'admin-action' });
    return { ok: false, message: 'Não foi possível concluir. Tente de novo.' };
  }
}

/** Converte um FormData em objeto simples para o Zod validar. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const objeto: Record<string, unknown> = {};

  for (const [chave, valor] of formData.entries()) {
    if (valor instanceof File) continue;
    // Checkbox desmarcado não vem no FormData; o schema trata o ausente.
    objeto[chave] = valor === '' ? undefined : valor;
  }

  return objeto;
}

/** "12,50" ou "12.50" → 1250 centavos, vindo direto de um input de texto. */
export function centsFromForm(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value === '') return undefined;
  const texto = String(value).replace(/[^\d,.-]/g, '');
  if (texto === '') return undefined;

  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  const numero = Number(normalizado);

  return Number.isFinite(numero) ? Math.round(numero * 100) : undefined;
}

export function boolFromForm(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true' || value === '1';
}
