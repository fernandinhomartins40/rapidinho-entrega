/**
 * Pedido por lista: o texto que o cliente escreve (ou dita) vira itens.
 *
 * O cliente não escreve como catálogo. Escreve "2 arroz 5kg, dipirona e uma
 * coca 2 litros", ou dita "meio quilo de carne moída e duas cervejas". Este
 * módulo separa os itens, tira a quantidade e o peso, e devolve as palavras
 * que a busca precisa casar com o nome do produto — sem acento, sem plural e
 * sem as palavras de ligação que nenhum produto tem no nome.
 *
 * Puro de propósito: nada de banco aqui, para ser testado linha a linha.
 */

export interface ItemDaLista {
  /** Como o cliente escreveu, para mostrar de volta. */
  original: string;
  /** Unidades pedidas. Para produto por peso, vale `gramas`. */
  quantidade: number;
  /** Peso pedido ("500 g", "meio quilo"), quando houver. */
  gramas: number | null;
  /** Palavras de busca: normalizadas, no singular, sem ligação. */
  palavras: string[];
  /** Números de embalagem ("5kg", "2l", "350ml") para desempatar produtos. */
  medidas: string[];
}

export const LIMITE_DE_ITENS_DA_LISTA = 20;

const NUMEROS_POR_EXTENSO: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  duzia: 12,
};

/** Palavras que nenhum nome de produto precisa ter para ser o certo. */
const PALAVRAS_DE_LIGACAO = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'com',
  'sem',
  'pra',
  'para',
  'por',
  'o',
  'a',
  'os',
  'as',
  'e',
  'em',
  'no',
  'na',
  'um',
  'uma',
  'uns',
  'umas',
  'quero',
  'preciso',
  'tambem',
  'mais',
  'pacote',
  'unidade',
  'un',
  'und',
  'x',
  'kg',
  'g',
  'quilo',
  'grama',
  'litro',
  'l',
  'ml',
  'meio',
  'meia',
]);

/** Minúsculas e sem acento: "Açúcar" e "acucar" são a mesma busca. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Singular simples do português, o bastante para a busca: "pães" → "pao",
 * "limões" → "limao", "ovos" → "ovo". Palavra curta fica como está ("gas").
 */
export function singular(palavra: string): string {
  if (palavra.length >= 4 && /(oes|aes)$/.test(palavra)) return `${palavra.slice(0, -3)}ao`;
  if (palavra.length > 4 && palavra.endsWith('ns')) return `${palavra.slice(0, -2)}m`;
  if (palavra.length > 3 && palavra.endsWith('s') && !palavra.endsWith('ss')) {
    return palavra.slice(0, -1);
  }
  return palavra;
}

function lerNumero(token: string): number | null {
  if (/^\d{1,2}$/.test(token)) return Number(token);
  return NUMEROS_POR_EXTENSO[token] ?? null;
}

/**
 * Quebra o texto em itens: uma linha, uma vírgula, um ponto e vírgula ou um
 * " e " separam. A vírgula decimal ("1,5 kg") não separa.
 */
function separarItens(texto: string): string[] {
  return texto
    .split(/\r?\n|;|,(?!\d)|\s+e\s+(?=\S)/i)
    .map((parte) => parte.replace(/^[\s\-•*·]+/, '').trim())
    .filter((parte) => parte.length > 0);
}

function lerItem(original: string): ItemDaLista | null {
  let texto = normalizarTexto(original)
    .replace(/[()"'!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let gramas: number | null = null;

  // "meio quilo", "meia duzia"
  if (/\bmeio (kg|quilo)\b/.test(texto)) {
    gramas = 500;
    texto = texto.replace(/\bmeio (kg|quilo)\b/, ' ');
  }

  let quantidade: number | null = null;
  if (/\bmeia duzia\b/.test(texto)) {
    quantidade = 6;
    texto = texto.replace(/\bmeia duzia\b/, ' ');
  }

  // Peso com número: "500g", "1,5 kg", "2 quilos". Guardado também como
  // medida — "arroz 5kg" é o tamanho do pacote, não um pedido a granel; quem
  // decide qual dos dois é o produto encontrado.
  const medidas: string[] = [];
  const peso = texto.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|quilos?|g|gramas?)\b/);
  if (peso && gramas == null) {
    const valor = Number(peso[1]!.replace(',', '.'));
    const emQuilos = /^(kg|quilo)/.test(peso[2]!);
    gramas = Math.round(emQuilos ? valor * 1000 : valor);
    medidas.push(`${peso[1]!.replace(',', '.')}${emQuilos ? 'kg' : 'g'}`);
    texto = texto.replace(peso[0], ' ');
  }

  // Volume: "2 litros", "2l", "350ml" — só serve para escolher a embalagem.
  const volume = texto.match(/\b(\d+(?:[.,]\d+)?)\s*(litros?|l|ml)\b/);
  if (volume) {
    const unidade = volume[2]!.startsWith('m') ? 'ml' : 'l';
    medidas.push(`${volume[1]!.replace(',', '.')}${unidade}`);
    texto = texto.replace(volume[0], ' ');
  }

  const tokens = texto.split(' ').filter(Boolean);

  // Quantidade: "2 arroz", "duas cocas", "arroz x2", "3x leite", "duzia de ovo".
  if (quantidade == null) {
    const primeiro = tokens[0];
    const vezes = primeiro?.match(/^(\d{1,2})x$/);
    if (vezes) {
      quantidade = Number(vezes[1]);
      tokens.shift();
    } else if (primeiro != null && lerNumero(primeiro) != null && tokens.length > 1) {
      quantidade = lerNumero(primeiro);
      tokens.shift();
      // "2 duzias de ovo" = 24
      if (tokens[0] === 'duzia' || tokens[0] === 'duzias') {
        quantidade = (quantidade ?? 1) * 12;
        tokens.shift();
      }
    } else if (primeiro === 'duzia') {
      quantidade = 12;
      tokens.shift();
    } else {
      const ultimo = tokens.at(-1)?.match(/^x(\d{1,2})$/);
      if (ultimo) {
        quantidade = Number(ultimo[1]);
        tokens.pop();
      }
    }
  }

  const palavras = [
    ...new Set(
      tokens
        .map((token) => token.replace(/[^a-z0-9-]/g, ''))
        .flatMap((token) => token.split('-'))
        .filter((token) => token.length >= 2 && !/^\d+$/.test(token))
        .filter((token) => !PALAVRAS_DE_LIGACAO.has(token))
        .map(singular),
    ),
  ];

  if (palavras.length === 0) return null;

  return {
    original: original.trim(),
    quantidade: Math.min(Math.max(quantidade ?? 1, 1), 99),
    gramas: gramas != null && gramas > 0 ? Math.min(gramas, 50_000) : null,
    palavras,
    medidas,
  };
}

/** Lê a lista inteira. Linhas sem nada buscável ("e", "obrigado") somem. */
export function interpretarLista(texto: string): ItemDaLista[] {
  return separarItens(texto.slice(0, 2000))
    .map(lerItem)
    .filter((item): item is ItemDaLista => item != null)
    .slice(0, LIMITE_DE_ITENS_DA_LISTA);
}

/**
 * Quão bem um nome de produto responde a um item da lista, de 0 a 1.
 *
 * A primeira palavra pesa mais: em português o núcleo vem primeiro ("arroz
 * integral", "pizza calabresa"), e um produto que casa "integral" mas não
 * "arroz" não é o que o cliente pediu. Sem ela, a nota é zero.
 */
export function notaDoProduto(item: ItemDaLista, nomeDoProduto: string): number {
  const nome = normalizarTexto(nomeDoProduto);
  const [nucleo, ...resto] = item.palavras;

  if (!nucleo || !nome.includes(nucleo)) return 0;

  const acertos = resto.filter((palavra) => nome.includes(palavra)).length;
  let nota = (1 + acertos) / item.palavras.length;

  // Embalagem pedida ("2l", "5kg") presente no nome: é o produto certo entre
  // vários parecidos.
  const compacto = nome.replace(/\s+/g, '').replace(',', '.');
  if (item.medidas.some((medida) => compacto.includes(medida))) nota += 0.25;

  return Math.min(nota, 1.25);
}
