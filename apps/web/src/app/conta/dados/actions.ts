'use server';

import { revalidatePath } from 'next/cache';
import { destroyCurrentSession } from '@rapidinho/auth';
import { excluirConta } from '@rapidinho/services/regras';
import { runAuthedAction, type ActionResult } from '@/lib/action';
import { reunirDadosDoTitular } from '@/lib/dados-do-titular';

/**
 * Direitos do titular (LGPD, art. 18).
 *
 * Exportação e exclusão dos dados, pelo próprio usuário, sem precisar abrir
 * chamado — que é o que a lei chama de "acesso facilitado".
 */

export interface DadosExportados extends ActionResult {
  json?: string;
}

/**
 * Reúne tudo o que guardamos sobre a pessoa (ver `reunirDadosDoTitular`).
 * No app nativo o download vai por `/api/conta/exportar`, porque a WebView
 * não salva o arquivo gerado no navegador.
 */
export async function exportarMeusDados(): Promise<DadosExportados> {
  return runAuthedAction(async (user) => {
    const json = await reunirDadosDoTitular(user.id);
    if (!json) return { ok: false, message: 'Conta não encontrada.' };
    return { ok: true, message: 'Seus dados foram reunidos.', json };
  });
}

/** Exclusão da conta, com a mesma regra do app (`excluirConta`). */
export async function excluirMinhaConta(): Promise<ActionResult> {
  const resultado = await runAuthedAction((user) => excluirConta(user.id));

  if (resultado.ok) {
    await destroyCurrentSession();
    revalidatePath('/');
  }

  return resultado;
}
