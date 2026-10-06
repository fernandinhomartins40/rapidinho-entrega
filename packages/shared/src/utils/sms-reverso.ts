import { APP_NAME } from '../constants';
import { normalizePhoneBR, onlyDigits } from './phone';

/**
 * Confirmação reversa por SMS: em vez de a plataforma enviar o código (e pagar
 * por cada envio), o cliente envia do próprio aparelho para o número da
 * operação. O que prova que o número é dele é o REMETENTE do SMS; o código só
 * liga aquele SMS ao pedido de login certo.
 */

const TAMANHO_DO_CODIGO = 6;

/** Texto que o cliente envia. Curto: cabe num SMS e na prévia da notificação. */
export function textoDoSmsDeConfirmacao(code: string): string {
  return `${APP_NAME.split(' ')[0]} ${code}`;
}

/**
 * Link que abre o app de mensagens com destinatário e texto preenchidos.
 * `?body=` é o que Android e iOS atuais entendem; o número vai em E.164.
 */
export function linkDoSmsDeConfirmacao(gatewayNumber: string, code: string): string {
  const numero = normalizePhoneBR(gatewayNumber) ?? gatewayNumber;
  return `sms:${numero}?body=${encodeURIComponent(textoDoSmsDeConfirmacao(code))}`;
}

/**
 * Códigos de 6 dígitos presentes no texto. Aceita o código sozinho, com o
 * nome na frente ou no meio de uma frase — o cliente pode ter digitado à mão.
 * Sequências maiores (um telefone, por exemplo) não contam.
 */
export function codigosNoSms(texto: string): string[] {
  const achados = texto.match(/(?<!\d)\d{6}(?!\d)/g) ?? [];
  return [...new Set(achados)].slice(0, 5);
}

/**
 * Remetente do SMS, como a operadora entrega, para E.164.
 *
 * As operadoras variam: "+5544999998888", "044999998888", "44999998888" e até
 * "01544999998888" (código de operadora de longa distância). Remetente que não
 * é um número brasileiro (short code, nome de empresa) devolve null.
 */
export function remetenteDoSms(remetente: string): string | null {
  let digitos = onlyDigits(remetente);
  if (!digitos) return null;

  const direto = normalizePhoneBR(digitos);
  if (direto) return direto;

  // "0" de longa distância, com ou sem os dois dígitos da operadora.
  if (digitos.startsWith('0')) {
    digitos = digitos.slice(1);
    return normalizePhoneBR(digitos) ?? normalizePhoneBR(digitos.slice(2));
  }

  return null;
}

export const SMS_REVERSO = { TAMANHO_DO_CODIGO } as const;
