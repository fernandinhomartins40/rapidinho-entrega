/**
 * Os seis atalhos da tela inicial do app, com a arte da landing.
 *
 * O cliente pensa em "restaurante" ou "mercado", não em "hamburgueria" ou
 * "mercearia" — cada atalho junta as categorias do banco que respondem a essa
 * pergunta. "Outros" é o que sobra, para nenhuma loja ficar sem porta.
 */
export const GRUPOS_DE_CATEGORIA = [
  {
    chave: 'restaurantes',
    nome: 'Restaurantes',
    imagem: 'categorias/restaurantes.webp',
    slugs: ['restaurante', 'hamburgueria', 'lanchonete', 'pizzaria', 'acai-e-sorvetes'],
  },
  {
    chave: 'mercado',
    nome: 'Mercado',
    imagem: 'categorias/mercado.webp',
    slugs: ['supermercado', 'mercearia', 'acougue'],
  },
  {
    chave: 'farmacia',
    nome: 'Farmácia',
    imagem: 'categorias/farmacia.webp',
    slugs: ['farmacia'],
  },
  {
    chave: 'bebidas',
    nome: 'Bebidas',
    imagem: 'categorias/bebidas.webp',
    slugs: ['bebidas', 'adega', 'agua-e-gas'],
  },
  {
    chave: 'pet-shop',
    nome: 'Pet Shop',
    imagem: 'categorias/pet-shop.webp',
    slugs: ['petshop', 'pet-shop'],
  },
  { chave: 'outros', nome: 'Outros', imagem: 'categorias/outros.webp', slugs: [] },
] as const;

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
