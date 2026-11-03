import { headers } from 'next/headers';
import {
  conferirCodigoDoTelefone,
  limitarConferenciaDeCodigo,
  limitarPedidoDeCodigo,
  requestOtp,
} from '@rapidinho/auth';
import { clientIpFromHeaders, getOtpSender, resetRateLimit } from '@rapidinho/services';
import { parseServerEnv } from '@rapidinho/shared';

/**
 * Prova de posse do telefone nos cadastros públicos (loja e entregador).
 *
 * Decisão do dono (11): o cadastro só grava depois do código por SMS, e nunca
 * altera uma conta que já existe. O envio responde igual para qualquer número,
 * para o formulário não dizer a um anônimo quem tem conta.
 */

export async function ipDaRequisicao(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export async function enviarCodigoParaOTelefone(
  telefone: string,
): Promise<{ ok: true; devCode?: string } | { ok: false; message: string }> {
  const limite = await limitarPedidoDeCodigo(telefone, await ipDaRequisicao());
  if (!limite.permitido) {
    return {
      ok: false,
      message: `Muitas tentativas. Tente de novo em ${Math.ceil(limite.esperaSegundos / 60)} minutos.`,
    };
  }

  const env = parseServerEnv();
  const resultado = await requestOtp({
    phone: telefone,
    sender: getOtpSender(),
    ttlSeconds: env.OTP_TTL_SECONDS,
    requestIp: await ipDaRequisicao(),
    exposeCode: env.NODE_ENV === 'development',
  });

  return resultado.code ? { ok: true, devCode: resultado.code } : { ok: true };
}

/** Confere o código digitado. Não cria nem mexe em conta nenhuma. */
export async function conferirTelefoneDoCadastro(
  telefone: string,
  codigo: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!/^\d{6}$/.test(codigo)) {
    return { ok: false, message: 'Digite o código de 6 números que enviamos por SMS.' };
  }

  const { permitido, chave } = await limitarConferenciaDeCodigo(telefone, await ipDaRequisicao());
  if (!permitido) return { ok: false, message: 'Muitas tentativas. Peça um novo código.' };

  const env = parseServerEnv();
  const resultado = await conferirCodigoDoTelefone({
    phone: telefone,
    code: codigo,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });
  if (!resultado.ok) return { ok: false, message: resultado.reason };

  await resetRateLimit(chave);
  return { ok: true };
}

/**
 * Resposta para quem confirmou um telefone que já tem conta. Só aparece depois
 * do código, ou seja, para o próprio dono do número.
 */
export const TELEFONE_JA_TEM_CONTA =
  'Este telefone já tem conta no Rapidinho, e este formulário não altera contas. Fale com a equipe Rapidinho para ligar o cadastro à sua conta.';
