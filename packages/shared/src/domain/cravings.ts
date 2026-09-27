/**
 * "Tô com fome" — descoberta de pratos para quem não sabe o que quer.
 *
 * Módulo puro: classifica o prato pelo nome (tipo, arte, se é pra dividir),
 * define as vontades que filtram o baralho e ordena o próximo cartão pelo que
 * a pessoa já curtiu ou descartou. Nada de banco aqui, para ser testado
 * cartão a cartão.
 */

import { normalizarTexto } from './shopping-list';

export type TipoDePrato =
  'refeicao' | 'lanche' | 'pizza' | 'salgado' | 'porcao' | 'doce' | 'saudavel' | 'bebida' | 'prato';

export interface ArteDoPrato {
  tipo: TipoDePrato;
  emoji: string;
  /** Degradê do cartão quando não há foto: [de, para]. */
  fundo: [string, string];
  /** Porção, pizza, combo família: rende para mais de uma pessoa. */
  paraDividir: boolean;
}

const FUNDOS: Record<TipoDePrato, [string, string]> = {
  refeicao: ['#ff8a00', '#c2410c'],
  lanche: ['#ffb900', '#d97706'],
  pizza: ['#ef4444', '#991b1b'],
  salgado: ['#f59e0b', '#b45309'],
  porcao: ['#facc15', '#ca8a04'],
  doce: ['#ec4899', '#9d174d'],
  saudavel: ['#22c55e', '#15803d'],
  bebida: ['#38bdf8', '#0369a1'],
  prato: ['#f97316', '#9a3412'],
};

/** Regras em ordem: a primeira que casa decide o tipo. */
const TIPOS: Array<[TipoDePrato, RegExp]> = [
  [
    'bebida',
    /\b(refrigerante|refri|agua|suco|cafe|cappuccino|cha|cerveja|chopp|vitamina|energetico|chocolate quente|limonada|guarana|coca)\b/,
  ],
  [
    'doce',
    /\b(acai|sorvete|picole|sundae|milk-?shake|brigadeiro|bolo|pudim|petit|brownie|mousse|pave|churros|cookie|doce|torta de limao|torta doce|cheesecake|chocolate)\b/,
  ],
  ['pizza', /\bpizza/],
  [
    'saudavel',
    /\b(fitness|fit|salada|natural|grelhad[oa]|integral|veggie|vegan[oa]?|light|poke|bowl)\b/,
  ],
  ['porcao', /\b(porcao|fritas|batata|mandioca|onion|isca|passarinho|petisco|tabua)\b/],
  [
    'salgado',
    /\b(coxinha|risole|pastel|enroladinho|esfiha|esfirra|pao de queijo|empada|kibe|quibe|salgad|croissant)\b/,
  ],
  [
    'lanche',
    /\b(burger|hamburguer|x-\w+|smash|sanduiche|lanche|cachorro-quente|cachorro|hot dog|beirute|wrap|combo|misto)\b/,
  ],
  [
    'refeicao',
    /\b(marmita|marmitex|prato|feijoada|bife|file|parmegiana|strogonoff|estrogonofe|lasanha|macarrao|espaguete|arroz|executivo|frango|peixe|tilapia|costela|picanha|carne|yakisoba|sushi|temaki|risoto|escondidinho)\b/,
  ],
];

/** Emoji mais específico primeiro; o do tipo é a sobra. */
const EMOJIS: Array<[RegExp, string]> = [
  [/\bpizza/, '🍕'],
  [/\b(marmita|marmitex|executivo)\b/, '🍱'],
  [/\b(feijoada|escondidinho|strogonoff|estrogonofe)\b/, '🍲'],
  [/\b(peixe|tilapia)\b/, '🐟'],
  [/\b(sushi|temaki)\b/, '🍣'],
  [/\b(lasanha|macarrao|espaguete|yakisoba)\b/, '🍝'],
  // Frango antes de filé: "Filé de frango" é frango.
  [/\b(frango|coxinha|passarinho)\b/, '🍗'],
  [/\b(bife|carne|picanha|costela|file)\b/, '🥩'],
  [/\b(cachorro|hot dog)\b/, '🌭'],
  [/\b(sanduiche|misto|beirute|wrap)\b/, '🥪'],
  [/\b(burger|hamburguer|x-\w+|smash|combo)\b/, '🍔'],
  [/\b(pastel|risole|enroladinho|esfiha|esfirra|empada|kibe|quibe)\b/, '🥟'],
  [/\bpao de queijo\b/, '🧀'],
  [/\b(fritas|batata)\b/, '🍟'],
  [/\bonion\b/, '🧅'],
  [/\bmandioca\b/, '🍠'],
  [/\bacai\b/, '🍇'],
  [/\b(sorvete|sundae|picole)\b/, '🍨'],
  [/\bmilk-?shake\b/, '🥤'],
  [/\b(bolo|torta|cheesecake|pudim)\b/, '🍰'],
  [/\b(brigadeiro|chocolate|brownie|petit)\b/, '🍫'],
  [/\b(salada|poke|bowl|veggie)\b/, '🥗'],
  [/\b(suco|vitamina|limonada)\b/, '🧃'],
  [/\b(cafe|cappuccino)\b/, '☕'],
];

const EMOJI_DO_TIPO: Record<TipoDePrato, string> = {
  refeicao: '🍛',
  lanche: '🍔',
  pizza: '🍕',
  salgado: '🥟',
  porcao: '🍟',
  doce: '🍰',
  saudavel: '🥗',
  bebida: '🥤',
  prato: '🍽️',
};

const PARA_DIVIDIR =
  /\b(porcao|familia|balde|tabua|1 ?l|1,5 ?l|2 ?l|combo familia|gigante|meio a meio)\b/;

/**
 * Tipo, arte e porção de um prato a partir do nome (e, se houver, da
 * categoria do cardápio). `sabor de pizza` é sempre pizza.
 */
export function classificarPrato(
  nome: string,
  categoria?: string | null,
  ehSaborDePizza = false,
): ArteDoPrato {
  const texto = normalizarTexto(`${nome} ${categoria ?? ''}`);
  const soNome = normalizarTexto(nome);

  const tipo: TipoDePrato = ehSaborDePizza
    ? 'pizza'
    : (TIPOS.find(([, regra]) => regra.test(soNome))?.[0] ??
      TIPOS.find(([, regra]) => regra.test(texto))?.[0] ??
      'prato');

  const emoji = ehSaborDePizza
    ? '🍕'
    : (EMOJIS.find(([regra]) => regra.test(soNome))?.[1] ?? EMOJI_DO_TIPO[tipo]);

  return {
    tipo,
    emoji,
    fundo: FUNDOS[tipo],
    paraDividir: tipo === 'pizza' || PARA_DIVIDIR.test(soNome),
  };
}

/* ------------------------------------------------------------------------ */
/* Vontades                                                                  */
/* ------------------------------------------------------------------------ */

export interface PratoDoBaralho {
  chave: string;
  tipo: TipoDePrato;
  precoCents: number;
  tempoMin: number;
  paraDividir: boolean;
  lojaId: string;
  /** 0 a 1: quão pedido é neste horário na cidade. */
  popularidade: number;
}

export const VONTADES = [
  { id: 'tanto-faz', rotulo: 'Tanto faz', emoji: '🤷' },
  { id: 'fome', rotulo: 'Matar a fome', emoji: '🍽️' },
  { id: 'rapido', rotulo: 'Chega rápido', emoji: '⚡' },
  { id: 'barato', rotulo: 'Até R$ 25', emoji: '💸' },
  { id: 'doce', rotulo: 'Doce', emoji: '🍫' },
  { id: 'dividir', rotulo: 'Pra dividir', emoji: '👥' },
  { id: 'leve', rotulo: 'Algo leve', emoji: '🥗' },
] as const;

export type Vontade = (typeof VONTADES)[number]['id'];

export function combinaComAVontade(prato: PratoDoBaralho, vontade: Vontade): boolean {
  switch (vontade) {
    case 'fome':
      return ['refeicao', 'lanche', 'pizza', 'prato'].includes(prato.tipo);
    case 'rapido':
      return prato.tempoMin <= 40;
    case 'barato':
      return prato.precoCents <= 2500;
    case 'doce':
      return prato.tipo === 'doce';
    case 'dividir':
      return prato.paraDividir;
    case 'leve':
      return prato.tipo === 'saudavel';
    default:
      return true;
  }
}

/* ------------------------------------------------------------------------ */
/* Baralho que aprende                                                       */
/* ------------------------------------------------------------------------ */

/** Quantos "quero" encerram a rodada: três finalistas, nunca uma lista. */
export const CURTIDAS_PARA_DECIDIR = 3;

export interface Historico {
  curtidos: PratoDoBaralho[];
  descartados: PratoDoBaralho[];
}

/**
 * Nota do próximo cartão, dado o que a pessoa já fez.
 *
 * - Popularidade no horário é a base: sem nenhum sinal, o mais pedido agora.
 * - Tipo curtido sobe; tipo descartado duas vezes desce (uma vez é acaso).
 * - Faixa de preço dos curtidos pesa: quem curtiu marmita de R$ 25 não quer
 *   ver combo de R$ 100.
 * - A mesma loja do cartão anterior desce um pouco, para o baralho variar.
 */
export function notaDoCartao(
  prato: PratoDoBaralho,
  historico: Historico,
  anterior?: PratoDoBaralho,
): number {
  let nota = prato.popularidade;

  const tiposCurtidos = historico.curtidos.map((curtido) => curtido.tipo);
  if (tiposCurtidos.includes(prato.tipo)) nota += 0.6;

  const vezesDescartado = historico.descartados.filter(
    (descartado) => descartado.tipo === prato.tipo,
  ).length;
  if (vezesDescartado >= 2) nota -= 0.5 * (vezesDescartado - 1);

  if (historico.curtidos.length > 0) {
    const media =
      historico.curtidos.reduce((soma, curtido) => soma + curtido.precoCents, 0) /
      historico.curtidos.length;
    const distancia = Math.abs(prato.precoCents - media) / Math.max(media, 1);
    nota -= Math.min(distancia, 1) * 0.3;
  }

  if (anterior && anterior.lojaId === prato.lojaId) nota -= 0.25;

  return nota;
}

/** O próximo cartão entre os que faltam, ou `null` se acabou. */
export function proximoCartao<T extends PratoDoBaralho>(
  restantes: T[],
  historico: Historico,
  anterior?: PratoDoBaralho,
): T | null {
  let melhor: T | null = null;
  let melhorNota = -Infinity;
  for (const prato of restantes) {
    const nota = notaDoCartao(prato, historico, anterior);
    if (nota > melhorNota) {
      melhor = prato;
      melhorNota = nota;
    }
  }
  return melhor;
}
