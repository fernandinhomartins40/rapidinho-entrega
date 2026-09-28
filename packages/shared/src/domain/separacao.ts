import { percentOfCents } from '../utils/money';

/**
 * Pesagem justa: a separação de um pedido de mercado, açougue ou farmácia.
 *
 * O cliente pede "500 g de patinho", mas a peça nunca sai com 500 g certinho.
 * As regras abaixo são as mesmas no painel da loja (prévia ao vivo), no app do
 * cliente e no servidor que fecha a conta — por isso ficam aqui, puras e
 * testadas, em vez de repetidas em três lugares:
 *
 * - Item por peso é cobrado pelo peso real, com teto de +10% sobre o valor
 *   estimado no checkout. Veio mais pesado que isso, o excedente é cortesia
 *   da loja (e a tela avisa, para ela cortar certo). Veio mais leve, o
 *   cliente paga menos.
 * - Item em falta sai da conta. Troca por similar decidida pela loja nunca
 *   custa mais que o item original; troca que o cliente aceitou no app sai
 *   pelo preço que ele viu e aceitou.
 * - Pago online (Pix ou cartão): nada é cobrado a mais depois — o que passar
 *   do valor pago fica por conta da loja — e o que ficar abaixo é estornado.
 * - Pago na entrega: o entregador cobra o valor final.
 */

/** Quanto o peso real pode passar do pedido antes de virar cortesia da loja. */
export const TOLERANCIA_DE_PESO = 0.1;

/** Até quantos minutos a loja espera o cliente responder uma troca no app. */
export const MINUTOS_PARA_RESPOSTA_DE_TROCA = 5;

export type SituacaoDaSeparacao = 'PICKED' | 'MISSING' | 'REPLACED' | 'AWAITING_CUSTOMER';

export interface ItemDaSeparacao {
  /** Valor do item no checkout (o estimado). */
  totalCents: number;
  quantity: number;
  /** Peso pedido; null em item vendido por unidade. */
  weightGrams: number | null;
  pickStatus: SituacaoDaSeparacao | null;
  pickedWeightGrams: number | null;
  replacementPriceCents: number | null;
  /** true quando o próprio cliente aceitou a troca no app. */
  replacementAccepted: boolean | null;
}

export interface ValorDoItem {
  /** O que o cliente paga por este item. */
  finalCents: number;
  /** Quanto a loja deixou de cobrar (peso acima do teto, troca mais cara). */
  cortesiaCents: number;
}

/** Teto de cobrança de um item por peso: o estimado mais a tolerância. */
export function tetoDoItem(item: Pick<ItemDaSeparacao, 'totalCents'>): number {
  return Math.round(item.totalCents * (1 + TOLERANCIA_DE_PESO));
}

/** O valor de um item depois de separado, pela regra da pesagem justa. */
export function valorDoItemSeparado(item: ItemDaSeparacao): ValorDoItem {
  switch (item.pickStatus) {
    case 'MISSING':
      return { finalCents: 0, cortesiaCents: 0 };

    case 'REPLACED': {
      const preco = item.replacementPriceCents ?? item.totalCents;
      // O cliente viu o preço e aceitou: vale o que ele aceitou.
      if (item.replacementAccepted) return { finalCents: preco, cortesiaCents: 0 };
      const final = Math.min(preco, item.totalCents);
      return { finalCents: final, cortesiaCents: preco - final };
    }

    case 'PICKED': {
      if (item.weightGrams == null || item.pickedWeightGrams == null) {
        return { finalCents: item.totalCents, cortesiaCents: 0 };
      }
      // Proporcional ao valor do próprio item: o pedido guarda o preço da
      // porção escolhida (não o do quilo), então 600 g de um item pedido com
      // 500 g custam 600/500 do que ele custou no checkout.
      const real = Math.round((item.totalCents * item.pickedWeightGrams) / item.weightGrams);
      const final = Math.min(real, tetoDoItem(item));
      return { finalCents: final, cortesiaCents: real - final };
    }

    // Pendente (ou esperando o cliente): conta pelo estimado até decidir.
    default:
      return { finalCents: item.totalCents, cortesiaCents: 0 };
  }
}

export interface ContaDaSeparacao {
  itens: ValorDoItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  commissionCents: number;
  /** Pago online: quanto volta para o cliente. */
  estornoCents: number;
  /** Quanto a loja deixou de cobrar, somando itens e o teto do pago online. */
  cortesiaCents: number;
  /** Total final menos o total estimado (negativo = ficou mais barato). */
  diferencaCents: number;
}

export function fecharContaDaSeparacao(input: {
  itens: ItemDaSeparacao[];
  /** Total do checkout. */
  totalEstimadoCents: number;
  deliveryFeeCents: number;
  surchargeCents: number;
  discountCents: number;
  commissionRate: number;
  /** Valor já pago online; null quando o pagamento é na entrega. */
  pagoOnlineCents: number | null;
}): ContaDaSeparacao {
  const itens = input.itens.map(valorDoItemSeparado);
  let subtotalCents = itens.reduce((soma, item) => soma + item.finalCents, 0);
  let cortesiaCents = itens.reduce((soma, item) => soma + item.cortesiaCents, 0);

  // Desconto nunca maior que a compra: cupom de R$ 10 num pedido que ficou
  // em R$ 8 não vira crédito.
  const discountCents = Math.min(input.discountCents, subtotalCents);
  let totalCents = subtotalCents + input.deliveryFeeCents + input.surchargeCents - discountCents;

  let estornoCents = 0;
  if (input.pagoOnlineCents != null) {
    if (totalCents > input.pagoOnlineCents) {
      // Não há como cobrar de novo um Pix já pago: o excedente é da loja.
      const excedente = totalCents - input.pagoOnlineCents;
      cortesiaCents += excedente;
      subtotalCents -= excedente;
      totalCents = input.pagoOnlineCents;
    } else {
      estornoCents = input.pagoOnlineCents - totalCents;
    }
  }

  return {
    itens,
    subtotalCents,
    discountCents,
    totalCents,
    commissionCents: percentOfCents(subtotalCents, input.commissionRate),
    estornoCents,
    cortesiaCents,
    diferencaCents: totalCents - input.totalEstimadoCents,
  };
}

/** Faixa de peso sem cortesia: do que foi pedido até +10%. */
export function faixaDePeso(weightGrams: number): { minimo: number; maximo: number } {
  return {
    minimo: Math.round(weightGrams * (1 - TOLERANCIA_DE_PESO)),
    maximo: Math.round(weightGrams * (1 + TOLERANCIA_DE_PESO)),
  };
}

/** "0,520" / "520" / "0.52" → gramas. Aceita o jeito que a balança mostra. */
export function lerPesoDigitado(texto: string): number | null {
  const limpo = texto
    .trim()
    .toLowerCase()
    .replace(/\s*(kg|g)$/, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  const numero = Number(limpo);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  // Com vírgula/ponto ou até 50, é quilo ("0,52", "1.2", "2"); senão, grama.
  const gramas = limpo.includes('.') || numero <= 50 ? numero * 1000 : numero;
  const inteiro = Math.round(gramas);
  return inteiro > 0 && inteiro <= 50_000 ? inteiro : null;
}
