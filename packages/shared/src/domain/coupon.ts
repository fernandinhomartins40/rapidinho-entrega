import { percentOfCents } from '../utils/money';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_DELIVERY';
export type CouponScope = 'PLATFORM' | 'STORE';

export interface CouponRule {
  id: string;
  code: string;
  scope: CouponScope;
  storeId?: string | null;
  cityId?: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountCents?: number | null;
  minOrderCents: number;
  usageLimit?: number | null;
  usagePerUser?: number | null;
  usageCount: number;
  firstOrderOnly: boolean;
  startsAt: Date;
  endsAt?: Date | null;
  isActive: boolean;
}

export interface CouponContext {
  subtotalCents: number;
  deliveryFeeCents: number;
  storeId: string;
  cityId: string;
  /// Quantas vezes este cliente já usou o cupom.
  userRedemptionCount: number;
  /// Cliente nunca pediu antes na plataforma.
  isFirstOrder: boolean;
  now?: Date;
}

export type CouponResult =
  { valid: true; discountCents: number; freeDelivery: boolean } | { valid: false; reason: string };

/**
 * Valida e calcula o desconto de um cupom.
 *
 * Nunca confie no desconto vindo do cliente: o checkout recalcula por aqui
 * antes de gravar o pedido.
 */
export function applyCoupon(coupon: CouponRule, context: CouponContext): CouponResult {
  const now = context.now ?? new Date();

  if (!coupon.isActive) {
    return { valid: false, reason: 'Cupom indisponível' };
  }
  if (coupon.startsAt.getTime() > now.getTime()) {
    return { valid: false, reason: 'Este cupom ainda não começou a valer' };
  }
  if (coupon.endsAt && coupon.endsAt.getTime() <= now.getTime()) {
    return { valid: false, reason: 'Este cupom expirou' };
  }
  if (coupon.scope === 'STORE' && coupon.storeId !== context.storeId) {
    return { valid: false, reason: 'Este cupom não vale para esta loja' };
  }
  if (coupon.cityId && coupon.cityId !== context.cityId) {
    return { valid: false, reason: 'Este cupom não vale para esta cidade' };
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, reason: 'Este cupom esgotou' };
  }
  if (coupon.usagePerUser != null && context.userRedemptionCount >= coupon.usagePerUser) {
    return { valid: false, reason: 'Você já usou este cupom' };
  }
  if (coupon.firstOrderOnly && !context.isFirstOrder) {
    return { valid: false, reason: 'Cupom válido apenas no primeiro pedido' };
  }
  if (context.subtotalCents < coupon.minOrderCents) {
    return { valid: false, reason: 'Pedido mínimo do cupom não atingido' };
  }

  if (coupon.discountType === 'FREE_DELIVERY') {
    return {
      valid: true,
      discountCents: context.deliveryFeeCents,
      freeDelivery: true,
    };
  }

  const rawDiscount =
    coupon.discountType === 'PERCENTAGE'
      ? percentOfCents(context.subtotalCents, coupon.discountValue)
      : coupon.discountValue;

  const capped =
    coupon.maxDiscountCents != null ? Math.min(rawDiscount, coupon.maxDiscountCents) : rawDiscount;

  return {
    valid: true,
    discountCents: Math.min(capped, context.subtotalCents),
    freeDelivery: false,
  };
}
