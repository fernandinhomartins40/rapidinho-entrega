/**
 * Máquina de estados do pedido. A UI (cliente, lojista, entregador) e a API
 * usam esta mesma tabela — mudança de status inválida não deve existir em
 * lugar nenhum do sistema.
 */

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function isFinalStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Pedido que ainda exige ação de alguém (aparece na tela do lojista). */
export function isActiveStatus(status: OrderStatus): boolean {
  return !isFinalStatus(status);
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Aguardando pagamento',
  RECEIVED: 'Pedido recebido',
  ACCEPTED: 'Pedido aceito',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  REJECTED: 'Recusado pela loja',
};

/** Texto voltado ao cliente na tela de acompanhamento. */
export const ORDER_STATUS_CUSTOMER_MESSAGE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Estamos aguardando a confirmação do seu pagamento.',
  RECEIVED: 'A loja recebeu seu pedido e vai confirmar em instantes.',
  ACCEPTED: 'A loja aceitou seu pedido!',
  PREPARING: 'Seu pedido está sendo preparado.',
  READY: 'Seu pedido está pronto.',
  OUT_FOR_DELIVERY: 'Seu pedido saiu para entrega.',
  DELIVERED: 'Pedido entregue. Bom apetite!',
  CANCELLED: 'Este pedido foi cancelado.',
  REJECTED: 'A loja não pôde aceitar este pedido.',
};

/**
 * Aviso (push/WhatsApp) que o cliente recebe quando o pedido muda de status.
 *
 * Loja e entregador avançam o mesmo pedido; os dois avisos saem daqui para o
 * cliente não receber textos diferentes conforme quem tocou no botão. O de
 * "entregue" já abre a avaliação: é quando a experiência está fresca, e o
 * botão de avaliar ficava escondido no fim do acompanhamento.
 */
export function avisoDeStatusAoCliente(
  orderId: string,
  status: OrderStatus,
): { body: string; url: string } {
  if (status === 'DELIVERED') {
    return {
      body: `${ORDER_STATUS_CUSTOMER_MESSAGE.DELIVERED} Conta pra gente como foi?`,
      url: `/pedidos/${orderId}/avaliar`,
    };
  }

  return { body: ORDER_STATUS_CUSTOMER_MESSAGE[status], url: `/pedidos/${orderId}` };
}

/** Etapas exibidas na linha do tempo do acompanhamento (pedido de entrega). */
export const ORDER_TIMELINE: readonly OrderStatus[] = [
  'RECEIVED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export function timelineIndex(status: OrderStatus): number {
  return ORDER_TIMELINE.indexOf(status);
}
