import { z } from 'zod';
import { isValidDocument } from '../utils/document';
import { isValidPhoneBR, normalizePhoneBR } from '../utils/phone';

/** Telefone brasileiro; a saída já vem normalizada em E.164. */
export const phoneSchema = z
  .string()
  .min(10, 'Informe um telefone válido')
  .refine(isValidPhoneBR, 'Telefone inválido')
  .transform((value) => normalizePhoneBR(value) as string);

export const documentSchema = z
  .string()
  .refine(isValidDocument, 'CPF ou CNPJ inválido')
  .transform((value) => value.replace(/\D/g, ''));

/** Valor monetário em centavos. Nunca aceite float de dinheiro na borda. */
export const centsSchema = z
  .number()
  .int('Use o valor em centavos')
  .min(0, 'Valor não pode ser negativo');

export const cuidSchema = z.string().min(1, 'Identificador obrigatório');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** Horário "HH:MM" usado no cadastro de funcionamento. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)');
