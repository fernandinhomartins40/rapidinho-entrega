import type { OrderStatus } from '@rapidinho/shared';

/**
 * Forma do pedido na tela.
 *
 * Datas viajam como string: o limite entre Server e Client Component só
 * transporta JSON, e um `Date` chegaria do outro lado como string sem tipo.
 */

export interface ComplementoDoItem {
  id: string;
  optionName: string;
  quantity: number;
  priceCents: number;
}

export interface ItemDoPedido {
  id: string;
  productName: string;
  quantity: number;
  weightGrams: number | null;
  unitPriceCents: number;
  totalCents: number;
  notes: string | null;
  pizzaSizeName: string | null;
  pizzaExtraName: string | null;
  complements: ComplementoDoItem[];
  flavors: { id: string; flavorName: string }[];
}

export interface PedidoNaTela {
  id: string;
  number: string;
  status: OrderStatus;
  type: 'DELIVERY' | 'PICKUP';
  customerName: string;
  customerPhone: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  createdAt: string;
  acceptedAt: string | null;
  estimatedPrepMinutes: number | null;
  estimatedReadyAt: string | null;
  cancelReason: string | null;
  addressSnapshot: unknown;
  payment: {
    method: string;
    status: string;
    changeForCents: number | null;
  } | null;
  items: ItemDoPedido[];
}

/** Endereço guardado como snapshot no pedido, já em formato de exibição. */
export interface EnderecoDoPedido {
  street?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  referencePoint?: string;
  zipCode?: string;
}

export function lerEndereco(snapshot: unknown): EnderecoDoPedido | null {
  if (snapshot == null || typeof snapshot !== 'object') return null;
  return snapshot as EnderecoDoPedido;
}

/** "Rua X, 42 — Centro" a partir do que existir; o interior costuma ter menos. */
export function formatarEndereco(endereco: EnderecoDoPedido): string {
  const rua = [endereco.street, endereco.number].filter(Boolean).join(', ');
  return [rua, endereco.neighborhood].filter(Boolean).join(' — ');
}
