'use server';

import { normalizePhoneBR } from '@rapidinho/shared';
import { capturarErro } from '@rapidinho/services';
import { enviarCodigoParaOTelefone } from './telefone-confirmado';

export type EnvioDoCodigo =
  | { ok: true; message: string; devCode?: string }
  | { ok: false; message: string };

/** Primeiro passo dos cadastros públicos: manda o código por SMS. */
export async function enviarCodigoDeCadastro(telefoneDigitado: string): Promise<EnvioDoCodigo> {
  const telefone = normalizePhoneBR(String(telefoneDigitado ?? ''));
  if (!telefone) return { ok: false, message: 'Confira o número com DDD.' };

  try {
    const envio = await enviarCodigoParaOTelefone(telefone);
    if (!envio.ok) return envio;
    return {
      ok: true,
      message: 'Enviamos um código por SMS para este número. Digite-o abaixo.',
      ...(envio.devCode ? { devCode: envio.devCode } : {}),
    };
  } catch (erro) {
    void capturarErro(erro, { origem: 'web-codigo-de-cadastro' });
    return { ok: false, message: 'Não foi possível enviar o código. Tente de novo.' };
  }
}
