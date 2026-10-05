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
  /** Produto do cardápio (null se foi excluído depois do pedido). */
  productId: string | null;
  productName: string;
  quantity: number;
  weightGrams: number | null;
  unitPriceCents: number;
  totalCents: number;
  notes: string | null;
  pizzaSizeName: string | null;
  pizzaExtraName: string | null;
  complements: ComplementoDoItem[];
  /** `flavorId` null: o sabor foi apagado do cardápio depois do pedido. */
  flavors: { id: string; flavorName: string; flavorId: string | null }[];
  /** Borda, massa e adicionais da pizza. */
  pizzaExtras: { id: string; name: string; kind: string }[];
  // Separação (pesagem justa)
  pickStatus: 'PICKED' | 'MISSING' | 'REPLACED' | 'AWAITING_CUSTOMER' | null;
  pickedWeightGrams: number | null;
  replacementName: string | null;
  replacementPriceCents: number | null;
  replacementAccepted: boolean | null;
  questionAskedAt: string | null;
  /** Valor do checkout, quando a separação mudou o valor do item. */
  estimatedTotalCents: number | null;
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
  surchargeCents: number;
  totalCents: number;
  /** Total do checkout, quando a separação mudou o total. */
  estimatedTotalCents: number | null;
  /** Quando a separação foi concluída. */
  pickedAt: string | null;
  /** Este pedido passa pela separação (mercado, farmácia, item por peso). */
  separa: boolean;
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
    provider: string;
    changeForCents: number | null;
    amountCents: number;
    refundedCents: number;
    failReason: string | null;
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
  /** Corrida do pedido: existe a partir de "Pronto", em pedido de entrega. */
  entrega: {
    status:
      'PENDING' | 'ASSIGNED' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED' | 'REFUSED';
    entregador: { nome: string; telefone: string | null } | null;
  } | null;
}

export const POLITICA_DE_SUBSTITUICAO: Record<
  NonNullable<PedidoNaTela['substitutionPolicy']>,
  string
> = {
  CONTACT_ME: 'Se faltar item: perguntar ao cliente pelo app antes de trocar',
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
