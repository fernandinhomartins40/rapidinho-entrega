'use server';

import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { capturarErro } from '@rapidinho/services';
import { cuidSchema, interpretarLista, notaDoProduto, type ItemDaLista } from '@rapidinho/shared';
import { adicionarAoCarrinho } from '@/app/carrinho/actions';
import { runAuthedAction, type ActionResult } from '@/lib/action';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { paraLojaNaVitrine, selectDaLojaNaVitrine } from '@/lib/vitrine';
import type { LojaSugerida, PedidoMontado, ProdutoSugerido, RespostaDaMontagem } from './tipos';

/**
 * Pedido por lista.
 *
 * O cliente escreve (ou fala) o que precisa; aqui cada item vira busca nos
 * produtos das lojas da cidade, e o resultado vira uma proposta: qual loja
 * atende o quê, e a combinação que cobre a lista inteira com o menor número
 * de lojas. Nada entra no carrinho sem o cliente ver e confirmar.
 *
 * Preço nenhum vem do cliente, nem aqui: a proposta mostra o preço do
 * catálogo, e o carrinho recalcula na leitura como sempre.
 */

/** Nota mínima para um produto contar como resposta ao item. */
const NOTA_MINIMA = 0.5;
/** Mais de três lojas deixa de ser atalho e vira trabalho. */
const MAXIMO_DE_LOJAS_NO_PLANO = 3;

function paraLike(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`;
}

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

const montarSchema = z.object({
  cidadeSlug: z.string().min(1).max(80),
  texto: z.string().max(2000),
});

export async function montarPedidoPorLista(entrada: unknown): Promise<RespostaDaMontagem> {
  try {
    const { cidadeSlug, texto } = montarSchema.parse(entrada);
    const itens = interpretarLista(texto);

    if (itens.length === 0) {
      return { ok: false, message: 'Escreva pelo menos um item, como "arroz" ou "dipirona".' };
    }

    const cidade = await prisma.city.findFirst({
      where: { slug: cidadeSlug, isActive: true },
      select: { id: true },
    });
    if (!cidade) return { ok: false, message: 'Cidade indisponível.' };

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
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: 'Lista inválida.' };
    void capturarErro(error, { origem: 'pedido-por-lista' });
    return { ok: false, message: 'Não foi possível montar agora. Tente de novo.' };
  }
}

const carrinhoSchema = z
  .array(
    z.object({
      storeId: cuidSchema,
      productId: cuidSchema,
      quantidade: z.number().int().min(1).max(99),
      gramas: z.number().int().min(1).max(50_000).nullable(),
    }),
  )
  .min(1)
  .max(40);

/**
 * Põe a lista confirmada no carrinho, loja por loja.
 *
 * Cada item passa pelo mesmo `adicionarAoCarrinho` da tela do produto — com a
 * mesma validação de loja, disponibilidade e peso —, e não por um atalho que
 * precisaria repetir essas regras. Produto com escolha obrigatória é barrado
 * aqui também: a tela já não oferece, mas a tela não é autorização.
 */
export async function colocarListaNoCarrinho(
  entrada: unknown,
): Promise<ActionResult & { adicionados?: number }> {
  return runAuthedAction(async () => {
    const itens = carrinhoSchema.parse(entrada);

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

      const resultado = await adicionarAoCarrinho({
        storeId: item.storeId,
        item: item.gramas
          ? { productId: item.productId, quantity: 1, weightGrams: item.gramas }
          : { productId: item.productId, quantity: item.quantidade },
      });

      if (resultado.ok) adicionados += 1;
      else if (resultado.message) falhas.push(resultado.message);
    }

    if (adicionados === 0) {
      return { ok: false, message: falhas[0] ?? 'Nenhum item pôde ser adicionado.' };
    }

    return {
      ok: true,
      adicionados,
      message:
        falhas.length > 0
          ? `${adicionados} ${adicionados === 1 ? 'item foi' : 'itens foram'} para o carrinho; ${falhas.length} não.`
          : undefined,
    };
  });
}
