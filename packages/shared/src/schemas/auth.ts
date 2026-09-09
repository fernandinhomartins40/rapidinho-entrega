import { z } from 'zod';
import { phoneSchema } from './common';

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .length(6, 'O código tem 6 dígitos')
    .regex(/^\d{6}$/, 'O código tem apenas números'),
});

export const completeProfileSchema = z.object({
  name: z.string().min(2, 'Informe seu nome').max(120),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'É preciso aceitar os termos de uso' }),
  }),
  marketingOptIn: z.boolean().default(false),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
