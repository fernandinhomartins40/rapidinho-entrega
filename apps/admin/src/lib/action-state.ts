/**
 * Estado das Server Actions.
 *
 * Vive fora de `admin-action.ts` de propósito: aquele arquivo puxa
 * `next/headers` e o Prisma, e um componente de cliente que importasse o tipo
 * de lá arrastaria código de servidor para o bundle. Aqui não há nada além de
 * tipos e uma constante.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
  /// Erros por campo, para o formulário destacar onde está o problema.
  fieldErrors?: Record<string, string>;
}

export const ACTION_IDLE: ActionResult = { ok: false };
