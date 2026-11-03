import { prisma } from '@rapidinho/database';
import {
  imagemExibivel,
  interpretarLista,
  notaDoProduto,
  SELECT_IMAGEM,
  type ItemDaLista,
} from '@rapidinho/shared';
import { adicionarItemAoCarrinho } from './carrinho';
import { paraLike, paraLojaNaVitrine, selectDaLojaNaVitrine } from './catalogo';
import { falha, type Resultado } from './resultado';

/**
 * Pedido por lista.
 *
 * O cliente escreve (ou fala) o que precisa; aqui cada item vira busca nos
 * produtos das lojas da cidade, e o resultado vira uma proposta: qual loja atende
 * o quê, e a combinação que cobre a lista inteira com o menor número de lojas.
 * Nada entra no carrinho sem o cliente ver e confirmar.
 *
 * Preço nenhum vem do cliente, nem aqui: a proposta mostra o preço do catálogo,
 * e o carrinho recalcula na leitura como sempre.
 */

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

/** Nota mínima para um produto contar como resposta ao item. */
const NOTA_MINIMA = 0.5;
/** Mais de três lojas deixa de ser atalho e vira trabalho. */
const MAXIMO_DE_LOJAS_NO_PLANO = 3;

/** Peso pedido, encaixado no passo e no mínimo que a loja vende. */
function ajustarGramas(
  pedidas: number | null,
  passo: number | null,
  minimo: number | null,
): number {
  const incremento = passo && passo > 0 ? passo : 100;
  const piso = minimo && minimo > 0 ? minimo : incremento;
  const alvo = pedidas ?? Math.max(piso, 500);
  return Math.max(piso, Math.round(alvo / incremento) * incremento);
}

async function candidatosDoItem(cityId: string, item: ItemDaLista) {
  const nucleo = item.palavras[0]!;

  // Só a palavra principal vai ao SQL (pelo índice de unaccent); o resto da
  // nota é calculado em memória, onde plural e embalagem são fáceis de pesar.
  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p."id"
    FROM "products" p
    JOIN "stores" s ON s."id" = p."storeId"
    WHERE s."cityId" = ${cityId}
      AND s."status" = 'ACTIVE'
      AND s."deletedAt" IS NULL
      AND p."deletedAt" IS NULL
      AND p."isAvailable" = true
      AND (p."pausedUntil" IS NULL OR p."pausedUntil" <= now())
      AND immutable_unaccent(lower(p."name")) LIKE ${paraLike(nucleo)}
    ORDER BY p."soldCount" DESC
    LIMIT 120
  `;

  if (ids.length === 0) return [];

  const produtos = await prisma.product.findMany({
    where: {
      id: { in: ids.map((linha) => linha.id) },
      deletedAt: null,
      isAvailable: true,
      store: { cityId, status: 'ACTIVE', deletedAt: null },
    },
    select: {
      id: true,
      name: true,
      storeId: true,
      priceCents: true,
      sellingUnit: true,
      weightStepGrams: true,
      minWeightGrams: true,
      productType: true,
      soldCount: true,
      image: { select: SELECT_IMAGEM },
      complementGroups: {
        where: {
          group: { isActive: true, OR: [{ isRequired: true }, { minChoices: { gt: 0 } }] },
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  return produtos
    .map((produto) => ({ produto, nota: notaDoProduto(item, produto.name) }))
    .filter(({ nota }) => nota >= NOTA_MINIMA)
    .sort((a, b) => b.nota - a.nota || b.produto.soldCount - a.produto.soldCount)
    .map(({ produto, nota }) => {
      const porPeso = produto.sellingUnit === 'WEIGHT_KG';
      const sugerido: ProdutoSugerido = {
        id: produto.id,
        nome: produto.name,
        precoCents: produto.priceCents,
        porPeso,
        gramas: porPeso
          ? ajustarGramas(item.gramas, produto.weightStepGrams, produto.minWeightGrams)
          : null,
        precisaEscolher: produto.productType === 'PIZZA' || produto.complementGroups.length > 0,
        imagem: imagemExibivel(produto.image).url,
      };
      return { storeId: produto.storeId, nota, sugerido };
    });
}

export async function montarPedido(
  cidadeSlug: string,
  texto: string,
): Promise<Resultado<{ pedido: PedidoMontado }>> {
  const itens = interpretarLista(texto);

  if (itens.length === 0) {
    return falha('Escreva pelo menos um item, como "arroz" ou "dipirona".', 'DADOS_INVALIDOS');
  }

  const cidade = await prisma.city.findFirst({
    where: { slug: cidadeSlug, isActive: true },
    select: { id: true },
  });
  if (!cidade) return falha('Cidade indisponível.', 'NAO_ENCONTRADO');

  const porItem = await Promise.all(itens.map((item) => candidatosDoItem(cidade.id, item)));

  const idsDeLoja = [...new Set(porItem.flat().map((candidato) => candidato.storeId))];
  const lojasDoBanco = await prisma.store.findMany({
    where: { id: { in: idsDeLoja }, cityId: cidade.id, status: 'ACTIVE', deletedAt: null },
    select: selectDaLojaNaVitrine(new Date()),
  });

  const abertas = new Map<string, LojaSugerida>();
  const fechadas = new Set<string>();

  for (const bruta of lojasDoBanco) {
    const loja = paraLojaNaVitrine(bruta);
    if (!loja.aberta) {
      fechadas.add(loja.id);
      continue;
    }
    abertas.set(loja.id, {
      id: loja.id,
      nome: loja.nome,
      slug: loja.slug,
      imagem: loja.imagem.url,
      tempoMin: loja.tempoMin,
      taxaCents: loja.taxaCents,
      taxaGratis: loja.taxaGratis,
      minimoCents: loja.minimoCents,
      nota: loja.nota,
      avaliacoes: loja.avaliacoes,
      produtos: {},
    });
  }

  const naoEncontrados: number[] = [];
  const soEmFechadas: number[] = [];

  porItem.forEach((candidatos, indice) => {
    let achouAberta = false;
    for (const { storeId, sugerido } of candidatos) {
      const loja = abertas.get(storeId);
      if (!loja) continue;
      achouAberta = true;
      const lista = (loja.produtos[indice] ??= []);
      if (lista.length < 4) lista.push(sugerido);
    }
    if (!achouAberta) {
      if (candidatos.some(({ storeId }) => fechadas.has(storeId))) soEmFechadas.push(indice);
      else naoEncontrados.push(indice);
    }
  });

  const cobertura = (loja: LojaSugerida, faltando: Set<number>) =>
    [...faltando].filter((indice) => loja.produtos[indice]?.length).length;

  // Melhor combinação, gulosa: a loja que cobre mais do que falta, depois
  // a que cobre mais do resto — até três lojas. Empate vai para a mais
  // bem avaliada e, depois, a mais rápida.
  const plano: Record<number, string> = {};
  const faltando = new Set(
    itens.map((_, indice) => indice).filter((indice) => !naoEncontrados.includes(indice)),
  );
  for (const indice of soEmFechadas) faltando.delete(indice);

  const candidatas = [...abertas.values()];
  for (let rodada = 0; rodada < MAXIMO_DE_LOJAS_NO_PLANO && faltando.size > 0; rodada += 1) {
    const melhor = [...candidatas].sort(
      (a, b) =>
        cobertura(b, faltando) - cobertura(a, faltando) ||
        b.nota - a.nota ||
        a.tempoMin - b.tempoMin,
    )[0];
    if (!melhor || cobertura(melhor, faltando) === 0) break;
    for (const indice of [...faltando]) {
      if (melhor.produtos[indice]?.length) {
        plano[indice] = melhor.id;
        faltando.delete(indice);
      }
    }
  }

  const todos = new Set(itens.map((_, indice) => indice));
  const pedido: PedidoMontado = {
    itens: itens.map((item, indice) => ({
      indice,
      original: item.original,
      quantidade: item.quantidade,
    })),
    // As lojas que mais cobrem a lista primeiro; as do plano sempre entram.
    lojas: candidatas
      .sort((a, b) => cobertura(b, todos) - cobertura(a, todos) || b.nota - a.nota)
      .filter((loja, posicao) => posicao < 8 || Object.values(plano).includes(loja.id)),
    plano,
    naoEncontrados,
    soEmFechadas,
  };

  return { ok: true, pedido };
}

/**
 * Põe a lista confirmada no carrinho, loja por loja.
 *
 * Cada item passa pelo mesmo `adicionarItemAoCarrinho` da tela do produto, com a
 * mesma validação de loja, disponibilidade e peso. Produto com escolha
 * obrigatória é barrado aqui também: a tela já não oferece, mas a tela não é
 * autorização.
 */
export async function colocarListaNoCarrinhoDoCliente(
  userId: string,
  itens: { storeId: string; productId: string; quantidade: number; gramas: number | null }[],
): Promise<Resultado<{ adicionados: number }>> {
  const comEscolha = new Set(
    (
      await prisma.product.findMany({
        where: {
          id: { in: itens.map((item) => item.productId) },
          OR: [
            { productType: 'PIZZA' },
            {
              complementGroups: {
                some: {
                  group: {
                    isActive: true,
                    OR: [{ isRequired: true }, { minChoices: { gt: 0 } }],
                  },
                },
              },
            },
          ],
        },
        select: { id: true },
      })
    ).map((produto) => produto.id),
  );

  let adicionados = 0;
  const falhas: string[] = [];

  for (const item of itens) {
    if (comEscolha.has(item.productId)) continue;

    const resultado = await adicionarItemAoCarrinho(userId, {
      storeId: item.storeId,
      item: item.gramas
        ? { productId: item.productId, quantity: 1, weightGrams: item.gramas }
        : { productId: item.productId, quantity: item.quantidade },
    });

    if (resultado.ok) adicionados += 1;
    else falhas.push(resultado.message);
  }

  if (adicionados === 0) return falha(falhas[0] ?? 'Nenhum item pôde ser adicionado.');

  return {
    ok: true,
    adicionados,
    ...(falhas.length > 0
      ? {
          message: `${adicionados} ${adicionados === 1 ? 'item foi' : 'itens foram'} para o carrinho; ${falhas.length} não.`,
        }
      : {}),
  };
}
