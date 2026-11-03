import type { CodigoDeErro } from '@rapidinho/shared/app-api';

/**
 * Resultado das regras de negócio.
 *
 * Mesma forma do `ActionResult` do site (`ok`, `message`, `fieldErrors`), para a
 * Server Action devolver direto. O `codigo` é o que a API do app traduz em
 * status HTTP, sem precisar comparar texto de mensagem.
 */
export interface Falha {
  ok: false;
  message: string;
  codigo: CodigoDeErro;
  fieldErrors?: Record<string, string>;
}

export type Resultado<T extends object = object> = ({ ok: true; message?: string } & T) | Falha;

export function falha(
  message: string,
  codigo: CodigoDeErro = 'REGRA_DE_NEGOCIO',
  fieldErrors?: Record<string, string>,
): Falha {
  return { ok: false, message, codigo, ...(fieldErrors ? { fieldErrors } : {}) };
}
