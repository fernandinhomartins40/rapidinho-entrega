export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Distância em linha reta (Haversine), em metros.
 *
 * Suficiente para cidade pequena: a diferença para a distância real de rua é
 * absorvida pelo fator de rota abaixo, e não justifica depender de uma API de
 * roteamento paga na largada.
 */
export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;

  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Fator empírico que aproxima a distância em linha reta da distância de rua. */
export const ROUTE_FACTOR = 1.3;

export function estimatedRouteMeters(from: Coordinates, to: Coordinates): number {
  return Math.round(distanceInMeters(from, to) * ROUTE_FACTOR);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}
