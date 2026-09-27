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
  | 'refeicao'
  | 'lanche'
  | 'pizza'
  | 'salgado'
  | 'porcao'
  | 'doce'
  | 'saudavel'
  | 'bebida'
  | 'prato'
  | 'mercado'
  | 'farmacia'
  | 'pet'
  | 'outros';

/** Nome do ícone (lucide) que desenha o prato. O app resolve o nome no ícone. */
export type IconeDoPrato =
  | 'Pizza'
  | 'Sandwich'
  | 'Salad'
  | 'Soup'
  | 'Beef'
  | 'Drumstick'
  | 'Fish'
  | 'IceCreamCone'
  | 'CakeSlice'
  | 'Cookie'
  | 'Candy'
  | 'Coffee'
  | 'CupSoda'
  | 'Citrus'
  | 'Croissant'
  | 'Utensils'
  | 'ChefHat'
  | 'Grape'
  | 'Carrot'
  | 'Wheat'
  | 'Milk'
  | 'Egg'
  | 'Apple'
  | 'Beer'
  | 'Wine'
  | 'SprayCan'
  | 'ShoppingBasket'
  | 'Pill'
  | 'Baby'
  | 'PawPrint'
  | 'Flame'
  | 'Droplet'
  | 'Package';

export interface ArteDoPrato {
  tipo: TipoDePrato;
  icone: IconeDoPrato;
  /** Tom do cartão quando não há foto: fundo pastel e cor do traço. */
  tom: { fundo: string; tinta: string };
  /** Porção, pizza, combo família: rende para mais de uma pessoa. */
  paraDividir: boolean;
}

/**
 * Tons por tipo: pastel no fundo e a cor forte só no traço do ícone. Cartão
 * de cor chapada com desenho grande parecia livro infantil; isto parece
 * cardápio.
 */
const TONS: Record<TipoDePrato, { fundo: string; tinta: string }> = {
  refeicao: { fundo: '#FFF1E6', tinta: '#C2410C' },
  lanche: { fundo: '#FFF6DB', tinta: '#B45309' },
  pizza: { fundo: '#FDECEC', tinta: '#B91C1C' },
  salgado: { fundo: '#FFF3DC', tinta: '#A16207' },
  porcao: { fundo: '#FEF7D6', tinta: '#A16207' },
  doce: { fundo: '#FCEBF3', tinta: '#BE185D' },
  saudavel: { fundo: '#E8F5EC', tinta: '#15803D' },
  bebida: { fundo: '#E7F3FB', tinta: '#0369A1' },
  prato: { fundo: '#F3F1EC', tinta: '#44403C' },
  mercado: { fundo: '#EEF4E6', tinta: '#3F6212' },
  farmacia: { fundo: '#E8F1FB', tinta: '#1D4ED8' },
  pet: { fundo: '#F3ECE6', tinta: '#7C4A21' },
  outros: { fundo: '#F1F0EE', tinta: '#44403C' },
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

/** Ícone mais específico primeiro; o do tipo é a sobra. */
const ICONES: Array<[RegExp, IconeDoPrato]> = [
  [/\bpizza/, 'Pizza'],
  [/\b(feijoada|escondidinho|strogonoff|estrogonofe|caldo|sopa)\b/, 'Soup'],
  [/\b(peixe|tilapia|sushi|temaki)\b/, 'Fish'],
  [/\b(lasanha|macarrao|espaguete|yakisoba|risoto)\b/, 'ChefHat'],
  // Frango antes de filé: "Filé de frango" é frango.
  [/\b(frango|coxinha|passarinho)\b/, 'Drumstick'],
  [/\b(bife|carne|picanha|costela|file)\b/, 'Beef'],
  [
    /\b(cachorro|hot dog|sanduiche|misto|beirute|wrap|burger|hamburguer|x-\w+|smash|combo)\b/,
    'Sandwich',
  ],
  [/\b(pastel|risole|enroladinho|esfiha|esfirra|empada|kibe|quibe|pao de queijo)\b/, 'Croissant'],
  [/\bmandioca\b/, 'Carrot'],
  [/\bacai\b/, 'Grape'],
  [/\b(sorvete|sundae|picole)\b/, 'IceCreamCone'],
  [/\bmilk-?shake\b/, 'CupSoda'],
  [/\b(bolo|torta|cheesecake|pudim)\b/, 'CakeSlice'],
  [/\bcookie\b/, 'Cookie'],
  [/\b(brigadeiro|chocolate|brownie|petit)\b/, 'Candy'],
  [/\b(salada|poke|bowl|veggie)\b/, 'Salad'],
  [/\b(suco|vitamina|limonada)\b/, 'Citrus'],
  [/\b(cafe|cappuccino)\b/, 'Coffee'],
];

const ICONE_DO_TIPO: Record<TipoDePrato, IconeDoPrato> = {
  refeicao: 'Utensils',
  lanche: 'Sandwich',
  pizza: 'Pizza',
  salgado: 'Croissant',
  porcao: 'Utensils',
  doce: 'CakeSlice',
  saudavel: 'Salad',
  bebida: 'CupSoda',
  prato: 'Utensils',
  mercado: 'ShoppingBasket',
  farmacia: 'Pill',
  pet: 'PawPrint',
  outros: 'Package',
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

  const icone = ehSaborDePizza
    ? 'Pizza'
    : (ICONES.find(([regra]) => regra.test(soNome))?.[1] ?? ICONE_DO_TIPO[tipo]);

  return {
    tipo,
    icone,
    tom: TONS[tipo],
    paraDividir: tipo === 'pizza' || PARA_DIVIDIR.test(soNome),
  };
}

/** Ícones de mercado, do mais específico ao mais geral. */
const ICONES_DE_MERCADO: Array<[RegExp, IconeDoPrato]> = [
  [/\b(cafe)\b/, 'Coffee'],
  [/\b(frango|asa|coxa|sobrecoxa|peito)\b/, 'Drumstick'],
  [/\b(carne|alcatra|picanha|patinho|acem|costela|linguica|bife|moida|file)\b/, 'Beef'],
  [/\b(peixe|tilapia|sardinha|atum)\b/, 'Fish'],
  [/\b(leite|iogurte|queijo|manteiga|requeijao|creme de leite)\b/, 'Milk'],
  [/\bovos?\b/, 'Egg'],
  [/\b(pao|paes|bisnaga|torrada)\b/, 'Croissant'],
  [
    /\b(banana|maca|laranja|limao|tomate|alface|cebola|batata|cenoura|fruta|verdura|legume|mamao|abacaxi)\b/,
    'Apple',
  ],
  [/\b(cerveja|chopp)\b/, 'Beer'],
  [/\bvinho\b/, 'Wine'],
  [/\b(refrigerante|refri|suco|agua mineral|guarana|coca)\b/, 'CupSoda'],
  [
    /\b(detergente|sabao|amaciante|desinfetante|agua sanitaria|limpador|esponja|saco de lixo|papel higienico)\b/,
    'SprayCan',
  ],
  [/\b(arroz|feijao|macarrao|farinha|acucar|oleo|sal|fuba|aveia|biscoito)\b/, 'Wheat'],
  [/\b(chocolate|bala|doce|bombom)\b/, 'Candy'],
];

/**
 * Arte de um produto qualquer da loja, conforme o segmento: prato de
 * restaurante usa `classificarPrato`; mercado, farmácia, pet e gás ganham os
 * ícones deles, para a faixa de produtos do cartão da loja não mostrar um
 * garfo e faca num pacote de arroz.
 */
export function arteDoProduto(
  nome: string,
  segmento: 'RESTAURANT' | 'MARKET' | 'PHARMACY' | 'OTHER' | string,
  categoria?: string | null,
): ArteDoPrato {
  if (segmento === 'RESTAURANT') return classificarPrato(nome, categoria);

  const texto = normalizarTexto(`${nome} ${categoria ?? ''}`);
  const base = { paraDividir: false };

  if (segmento === 'MARKET') {
    const icone = ICONES_DE_MERCADO.find(([regra]) => regra.test(texto))?.[1] ?? 'ShoppingBasket';
    return { ...base, tipo: 'mercado', icone, tom: TONS.mercado };
  }
  if (segmento === 'PHARMACY') {
    const icone: IconeDoPrato = /\b(fralda|bebe|infantil|mamadeira)\b/.test(texto)
      ? 'Baby'
      : 'Pill';
    return { ...base, tipo: 'farmacia', icone, tom: TONS.farmacia };
  }
  if (/\b(racao|pet|cachorro|gato|areia|petisco|coleira)\b/.test(texto)) {
    return { ...base, tipo: 'pet', icone: 'PawPrint', tom: TONS.pet };
  }
  if (/\b(gas|botijao|p13)\b/.test(texto)) {
    return { ...base, tipo: 'outros', icone: 'Flame', tom: TONS.outros };
  }
  if (/\b(agua|galao)\b/.test(texto)) {
    return { ...base, tipo: 'outros', icone: 'Droplet', tom: TONS.bebida };
  }
  return { ...base, tipo: 'outros', icone: 'Package', tom: TONS.outros };
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
  { id: 'tanto-faz', rotulo: 'Tanto faz' },
  { id: 'fome', rotulo: 'Matar a fome' },
  { id: 'rapido', rotulo: 'Chega rápido' },
  { id: 'barato', rotulo: 'Até R$ 25' },
  { id: 'doce', rotulo: 'Doce' },
  { id: 'dividir', rotulo: 'Pra dividir' },
  { id: 'leve', rotulo: 'Algo leve' },
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
