/** Formas trocadas entre o montador (cliente) e as ações do pedido por lista. */

export type {
  ItemPedido,
  LojaSugerida,
  PedidoMontado,
  ProdutoSugerido,
  RespostaDaMontagem,
} from '@rapidinho/services/regras/pedir';
import type { ProdutoSugerido } from '@rapidinho/services/regras/pedir';

export interface ItemParaOCarrinho {
  storeId: string;
  productId: string;
  quantidade: number;
  gramas: number | null;
}

/** Preço de uma linha: unidade × quantidade, ou quilo × peso. */
export function precoDaLinha(produto: ProdutoSugerido, quantidade: number): number {
  if (produto.porPeso) return Math.round((produto.precoCents * (produto.gramas ?? 0)) / 1000);
  return produto.precoCents * quantidade;
}
