import { prisma } from '@rapidinho/database';
import { arteDoProduto, classificarPrato, type ArteDoPrato } from '@rapidinho/shared';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { saborDisponivelAgora } from '@/lib/sabores';

/**
 * Os produtos que aparecem no cartão da loja, numa faixa que rola de lado.
 *
 * O cliente decide pelo que tem na loja, não pelo nome dela: mostrar o que
 * ela vende ali mesmo poupa a ida e volta de abrir loja por loja. A ordem é a
 * do que vende: promoção primeiro (é oportunidade e some rápido), depois do
 * mais pedido ao menos pedido.
 */

export interface ProdutoDaVitrine {
  id: string;
  nome: string;
  precoCents: number;
  /** Preço "de", quando está em promoção. */
  precoDeCents: number | null;
  /** Sabor de pizza: preço do menor tamanho. */
  aPartirDe: boolean;
  porPeso: boolean;
  href: string;
  imagem: string | null;
  arte: ArteDoPrato;
}

/** Quantos produtos cada cartão mostra. */
const POR_LOJA = 10;

interface LinhaDeProduto {
  id: string;
  storeId: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  sellingUnit: string;
}

/**
 * Produtos de várias lojas de uma vez, já cortados e ordenados por loja no
 * banco (uma consulta para a vitrine inteira, e não uma por cartão).
 */
export async function produtosDasLojas(
  lojas: { id: string; slug: string; segmento: string; cidadeSlug: string }[],
): Promise<Map<string, ProdutoDaVitrine[]>> {
  const resultado = new Map<string, ProdutoDaVitrine[]>();
  if (lojas.length === 0) return resultado;

  const ids = lojas.map((loja) => loja.id);
  const agora = new Date();

  // Um pouco a mais que o necessário: restaurante descarta bebida depois.
  const [produtos, sabores] = await Promise.all([
    prisma.$queryRaw<LinhaDeProduto[]>`
      SELECT id, "storeId", name, "priceCents", "compareAtPriceCents", "sellingUnit"
      FROM (
        SELECT p.*, row_number() OVER (
          PARTITION BY p."storeId"
          ORDER BY (p."compareAtPriceCents" IS NOT NULL AND p."compareAtPriceCents" > p."priceCents") DESC,
                   p."soldCount" DESC,
                   p."sortOrder" ASC
        ) AS posicao
        FROM "products" p
        WHERE p."storeId" = ANY(${ids})
          AND p."deletedAt" IS NULL
          AND p."isAvailable" = true
          AND (p."pausedUntil" IS NULL OR p."pausedUntil" <= ${agora})
      ) ordenados
      WHERE posicao <= ${POR_LOJA + 6}
      ORDER BY "storeId", posicao
    `,
    prisma.pizzaFlavor.findMany({
      where: { storeId: { in: ids }, ...saborDisponivelAgora() },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        storeId: true,
        name: true,
        groupName: true,
        image: { select: SELECT_IMAGEM },
        prices: {
          where: { size: { isActive: true } },
          orderBy: { priceCents: 'asc' },
          take: 1,
          select: { priceCents: true },
        },
      },
    }),
  ]);

  const imagens = new Map(
    (
      await prisma.product.findMany({
        where: { id: { in: produtos.map((produto) => produto.id) } },
        select: { id: true, image: { select: SELECT_IMAGEM } },
      })
    ).map((produto) => [produto.id, imagemExibivel(produto.image, 'medium').url]),
  );

  const porLoja = new Map(lojas.map((loja) => [loja.id, loja]));

  for (const loja of lojas) {
    const daLoja = produtos.filter((produto) => produto.storeId === loja.id);

    const itens: ProdutoDaVitrine[] = daLoja.map((produto) => ({
      id: produto.id,
      nome: produto.name,
      precoCents: produto.priceCents,
      precoDeCents:
        produto.compareAtPriceCents != null && produto.compareAtPriceCents > produto.priceCents
          ? produto.compareAtPriceCents
          : null,
      aPartirDe: false,
      porPeso: produto.sellingUnit === 'WEIGHT_KG',
      href: `/${loja.cidadeSlug}/produto/${produto.id}`,
      imagem: imagens.get(produto.id) ?? null,
      arte: arteDoProduto(produto.name, loja.segmento),
    }));

    const emPromocao = itens.filter((item) => item.precoDeCents != null);
    let demais = itens.filter((item) => item.precoDeCents == null);

    // Restaurante: bebida vai para o fim — o cartão da pizzaria não pode abrir
    // com "Refrigerante lata".
    if (loja.segmento === 'RESTAURANT') {
      demais = [
        ...demais.filter((item) => item.arte.tipo !== 'bebida'),
        ...demais.filter((item) => item.arte.tipo === 'bebida'),
      ];
    }

    const pizzas: ProdutoDaVitrine[] = sabores
      .filter((sabor) => sabor.storeId === loja.id && sabor.prices[0])
      .map((sabor) => ({
        id: `sabor-${sabor.id}`,
        nome: `Pizza de ${sabor.name.toLowerCase()}`,
        precoCents: sabor.prices[0]!.priceCents,
        precoDeCents: null,
        aPartirDe: true,
        porPeso: false,
        href: `/${loja.cidadeSlug}/${porLoja.get(loja.id)!.slug}`,
        imagem: imagemExibivel(sabor.image, 'medium').url,
        arte: classificarPrato(sabor.name, sabor.groupName, true),
      }));

    resultado.set(loja.id, [...emPromocao, ...pizzas, ...demais].slice(0, POR_LOJA));
  }

  return resultado;
}
