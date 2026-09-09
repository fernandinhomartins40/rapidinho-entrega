import { estimatedRouteMeters, type Coordinates } from '../utils/geo';

/** Modos de cobrança de entrega — espelha o enum DeliveryFeeMode do Prisma. */
export type DeliveryFeeMode = 'FIXED' | 'BY_DISTANCE' | 'BY_ZONE' | 'FREE';

export interface DeliveryZoneRule {
  id: string;
  name: string;
  neighborhoodId?: string | null;
  feeCents: number;
  minOrderCents?: number | null;
  estimatedMinutes?: number | null;
  isActive: boolean;
}

export interface DeliveryFeeInput {
  mode: DeliveryFeeMode;
  /// Taxa base (modo FIXED) ou taxa mínima (modo BY_DISTANCE).
  deliveryFeeCents: number;
  pricePerKmCents: number;
  deliveryRadiusMeters: number;
  freeDeliveryAboveCents?: number | null;
  subtotalCents: number;
  zones?: DeliveryZoneRule[];
  /// Bairro escolhido pelo cliente (modo BY_ZONE).
  neighborhoodId?: string | null;
  storeCoordinates?: Coordinates | null;
  addressCoordinates?: Coordinates | null;
}

export type DeliveryFeeResult =
  | {
      available: true;
      feeCents: number;
      distanceMeters?: number;
      estimatedMinutes?: number;
      isFreeByThreshold: boolean;
      zoneId?: string;
    }
  | {
      available: false;
      reason: string;
    };

/**
 * Calcula a taxa de entrega conforme a configuração da loja.
 *
 * O modo BY_DISTANCE precisa das coordenadas dos dois lados; no interior nem
 * todo endereço tem geolocalização, então quando faltar coordenada caímos na
 * taxa fixa em vez de recusar o pedido — recusar seria pior para a operação.
 */
export function calculateDeliveryFee(input: DeliveryFeeInput): DeliveryFeeResult {
  const meetsFreeThreshold =
    input.freeDeliveryAboveCents != null &&
    input.freeDeliveryAboveCents > 0 &&
    input.subtotalCents >= input.freeDeliveryAboveCents;

  if (input.mode === 'FREE') {
    return { available: true, feeCents: 0, isFreeByThreshold: false };
  }

  if (input.mode === 'BY_ZONE') {
    const zone = input.zones?.find(
      (item) => item.isActive && item.neighborhoodId === input.neighborhoodId,
    );

    if (!zone) {
      return {
        available: false,
        reason: 'Esta loja ainda não entrega no bairro selecionado',
      };
    }

    if (zone.minOrderCents != null && input.subtotalCents < zone.minOrderCents) {
      return {
        available: false,
        reason: `Pedido mínimo para este bairro não atingido`,
      };
    }

    return {
      available: true,
      feeCents: meetsFreeThreshold ? 0 : zone.feeCents,
      isFreeByThreshold: meetsFreeThreshold,
      zoneId: zone.id,
      ...(zone.estimatedMinutes ? { estimatedMinutes: zone.estimatedMinutes } : {}),
    };
  }

  if (input.mode === 'BY_DISTANCE') {
    if (!input.storeCoordinates || !input.addressCoordinates) {
      return {
        available: true,
        feeCents: meetsFreeThreshold ? 0 : input.deliveryFeeCents,
        isFreeByThreshold: meetsFreeThreshold,
      };
    }

    const distanceMeters = estimatedRouteMeters(input.storeCoordinates, input.addressCoordinates);

    if (distanceMeters > input.deliveryRadiusMeters) {
      return {
        available: false,
        reason: 'Endereço fora da área de entrega desta loja',
      };
    }

    const distanceFee = Math.round((distanceMeters / 1000) * input.pricePerKmCents);
    const feeCents = Math.max(input.deliveryFeeCents, distanceFee);

    return {
      available: true,
      feeCents: meetsFreeThreshold ? 0 : feeCents,
      distanceMeters,
      isFreeByThreshold: meetsFreeThreshold,
    };
  }

  return {
    available: true,
    feeCents: meetsFreeThreshold ? 0 : input.deliveryFeeCents,
    isFreeByThreshold: meetsFreeThreshold,
  };
}
