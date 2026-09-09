import { z } from 'zod';
import { centsSchema, cuidSchema } from './common';

export const citySchema = z.object({
  name: z.string().min(2, 'Informe o nome da cidade').max(120),
  state: z.string().length(2, 'UF com 2 letras').toUpperCase(),
  ibgeCode: z.string().max(10).optional(),
  isActive: z.boolean().default(false),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  serviceRadiusMeters: z.number().int().min(1000).max(200000).default(15000),
  defaultCommissionRate: z.number().min(0).max(100).default(10),
  defaultDeliveryFeeCents: centsSchema.default(500),
  defaultPricePerKmCents: centsSchema.default(150),
});

export const storeCategorySchema = z.object({
  name: z.string().min(2).max(60),
  segment: z.enum(['MARKET', 'PHARMACY', 'RESTAURANT', 'OTHER']).default('OTHER'),
  iconName: z.string().max(40).optional(),
  iconId: cuidSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Planos são DADO, nunca código: preço, comissão, limites e recursos são
 * editados pelo painel do super admin.
 */
export const planSchema = z.object({
  name: z.string().min(2, 'Informe o nome do plano').max(60),
  description: z.string().max(500).optional(),
  monthlyPriceCents: centsSchema.default(0),
  commissionRate: z.number().min(0).max(100).default(10),
  maxProducts: z.number().int().min(1).nullable().optional(),
  maxPhotos: z.number().int().min(1).nullable().optional(),
  maxStaff: z.number().int().min(1).nullable().optional(),
  features: z.record(z.string(), z.boolean()).default({}),
  trialDays: z.number().int().min(0).max(365).default(0),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const boostPackageSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  placement: z.enum([
    'HOME_HIGHLIGHT',
    'TOP_BANNER',
    'CATEGORY_HIGHLIGHT',
    'SEARCH_PRIORITY',
  ]),
  priceCents: centsSchema,
  durationDays: z.number().int().min(1).max(365),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Código muito curto')
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, 'Use apenas letras, números e hífen')
      .transform((value) => value.toUpperCase()),
    description: z.string().max(200).optional(),
    scope: z.enum(['PLATFORM', 'STORE']).default('STORE'),
    storeId: cuidSchema.nullable().optional(),
    cityId: cuidSchema.nullable().optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY']),
    discountValue: z.number().int().min(0),
    maxDiscountCents: centsSchema.nullable().optional(),
    minOrderCents: centsSchema.default(0),
    usageLimit: z.number().int().min(1).nullable().optional(),
    usagePerUser: z.number().int().min(1).nullable().optional(),
    firstOrderOnly: z.boolean().default(false),
    startsAt: z.coerce.date().default(() => new Date()),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => data.discountType !== 'PERCENTAGE' || data.discountValue <= 100,
    { message: 'Percentual não pode passar de 100', path: ['discountValue'] },
  )
  .refine(
    (data) => data.discountType === 'FREE_DELIVERY' || data.discountValue > 0,
    { message: 'Informe o valor do desconto', path: ['discountValue'] },
  )
  .refine((data) => data.scope !== 'STORE' || data.storeId != null, {
    message: 'Cupom de loja precisa de uma loja',
    path: ['storeId'],
  });

export const bannerSchema = z.object({
  title: z.string().min(2).max(120),
  imageId: cuidSchema,
  linkUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  storeId: cuidSchema.nullable().optional(),
  cityId: cuidSchema.nullable().optional(),
  placement: z
    .enum(['HOME_HIGHLIGHT', 'TOP_BANNER', 'CATEGORY_HIGHLIGHT', 'SEARCH_PRIORITY'])
    .default('TOP_BANNER'),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

export const approveStoreSchema = z.object({
  storeId: cuidSchema,
  approved: z.boolean(),
  reason: z.string().max(300).optional(),
});

export const impersonateSchema = z.object({
  userId: cuidSchema,
  storeId: cuidSchema.optional(),
  reason: z.string().min(3, 'Descreva o motivo do acesso').max(300),
});

/** Notificação segmentada por cidade, categoria ou inatividade. */
export const notificationCampaignSchema = z.object({
  title: z.string().min(2).max(80),
  body: z.string().min(2).max(300),
  linkUrl: z.string().max(500).optional(),
  channel: z.enum(['PUSH', 'WHATSAPP', 'EMAIL', 'SMS']).default('PUSH'),
  segment: z.object({
    cityIds: z.array(cuidSchema).default([]),
    categoryIds: z.array(cuidSchema).default([]),
    roles: z.array(z.string()).default([]),
    inactiveDays: z.number().int().min(1).max(3650).nullable().optional(),
  }),
  scheduledFor: z.coerce.date().nullable().optional(),
});

export type CityInput = z.infer<typeof citySchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type CouponAdminInput = z.infer<typeof couponSchema>;
export type BoostPackageInput = z.infer<typeof boostPackageSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
export type NotificationCampaignInput = z.infer<typeof notificationCampaignSchema>;
