/** Constantes de domínio compartilhadas entre os apps. */

export const APP_NAME = 'Rapidinho Entrega';

export const USER_ROLES = [
  'CUSTOMER',
  'STORE_OWNER',
  'STORE_STAFF',
  'COURIER',
  'ADMIN',
  'SUPER_ADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  CUSTOMER: 'Cliente',
  STORE_OWNER: 'Dono da loja',
  STORE_STAFF: 'Funcionário da loja',
  COURIER: 'Entregador',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super administrador',
};

/** Papéis que enxergam o painel da loja. */
export const STORE_ROLES: readonly UserRole[] = ['STORE_OWNER', 'STORE_STAFF'];

/** Papéis que enxergam o painel da plataforma. */
export const PLATFORM_ADMIN_ROLES: readonly UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

export function isPlatformAdmin(role: UserRole | null | undefined): boolean {
  return role != null && PLATFORM_ADMIN_ROLES.includes(role);
}

export function isStoreMember(role: UserRole | null | undefined): boolean {
  return role != null && STORE_ROLES.includes(role);
}

export const PAYMENT_METHOD_LABEL = {
  PIX: 'Pix',
  CREDIT_CARD_ONLINE: 'Cartão de crédito (online)',
  CASH_ON_DELIVERY: 'Dinheiro na entrega',
  CARD_ON_DELIVERY: 'Cartão na entrega',
} as const;

export const STORE_SEGMENT_LABEL = {
  MARKET: 'Mercado',
  PHARMACY: 'Farmácia',
  RESTAURANT: 'Restaurante',
  OTHER: 'Outros',
} as const;

export const DELIVERY_FEE_MODE_LABEL = {
  FIXED: 'Taxa fixa',
  BY_DISTANCE: 'Por distância',
  BY_ZONE: 'Por bairro',
  FREE: 'Entrega grátis',
} as const;

export const VEHICLE_TYPE_LABEL = {
  MOTORCYCLE: 'Moto',
  BICYCLE: 'Bicicleta',
  CAR: 'Carro',
  ON_FOOT: 'A pé',
} as const;

export const BOOST_PLACEMENT_LABEL = {
  HOME_HIGHLIGHT: 'Destaque na home',
  TOP_BANNER: 'Banner de topo',
  CATEGORY_HIGHLIGHT: 'Destaque na categoria',
  SEARCH_PRIORITY: 'Prioridade na busca',
} as const;

/**
 * Canais de eventos em tempo real. O nome do canal carrega o escopo
 * (loja/pedido/entregador) porque a autorização do socket é feita por canal.
 */
export const REALTIME_CHANNELS = {
  store: (storeId: string) => `store:${storeId}`,
  order: (orderId: string) => `order:${orderId}`,
  courier: (courierId: string) => `courier:${courierId}`,
  city: (cityId: string) => `city:${cityId}`,
} as const;

export const REALTIME_EVENTS = {
  orderCreated: 'order:created',
  orderStatusChanged: 'order:status-changed',
  orderCancelled: 'order:cancelled',
  deliveryAssigned: 'delivery:assigned',
  deliveryStatusChanged: 'delivery:status-changed',
  courierLocation: 'courier:location',
} as const;

/** Nomes das filas BullMQ. */
export const QUEUES = {
  imageProcessing: 'image-processing',
  notifications: 'notifications',
  planBilling: 'plan-billing',
  boostExpiration: 'boost-expiration',
  reports: 'reports',
  orderTimeout: 'order-timeout',
  campaigns: 'campaigns',
} as const;

export const DEFAULT_CITY_SLUG = 'palmital-pr';

/** Limites de segurança das rotas públicas. */
export const RATE_LIMITS = {
  otpRequest: { points: 3, durationSeconds: 900 },
  otpVerify: { points: 5, durationSeconds: 900 },
  search: { points: 60, durationSeconds: 60 },
  checkout: { points: 10, durationSeconds: 300 },
  upload: { points: 30, durationSeconds: 300 },
} as const;
export * from './marca';
