import { z } from 'zod';
import { centsSchema, cuidSchema, documentSchema, phoneSchema, timeSchema } from './common';

export const storeSegmentSchema = z.enum(['MARKET', 'PHARMACY', 'RESTAURANT', 'OTHER']);
export const deliveryFeeModeSchema = z.enum(['FIXED', 'BY_DISTANCE', 'BY_ZONE', 'FREE']);
export const pizzaPricingRuleSchema = z.enum(['HIGHEST_PRICE', 'AVERAGE_PRICE']);

/** Cadastro inicial da loja — enxuto de propósito. O resto vem depois. */
export const createStoreSchema = z.object({
  name: z.string().min(2, 'Informe o nome da loja').max(120),
  segment: storeSegmentSchema,
  categoryId: cuidSchema.optional(),
  cityId: cuidSchema,
  document: documentSchema,
  legalName: z.string().max(160).optional(),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  street: z.string().min(3, 'Informe a rua'),
  number: z.string().max(20).optional(),
  neighborhood: z.string().min(2, 'Informe o bairro'),
  referencePoint: z.string().max(200).optional(),
  zipCode: z.string().max(9).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateStoreProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).optional(),
  categoryId: cuidSchema.optional(),
  phone: phoneSchema.optional(),
  whatsapp: phoneSchema.optional(),
  email: z.string().email().optional().or(z.literal('')),
  logoId: cuidSchema.nullable().optional(),
  coverId: cuidSchema.nullable().optional(),
  street: z.string().min(3).optional(),
  number: z.string().max(20).optional(),
  neighborhood: z.string().min(2).optional(),
  referencePoint: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const storeDeliverySettingsSchema = z
  .object({
    deliveryFeeMode: deliveryFeeModeSchema,
    deliveryFeeCents: centsSchema,
    pricePerKmCents: centsSchema,
    deliveryRadiusMeters: z.number().int().min(500).max(60000),
    freeDeliveryAboveCents: centsSchema.nullable().optional(),
    minOrderCents: centsSchema,
    avgPrepTimeMinutes: z.number().int().min(1).max(240),
    avgDeliveryTimeMinutes: z.number().int().min(1).max(240),
    acceptsPickup: z.boolean(),
  })
  .refine(
    (data) => data.deliveryFeeMode !== 'BY_DISTANCE' || data.pricePerKmCents > 0,
    { message: 'Defina o preço por km', path: ['pricePerKmCents'] },
  );

export const storePaymentSettingsSchema = z
  .object({
    acceptsPix: z.boolean(),
    acceptsCardOnline: z.boolean(),
    acceptsCashOnDelivery: z.boolean(),
    acceptsCardOnDelivery: z.boolean(),
    pixKey: z.string().max(140).optional(),
  })
  .refine(
    (data) =>
      data.acceptsPix ||
      data.acceptsCardOnline ||
      data.acceptsCashOnDelivery ||
      data.acceptsCardOnDelivery,
    { message: 'Habilite ao menos uma forma de pagamento', path: ['acceptsPix'] },
  );

/** Uma faixa de horário. Vários registros no mesmo dia = intervalo de almoço. */
export const storeHourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opensAt: timeSchema,
    closesAt: timeSchema,
    isActive: z.boolean().default(true),
    /// Marca que o fechamento é no dia seguinte (ex.: 18:00 → 02:00).
    closesNextDay: z.boolean().default(false),
  })
  .refine((data) => data.closesNextDay || data.opensAt < data.closesAt, {
    message: 'O horário de fechamento deve ser depois do de abertura',
    path: ['closesAt'],
  });

export const storeHoursSchema = z.object({
  hours: z.array(storeHourSchema).max(28),
});

export const pauseStoreSchema = z.object({
  /// null volta a operar imediatamente.
  minutes: z.number().int().min(5).max(1440).nullable(),
  reason: z.string().max(140).optional(),
});

export const deliveryZoneSchema = z.object({
  name: z.string().min(2, 'Informe o nome da zona').max(80),
  neighborhoodId: cuidSchema.nullable().optional(),
  feeCents: centsSchema,
  minOrderCents: centsSchema.nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(240).nullable().optional(),
  isActive: z.boolean().default(true),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreProfileInput = z.infer<typeof updateStoreProfileSchema>;
export type StoreDeliverySettingsInput = z.infer<typeof storeDeliverySettingsSchema>;
export type StorePaymentSettingsInput = z.infer<typeof storePaymentSettingsSchema>;
export type StoreHoursInput = z.infer<typeof storeHoursSchema>;
export type DeliveryZoneInput = z.infer<typeof deliveryZoneSchema>;
