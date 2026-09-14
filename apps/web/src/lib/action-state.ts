/**
 * Estado das Server Actions.
 *
 * Vive fora de `action.ts` de propósito: aquele arquivo importa
 * `next/headers` e o Prisma, e um componente de cliente que pegasse o tipo de
 * lá arrastaria código de servidor para o bundle do navegador — o build falha
 * com "You're importing a component that needs next/headers".
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
  /// Erros por campo, para o formulário destacar onde está o problema.
  fieldErrors?: Record<string, string>;
}

export const ACTION_IDLE: ActionResult = { ok: false };
