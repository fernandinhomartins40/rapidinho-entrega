'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { parseProductCsv, type ImportedProduct } from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

/**
 * Importação de cardápio por planilha.
 *
 * O arquivo é lido no cliente (é texto) e chega aqui como string, mas a
 * validação acontece de novo no servidor: confiar no que o navegador mandou
 * permitiria injetar produtos com preço arbitrário.
 */

const importSchema = z.object({
  // 4 MB de texto já cobrem um mercado inteiro; acima disso é engano ou abuso.
  conteudo: z.string().min(1, 'Envie o arquivo').max(4_000_000, 'Arquivo grande demais'),
  criarCategorias: z.boolean().default(true),
  atualizarExistentes: z.boolean().default(true),
});

export interface ResultadoDaImportacao extends ActionResult {
  criados?: number;
  atualizados?: number;
  ignorados?: number;
  problemas?: { line: number; message: string }[];
}

/**
 * Resolve as categorias da planilha, criando as que faltam.
 *
 * Em lote, e não por produto: um mercado com 800 itens em 20 categorias faria
 * 800 consultas desnecessárias.
 */
async function resolverCategorias(
  storeId: string,
  produtos: ImportedProduct[],
  criarQuandoFaltar: boolean,
): Promise<Map<string, string>> {
  const nomes = [...new Set(produtos.map((p) => p.categoryName).filter((n): n is string => !!n))];
  const porNomeNormalizado = new Map<string, string>();

  if (nomes.length === 0) return porNomeNormalizado;

  const existentes = await prisma.menuCategory.findMany({
    where: { storeId },
    select: { id: true, name: true, sortOrder: true },
  });

  for (const categoria of existentes) {
    porNomeNormalizado.set(categoria.name.toLowerCase(), categoria.id);
  }

  if (!criarQuandoFaltar) return porNomeNormalizado;

  const faltando = nomes.filter((nome) => !porNomeNormalizado.has(nome.toLowerCase()));
  let proximaOrdem = Math.max(-1, ...existentes.map((c) => c.sortOrder)) + 1;

  for (const nome of faltando) {
    const criada = await prisma.menuCategory.create({
      data: { storeId, name: nome, sortOrder: proximaOrdem },
      select: { id: true, name: true },
    });
    porNomeNormalizado.set(criada.name.toLowerCase(), criada.id);
    proximaOrdem += 1;
  }

  return porNomeNormalizado;
}

export async function importarPlanilha(
  _anterior: ResultadoDaImportacao,
  formData: FormData,
): Promise<ResultadoDaImportacao> {
  return runStoreAction(async (access) => {
    const dados = importSchema.parse({
      conteudo: formData.get('conteudo'),
      criarCategorias: formData.get('criarCategorias') !== 'nao',
      atualizarExistentes: formData.get('atualizarExistentes') !== 'nao',
    });

    const { products, issues, totalRows } = parseProductCsv(dados.conteudo);

    if (products.length === 0) {
      return {
        result: {
          ok: false,
          message:
            totalRows === 0
              ? 'Não consegui ler a planilha.'
              : 'Nenhuma linha aproveitável. Veja os problemas abaixo.',
          problemas: issues,
        } as ResultadoDaImportacao,
      };
    }

    const categorias = await resolverCategorias(access.storeId, products, dados.criarCategorias);

    // Casar por código interno quando existir, e por nome quando não: é como o
    // lojista pensa ao reenviar a planilha com preços atualizados.
    const existentes = await prisma.product.findMany({
      where: { storeId: access.storeId, deletedAt: null },
      select: { id: true, name: true, sku: true },
    });

    const porSku = new Map(
      existentes.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p.id]),
    );
    const porNome = new Map(existentes.map((p) => [p.name.toLowerCase(), p.id]));

    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const produto of products) {
      const categoryId = produto.categoryName
        ? (categorias.get(produto.categoryName.toLowerCase()) ?? null)
        : null;

      const existenteId =
        (produto.sku ? porSku.get(produto.sku.toLowerCase()) : undefined) ??
        porNome.get(produto.name.toLowerCase());

      if (existenteId) {
        if (!dados.atualizarExistentes) {
          ignorados += 1;
          continue;
        }

        await prisma.product.update({
          where: { id: existenteId },
          data: {
            priceCents: produto.priceCents,
            isAvailable: produto.isAvailable,
            sellingUnit: produto.sellingUnit,
            ...(produto.description ? { description: produto.description } : {}),
            ...(produto.barcode ? { barcode: produto.barcode } : {}),
            ...(categoryId ? { categoryId } : {}),
          },
        });
        atualizados += 1;
        continue;
      }

      await prisma.product.create({
        data: {
          storeId: access.storeId,
          name: produto.name,
          priceCents: produto.priceCents,
          description: produto.description ?? null,
          sku: produto.sku ?? null,
          barcode: produto.barcode ?? null,
          isAvailable: produto.isAvailable,
          sellingUnit: produto.sellingUnit,
          categoryId,
        },
      });
      criados += 1;
    }

    revalidatePath('/loja/produtos');
    revalidatePath('/loja/categorias');

    const partes = [
      criados > 0 ? `${criados} novo(s)` : null,
      atualizados > 0 ? `${atualizados} atualizado(s)` : null,
      ignorados > 0 ? `${ignorados} ignorado(s)` : null,
    ].filter(Boolean);

    return {
      result: {
        ok: true,
        message: `Importação concluída: ${partes.join(', ')}.`,
        criados,
        atualizados,
        ignorados,
        problemas: issues,
      } as ResultadoDaImportacao,
      audit: {
        action: 'product.imported',
        entityType: 'Store',
        entityId: access.storeId,
        after: { criados, atualizados, ignorados, linhas: totalRows },
      },
    };
  });
}
