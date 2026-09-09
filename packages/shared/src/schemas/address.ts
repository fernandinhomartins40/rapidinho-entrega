import { z } from 'zod';
import { cuidSchema } from './common';

/**
 * Endereço do interior: sem CEP e sem número são casos NORMAIS, não exceções.
 * O que salva a entrega é o ponto de referência — por isso ele é obrigatório
 * aqui, mesmo sendo opcional no banco (dados legados).
 */
export const addressSchema = z.object({
  label: z.string().max(40).optional(),
  street: z.string().min(3, 'Informe a rua'),
  number: z.string().max(20).optional(),
  complement: z.string().max(80).optional(),
  neighborhood: z.string().min(2, 'Informe o bairro'),
  neighborhoodId: cuidSchema.optional(),
  referencePoint: z
    .string()
    .min(3, 'Informe um ponto de referência — é o que garante a entrega')
    .max(200),
  zipCode: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido')
    .optional()
    .or(z.literal('')),
  cityId: cuidSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = addressSchema.partial().extend({
  id: cuidSchema,
});

export type AddressInput = z.infer<typeof addressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
