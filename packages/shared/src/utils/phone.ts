/**
 * Telefone é o identificador principal do usuário (login por OTP).
 * Guardamos sempre em E.164 (+5544999998888) e exibimos formatado.
 */

const BR_COUNTRY_CODE = '55';

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normaliza um telefone brasileiro para E.164.
 * Aceita "(44) 99999-8888", "44999998888", "+5544999998888".
 * Retorna null quando não é um número brasileiro plausível.
 */
export function normalizePhoneBR(input: string): string | null {
  let digits = onlyDigits(input);

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(BR_COUNTRY_CODE) && digits.length > 11) {
    digits = digits.slice(BR_COUNTRY_CODE.length);
  }

  // Celular com DDD: 11 dígitos e o nono dígito começa com 9.
  // Fixo com DDD: 10 dígitos.
  if (digits.length === 11 && digits[2] === '9') {
    return `+${BR_COUNTRY_CODE}${digits}`;
  }
  if (digits.length === 10) {
    return `+${BR_COUNTRY_CODE}${digits}`;
  }

  return null;
}

export function isValidPhoneBR(input: string): boolean {
  return normalizePhoneBR(input) !== null;
}

/** "+5544999998888" → "(44) 99999-8888" */
export function formatPhoneBR(e164: string): string {
  const digits = onlyDigits(e164).replace(new RegExp(`^${BR_COUNTRY_CODE}`), '');

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return e164;
}

/** Máscara progressiva para input controlado. */
export function maskPhoneBR(input: string): string {
  const digits = onlyDigits(input).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Link de conversa no WhatsApp, usado no contato rápido com a loja. */
export function whatsappLink(phone: string, message?: string): string {
  const e164 = normalizePhoneBR(phone) ?? phone;
  const number = onlyDigits(e164);
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${number}${query}`;
}
