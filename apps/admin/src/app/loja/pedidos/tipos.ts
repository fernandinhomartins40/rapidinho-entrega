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
  /** Borda, massa e adicionais da pizza. */
  pizzaExtras: { id: string; name: string; kind: string }[];
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
  /** Nenhum pedido entregue antes por esta loja para este cliente. */
  primeiroPedido: boolean;
  /** Mercado: o que fazer se um item faltar. */
  substitutionPolicy: 'SUBSTITUTE_SIMILAR' | 'CONTACT_ME' | 'REMOVE_ITEM' | null;
  /** Pedido com item +18: o entregador confere o documento. */
  ageConfirmedAt: string | null;
  /** Foto da receita (link assinado e temporário). */
  receitaUrl: string | null;
}

export const POLITICA_DE_SUBSTITUICAO: Record<
  NonNullable<PedidoNaTela['substitutionPolicy']>,
  string
> = {
  CONTACT_ME: 'Se faltar item: chamar o cliente no WhatsApp antes de trocar',
  SUBSTITUTE_SIMILAR: 'Se faltar item: pode trocar por similar',
  REMOVE_ITEM: 'Se faltar item: tirar e mandar o resto',
};

/** Borda, massa e adicionais numa linha, na ordem em que a cozinha monta. */
export function extrasDaPizza(extras: { name: string; kind: string }[]): string | null {
  if (extras.length === 0) return null;
  const ordem = (tipo: string) => (tipo === 'CRUST' ? 0 : tipo === 'EDGE' ? 1 : 2);
  return [...extras]
    .sort((a, b) => ordem(a.kind) - ordem(b.kind))
    .map((extra) => extra.name)
    .join(' · ');
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
