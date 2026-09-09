import { z } from 'zod';
import { centsSchema, cuidSchema, phoneSchema } from './common';

export const orderTypeSchema = z.enum(['DELIVERY', 'PICKUP']);
export const paymentMethodSchema = z.enum([
  'PIX',
  'CREDIT_CARD_ONLINE',
  'CASH_ON_DELIVERY',
  'CARD_ON_DELIVERY',
]);
export const orderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'RECEIVED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
]);

export const cartItemSchema = z
  .object({
    productId: cuidSchema.optional(),
    quantity: z.number().int().min(1).max(99).default(1),
    weightGrams: z.number().int().min(1).max(50000).optional(),
    notes: z.string().max(200).optional(),
    complements: z
      .array(
        z.object({
          optionId: cuidSchema,
          quantity: z.number().int().min(1).max(20).default(1),
        }),
      )
      .max(50)
      .default([]),
    pizzaSizeId: cuidSchema.optional(),
    pizzaExtraId: cuidSchema.optional(),
    flavorIds: z.array(cuidSchema).max(8).default([]),
  })
  .refine((data) => data.productId != null || data.pizzaSizeId != null, {
    message: 'Item inválido: informe o produto ou o tamanho da pizza',
  })
  .refine((data) => data.pizzaSizeId == null || data.flavorIds.length > 0, {
    message: 'Escolha pelo menos um sabor',
    path: ['flavorIds'],
  });

export const addToCartSchema = z.object({
  storeId: cuidSchema,
  item: cartItemSchema,
});

export const updateCartItemSchema = z.object({
  cartItemId: cuidSchema,
  quantity: z.number().int().min(0).max(99),
  notes: z.string().max(200).optional(),
});

/**
 * Checkout. Os valores NÃO vêm do cliente: o servidor recalcula tudo a partir
 * do carrinho e do catálogo. O cliente informa apenas escolhas.
 */
export const checkoutSchema = z
  .object({
    storeId: cuidSchema,
    type: orderTypeSchema.default('DELIVERY'),
    addressId: cuidSchema.optional(),
    paymentMethod: paymentMethodSchema,
    /// "Troco para quanto?" — só faz sentido no dinheiro.
    changeForCents: centsSchema.nullable().optional(),
    couponCode: z.string().max(40).optional(),
    notes: z.string().max(500).optional(),
    /// Token do cartão gerado no cliente (o número nunca chega ao servidor).
    cardToken: z.string().max(200).optional(),
    installments: z.number().int().min(1).max(12).optional(),
    customerName: z.string().min(2).max(120).optional(),
    customerPhone: phoneSchema.optional(),
  })
  .refine((data) => data.type === 'PICKUP' || data.addressId != null, {
    message: 'Escolha um endereço de entrega',
    path: ['addressId'],
  })
  .refine(
    (data) => data.paymentMethod !== 'CREDIT_CARD_ONLINE' || data.cardToken != null,
    { message: 'Dados do cartão ausentes', path: ['cardToken'] },
  )
  .refine(
    (data) =>
      data.paymentMethod !== 'CASH_ON_DELIVERY' ||
      data.changeForCents == null ||
      data.changeForCents >= 0,
    { message: 'Valor do troco inválido', path: ['changeForCents'] },
  );

/** Mudança de status pelo lojista. */
export const updateOrderStatusSchema = z.object({
  orderId: cuidSchema,
  status: orderStatusSchema,
  note: z.string().max(200).optional(),
  /// Tempo de preparo informado ao aceitar o pedido.
  prepMinutes: z.number().int().min(1).max(240).optional(),
});

export const cancelOrderSchema = z.object({
  orderId: cuidSchema,
  reason: z.string().min(3, 'Informe o motivo').max(300),
});

export const reviewSchema = z.object({
  orderId: cuidSchema,
  storeRating: z.number().int().min(1).max(5).optional(),
  storeComment: z.string().max(1000).optional(),
  courierRating: z.number().int().min(1).max(5).optional(),
  courierComment: z.string().max(1000).optional(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
