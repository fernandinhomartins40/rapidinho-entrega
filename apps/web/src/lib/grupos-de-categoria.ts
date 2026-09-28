/**
 * Os nichos do app: os seis atalhos da tela inicial (com a arte da landing) e
 * as seções em que a vitrine se divide.
 *
 * O cliente pensa em "restaurante" ou "mercado", não em "hamburgueria" ou
 * "mercearia" — cada nicho junta as categorias do banco que respondem a essa
 * pergunta. "Outros" é o que sobra, para nenhuma loja ficar sem porta.
 *
 * Cada nicho tem uma cor — tons sóbrios, não de brinquedo — usada como
 * assinatura: o ícone da seção, o monograma e o rótulo da loja. Bater o olho
 * e saber que aquilo é farmácia, e não mercado, sem ler. O `icone` (lucide) é
 * o atalho do app; a `imagem` ilustrada fica para a landing.
 */
export const GRUPOS_DE_CATEGORIA = [
  {
    chave: 'restaurantes',
    nome: 'Restaurantes',
    titulo: 'Restaurantes e lanches',
    imagem: 'categorias/restaurantes.webp',
    icone: 'restaurantes',
    cor: '#C2410C',
    fundo: '#FBEFE7',
    slugs: ['restaurante', 'hamburgueria', 'lanchonete', 'pizzaria', 'acai-e-sorvetes'],
  },
  {
    chave: 'mercado',
    nome: 'Mercado',
    titulo: 'Mercados',
    imagem: 'categorias/mercado.webp',
    icone: 'mercado',
    cor: '#2F7A4B',
    fundo: '#EAF3ED',
    slugs: ['supermercado', 'mercearia', 'acougue'],
  },
  {
    chave: 'farmacia',
    nome: 'Farmácia',
    titulo: 'Farmácias',
    imagem: 'categorias/farmacia.webp',
    icone: 'farmacia',
    cor: '#2554C7',
    fundo: '#EAEFFA',
    slugs: ['farmacia'],
  },
  {
    chave: 'bebidas',
    nome: 'Bebidas',
    titulo: 'Bebidas, água e gás',
    imagem: 'categorias/bebidas.webp',
    icone: 'bebidas',
    cor: '#6B3FA0',
    fundo: '#F0ECF6',
    slugs: ['bebidas', 'adega', 'agua-e-gas'],
  },
  {
    chave: 'pet-shop',
    nome: 'Pet Shop',
    titulo: 'Pet shop',
    imagem: 'categorias/pet-shop.webp',
    icone: 'pet-shop',
    cor: '#8A5A12',
    fundo: '#F5EFE4',
    slugs: ['petshop', 'pet-shop'],
  },
  {
    chave: 'outros',
    nome: 'Outros',
    titulo: 'Outras lojas',
    imagem: 'categorias/outros.webp',
    icone: 'outros',
    cor: '#52525B',
    fundo: '#EFEFF0',
    slugs: [],
  },
] as const;

export type GrupoDeCategoria = (typeof GRUPOS_DE_CATEGORIA)[number];

const SLUGS_COM_GRUPO = new Set<string>(GRUPOS_DE_CATEGORIA.flatMap((grupo) => grupo.slugs));

/** A loja pertence ao atalho? Loja sem categoria cai em "Outros". */
export function pertenceAoGrupo(chave: string, categoriaSlug: string | null): boolean {
  if (chave === 'outros') return categoriaSlug == null || !SLUGS_COM_GRUPO.has(categoriaSlug);

  const grupo = GRUPOS_DE_CATEGORIA.find((candidato) => candidato.chave === chave);
  return (
    grupo != null &&
    categoriaSlug != null &&
    (grupo.slugs as readonly string[]).includes(categoriaSlug)
  );
}

/** O nicho de uma loja pela categoria dela. */
export function grupoDaLoja(categoriaSlug: string | null): GrupoDeCategoria {
  return (
    GRUPOS_DE_CATEGORIA.find(
      (grupo) =>
        grupo.chave !== 'outros' &&
        categoriaSlug != null &&
        (grupo.slugs as readonly string[]).includes(categoriaSlug),
    ) ?? GRUPOS_DE_CATEGORIA[GRUPOS_DE_CATEGORIA.length - 1]!
  );
}
