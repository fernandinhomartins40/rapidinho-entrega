/** Formas trocadas entre o montador (cliente) e as ações do pedido por lista. */

export interface ProdutoSugerido {
  id: string;
  nome: string;
  precoCents: number;
  porPeso: boolean;
  /** Peso já ajustado ao passo e ao mínimo da loja (só produto por peso). */
  gramas: number | null;
  /** Pizza ou produto com escolha obrigatória: não dá para pôr direto. */
  precisaEscolher: boolean;
  imagem: string | null;
}

export interface LojaSugerida {
  id: string;
  nome: string;
  slug: string;
  imagem: string | null;
  tempoMin: number;
  taxaCents: number;
  taxaGratis: boolean;
  minimoCents: number;
  nota: number;
  avaliacoes: number;
  /** Candidatos por item da lista (índice), do mais provável ao menos. */
  produtos: Record<number, ProdutoSugerido[]>;
}

export interface ItemPedido {
  indice: number;
  original: string;
  quantidade: number;
}

export interface PedidoMontado {
  itens: ItemPedido[];
  lojas: LojaSugerida[];
  /** Melhor combinação: item → loja. */
  plano: Record<number, string>;
  /** Não achados em loja nenhuma da cidade. */
  naoEncontrados: number[];
  /** Achados só em loja fechada agora. */
  soEmFechadas: number[];
}

export type RespostaDaMontagem =
  { ok: true; pedido: PedidoMontado } | { ok: false; message: string };

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
