import type { OrderStatus } from '@rapidinho/shared';

/**
 * Apresentação de pedidos no painel da plataforma.
 *
 * O servidor roda em UTC; sem fixar o fuso, um pedido das 20h apareceria
 * como 23h — e o dono conferindo uma reclamação procuraria no horário errado.
 */
const FUSO = 'America/Sao_Paulo';

export function dataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hora(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
}

/** "há 12 min", "há 3 h", "há 2 dias". */
export function tempoDecorrido(desde: Date, agora = new Date()): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - desde.getTime()) / 60_000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

/** Status que ainda pedem ação de alguém. */
export const STATUS_EM_ANDAMENTO: OrderStatus[] = [
  'PENDING_PAYMENT',
  'RECEIVED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
];

/**
 * Folga além do preparo previsto antes de o pedido contar como atrasado:
 * cobre a entrega, que em cidade pequena raramente passa de meia hora.
 */
export const FOLGA_DE_ATRASO_MIN = 30;

/** Preparo assumido quando a loja não informou o dela. */
export const PREPARO_PADRAO_MIN = 30;

export function estaAtrasado(pedido: {
  /** Texto, e não `OrderStatus`: o enum do Prisma chega como string. */
  status: string;
  createdAt: Date;
  estimatedPrepMinutes: number | null;
}): boolean {
  if (!STATUS_EM_ANDAMENTO.includes(pedido.status as OrderStatus)) return false;
  const limite = (pedido.estimatedPrepMinutes ?? PREPARO_PADRAO_MIN) + FOLGA_DE_ATRASO_MIN;
  return Date.now() - pedido.createdAt.getTime() > limite * 60_000;
}

export const VARIANTE_DO_STATUS: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'
> = {
  PENDING_PAYMENT: 'outline',
  RECEIVED: 'warning',
  ACCEPTED: 'secondary',
  PREPARING: 'secondary',
  READY: 'secondary',
  OUT_FOR_DELIVERY: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  REJECTED: 'destructive',
};
