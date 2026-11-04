import type { ChaveDaCategoria } from './tokens';

/** O que o require de uma imagem do pacote devolve. */
export type Icone3d = number;

/** Ícones 3D da marca (256 px, fundo transparente). */
export const icones3d = {
  tudo: require('@/assets/icones/abas/tudo.png'),
  restaurantes: require('@/assets/icones/abas/restaurantes.png'),
  mercados: require('@/assets/icones/abas/mercados.png'),
  farmacias: require('@/assets/icones/abas/farmacias.png'),
  outros: require('@/assets/icones/abas/outros.png'),
  pedirPorLista: require('@/assets/icones/atalhos/pedir-por-lista.png'),
  entregaGratis: require('@/assets/icones/atalhos/entrega-gratis.png'),
  cupom: require('@/assets/icones/atalhos/cupom.png'),
} satisfies Record<string, Icone3d>;

const CATEGORIAS = {
  'acai-e-sorvetes': require('@/assets/icones/categorias/acai-e-sorvetes.png'),
  acougue: require('@/assets/icones/categorias/acougue.png'),
  'agua-e-gas': require('@/assets/icones/categorias/agua-e-gas.png'),
  bebidas: require('@/assets/icones/categorias/bebidas.png'),
  doces: require('@/assets/icones/categorias/doces.png'),
  farmacia: require('@/assets/icones/categorias/farmacia.png'),
  hamburgueria: require('@/assets/icones/categorias/hamburgueria.png'),
  hortifruti: require('@/assets/icones/categorias/hortifruti.png'),
  japonesa: require('@/assets/icones/categorias/japonesa.png'),
  lanchonete: require('@/assets/icones/categorias/lanchonete.png'),
  marmitas: require('@/assets/icones/categorias/marmitas.png'),
  mercearia: require('@/assets/icones/categorias/mercearia.png'),
  padaria: require('@/assets/icones/categorias/padaria.png'),
  petshop: require('@/assets/icones/categorias/petshop.png'),
  pizzaria: require('@/assets/icones/categorias/pizzaria.png'),
  porcoes: require('@/assets/icones/categorias/porcoes.png'),
  restaurante: require('@/assets/icones/categorias/restaurante.png'),
  supermercado: require('@/assets/icones/categorias/supermercado.png'),
} satisfies Record<string, Icone3d>;

type Categoria = keyof typeof CATEGORIAS;

/**
 * As categorias são editáveis no painel; o slug é reconhecido por trechos,
 * na ordem: o mais específico antes do mais genérico.
 */
const TRECHOS: [RegExp, Categoria][] = [
  [/acai|sorvete|gelato/, 'acai-e-sorvetes'],
  [/acougue|carne|churrasc/, 'acougue'],
  [/gas|agua/, 'agua-e-gas'],
  [/bebida|adega|cerveja/, 'bebidas'],
  [/doce|confeit|bolo|brigadeir/, 'doces'],
  [/hortifruti|verdur|fruta|sacolao/, 'hortifruti'],
  [/japones|sushi|oriental|asiatic/, 'japonesa'],
  [/hamburguer|burger/, 'hamburgueria'],
  [/pizza/, 'pizzaria'],
  [/lanche|hot-dog|cachorro|pastel/, 'lanchonete'],
  [/marmit|quentinha/, 'marmitas'],
  [/porcao|porcoes|petisco|frango/, 'porcoes'],
  [/padaria|panificadora/, 'padaria'],
  [/pet|racao|agro/, 'petshop'],
  [/farmacia|drogaria/, 'farmacia'],
  [/supermercado|mercado/, 'supermercado'],
  [/mercearia|conveniencia|emporio/, 'mercearia'],
  [/restaurante|comida|prato/, 'restaurante'],
];

const DA_FAMILIA: Record<ChaveDaCategoria, Icone3d> = {
  comida: icones3d.restaurantes,
  mercado: icones3d.mercados,
  farmacia: icones3d.farmacias,
  bebidas: CATEGORIAS.bebidas,
  pet: CATEGORIAS.petshop,
  casa: CATEGORIAS['agua-e-gas'],
  outros: icones3d.outros,
};

/** Ícone 3D da categoria; sem trecho reconhecido, o da família. */
export function icone3dDaCategoria(
  slug: string | null | undefined,
  familia: ChaveDaCategoria,
): Icone3d {
  const nome = slug ?? '';
  const achado = TRECHOS.find(([trecho]) => trecho.test(nome));
  return achado ? CATEGORIAS[achado[1]] : DA_FAMILIA[familia];
}

export const icone3dDaFamilia = (familia: ChaveDaCategoria) => DA_FAMILIA[familia];
