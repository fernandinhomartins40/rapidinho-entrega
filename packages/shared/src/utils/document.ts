/**
 * Validação de CPF e CNPJ. O cadastro de loja aceita os dois, porque MEI
 * (com CNPJ) e autônomo (com CPF) convivem no comércio de cidade pequena.
 */

import { onlyDigits } from './phone';

export type DocumentKind = 'CPF' | 'CNPJ';

export function isValidCPF(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  // Sequências repetidas passam no cálculo do dígito, mas são inválidas.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number) as number[];

  for (const [length, position] of [
    [9, 9],
    [10, 10],
  ] as const) {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += (digits[i] ?? 0) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    const checkDigit = remainder === 10 ? 0 : remainder;
    if (checkDigit !== digits[position]) return false;
  }

  return true;
}

export function isValidCNPJ(input: string): boolean {
  const cnpj = onlyDigits(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split('').map(Number) as number[];

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, ...weightsFirst];

  for (const [weights, position] of [
    [weightsFirst, 12],
    [weightsSecond, 13],
  ] as const) {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) {
      sum += (digits[i] ?? 0) * (weights[i] ?? 0);
    }
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? 0 : 11 - remainder;
    if (checkDigit !== digits[position]) return false;
  }

  return true;
}

export function detectDocumentKind(input: string): DocumentKind | null {
  const digits = onlyDigits(input);
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  return null;
}

export function isValidDocument(input: string): boolean {
  const kind = detectDocumentKind(input);
  if (kind === 'CPF') return isValidCPF(input);
  if (kind === 'CNPJ') return isValidCNPJ(input);
  return false;
}

export function formatDocument(input: string): string {
  const digits = onlyDigits(input);

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return input;
}
