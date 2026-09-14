'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
import {
  menuCategorySchema,
  quickProductSchema,
  reorderSchema,
  slugify,
  toggleProductSchema,
  updateProductSchema,
} from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';
import { formToObject, centsFromForm, boolFromForm } from '@/lib/admin-action';

/**
 * Cadastro e manutenção de produtos.
 *
 * A regra que orienta tudo aqui: o dono do mercadinho precisa cadastrar em
 * menos de 30 segundos. Nome e preço bastam; o resto tem padrão sensato.
 */

/** Confere que a categoria é da MESMA loja antes de vinculá-la ao produto. */
async function categoriaValida(storeId: string, categoryId: string | undefined) {
  if (!categoryId) return null;

  const categoria = await prisma.menuCategory.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  });

  // Silenciosamente ignora uma categoria de outra loja em vez de vincular:
  // aceitar o id cruzaria dados entre tenants.
  return categoria?.id ?? null;
}

export async function criarProdutoRapido(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const bruto = formToObject(formData);
    const dados = quickProductSchema.parse({
      ...bruto,
      priceCents: centsFromForm(formData.get('priceCents')),
    });

    const categoryId = await categoriaValida(access.storeId, dados.categoryId);

    const produto = await prisma.product.create({
      data: {
        storeId: access.storeId,
        name: dados.name,
        priceCents: dados.priceCents,
        description: dados.description ?? null,
        categoryId,
        imageId: dados.imageId ?? null,
        isAvailable: true,
      },
      select: { id: true, name: true },
    });

    revalidatePath('/loja/produtos');

    return {
      result: { ok: true, message: `"${produto.name}" está no cardápio.` },
      audit: {
        action: 'product.created',
        entityType: 'Product',
        entityId: produto.id,
        after: produto,
      },
    };
  });
}

export async function atualizarProduto(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const bruto = formToObject(formData);

    const dados = updateProductSchema.parse({
      ...bruto,
      priceCents: centsFromForm(formData.get('priceCents')),
      compareAtPriceCents: centsFromForm(formData.get('compareAtPriceCents')) ?? null,
      isAvailable: boolFromForm(formData.get('isAvailable')),
      isFeatured: boolFromForm(formData.get('isFeatured')),
      stockQuantity: bruto.stockQuantity != null ? Number(bruto.stockQuantity) : null,
      weightStepGrams: bruto.weightStepGrams != null ? Number(bruto.weightStepGrams) : null,
      minWeightGrams: bruto.minWeightGrams != null ? Number(bruto.minWeightGrams) : null,
      sortOrder: bruto.sortOrder != null ? Number(bruto.sortOrder) : 0,
      complementGroupIds: formData.getAll('complementGroupIds').map(String).filter(Boolean),
    });

    const existente = await prisma.product.findFirst({
      where: { id: dados.id, storeId: access.storeId, deletedAt: null },
      select: { id: true, name: true, priceCents: true, isAvailable: true },
    });

    if (!existente) {
      return { result: { ok: false, message: 'Produto não encontrado nesta loja.' } };
    }

    const categoryId = await categoriaValida(access.storeId, dados.categoryId);

    // Os grupos de complemento também precisam ser da loja: um id de fora
    // vazaria opções de outro cardápio para dentro deste produto.
    const gruposDaLoja = await prisma.complementGroup.findMany({
      where: { id: { in: dados.complementGroupIds ?? [] }, storeId: access.storeId },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.product.update({
        where: { id: existente.id },
        data: {
          name: dados.name,
          priceCents: dados.priceCents,
          compareAtPriceCents: dados.compareAtPriceCents ?? null,
          description: dados.description ?? null,
          categoryId,
          imageId: dados.imageId ?? null,
          sellingUnit: dados.sellingUnit,
          weightStepGrams: dados.weightStepGrams ?? null,
          minWeightGrams: dados.minWeightGrams ?? null,
          sku: dados.sku ?? null,
          barcode: dados.barcode ?? null,
          isAvailable: dados.isAvailable ?? true,
          isFeatured: dados.isFeatured ?? false,
          stockQuantity: dados.stockQuantity ?? null,
          sortOrder: dados.sortOrder ?? 0,
        },
      }),
      prisma.productComplementGroup.deleteMany({ where: { productId: existente.id } }),
      ...(gruposDaLoja.length > 0
        ? [
            prisma.productComplementGroup.createMany({
              data: gruposDaLoja.map((grupo, indice) => ({
                productId: existente.id,
                groupId: grupo.id,
                sortOrder: indice,
              })),
            }),
          ]
        : []),
    ]);

    revalidatePath('/loja/produtos');

    return {
      result: { ok: true, message: 'Produto atualizado.' },
      audit: {
        action: 'product.updated',
        entityType: 'Product',
        entityId: existente.id,
        before: existente,
        after: { name: dados.name, priceCents: dados.priceCents },
      },
    };
  });
}

/** Pausar/despausar com um clique — o botão mais usado da tela. */
export async function alternarDisponibilidade(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = toggleProductSchema.parse(entrada);

    const produto = await prisma.product.findFirst({
      where: { id: dados.id, storeId: access.storeId, deletedAt: null },
      select: { id: true, name: true, isAvailable: true },
    });

    if (!produto) {
      return { result: { ok: false, message: 'Produto não encontrado nesta loja.' } };
    }

    await prisma.product.update({
      where: { id: produto.id },
      data: {
        isAvailable: dados.isAvailable,
        // Pausa com prazo volta sozinha: o lojista que pausou o açaí numa
        // tarde quente não lembra de despausar no dia seguinte.
        pausedUntil:
          dados.isAvailable || dados.pauseMinutes == null
            ? null
            : new Date(Date.now() + dados.pauseMinutes * 60_000),
      },
    });

    revalidatePath('/loja/produtos');

    return {
      result: {
        ok: true,
        message: dados.isAvailable
          ? `"${produto.name}" voltou ao cardápio.`
          : `"${produto.name}" pausado.`,
      },
    };
  });
}

/** Exclusão lógica: o produto aparece em pedidos antigos e não pode sumir. */
export async function excluirProduto(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const produto = await prisma.product.findFirst({
      where: { id, storeId: access.storeId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!produto) {
      return { result: { ok: false, message: 'Produto não encontrado nesta loja.' } };
    }

    await prisma.product.update({
      where: { id: produto.id },
      data: { deletedAt: new Date(), isAvailable: false },
    });

    revalidatePath('/loja/produtos');

    return {
      result: { ok: true, message: `"${produto.name}" removido do cardápio.` },
      audit: {
        action: 'product.deleted',
        entityType: 'Product',
        entityId: produto.id,
        before: produto,
      },
    };
  });
}

// --- Categorias do cardápio ------------------------------------------------

export async function salvarCategoria(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const id = formData.get('id');
    const dados = menuCategorySchema.parse({
      ...formToObject(formData),
      isActive: boolFromForm(formData.get('isActive')),
    });

    if (typeof id === 'string' && id) {
      const existente = await prisma.menuCategory.findFirst({
        where: { id, storeId: access.storeId },
        select: { id: true, name: true },
      });

      if (!existente) {
        return { result: { ok: false, message: 'Categoria não encontrada nesta loja.' } };
      }

      await prisma.menuCategory.update({
        where: { id: existente.id },
        data: {
          name: dados.name,
          description: dados.description ?? null,
          isActive: dados.isActive,
        },
      });

      revalidatePath('/loja/categorias');
      return {
        result: { ok: true, message: 'Categoria atualizada.' },
        audit: {
          action: 'menu_category.updated',
          entityType: 'MenuCategory',
          entityId: existente.id,
        },
      };
    }

    const duplicada = await prisma.menuCategory.findFirst({
      where: { storeId: access.storeId, name: dados.name },
      select: { id: true },
    });

    if (duplicada) {
      return {
        result: {
          ok: false,
          message: 'Já existe uma categoria com esse nome.',
          fieldErrors: { name: 'Nome repetido' },
        },
      };
    }

    const ultima = await prisma.menuCategory.findFirst({
      where: { storeId: access.storeId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const categoria = await prisma.menuCategory.create({
      data: {
        storeId: access.storeId,
        name: dados.name,
        description: dados.description ?? null,
        isActive: dados.isActive,
        sortOrder: (ultima?.sortOrder ?? -1) + 1,
      },
      select: { id: true, name: true },
    });

    revalidatePath('/loja/categorias');
    revalidatePath('/loja/produtos');

    return {
      result: { ok: true, message: `Categoria "${categoria.name}" criada.` },
      audit: {
        action: 'menu_category.created',
        entityType: 'MenuCategory',
        entityId: categoria.id,
      },
    };
  });
}

/** Reordenação por arrastar: chega a lista de ids já na ordem final. */
export async function reordenarCategorias(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { ids } = reorderSchema.parse(entrada);

    // Só reordena o que é da loja. Um id estranho no meio da lista não pode
    // fazer a ação escrever em categoria alheia.
    const daLoja = await prisma.menuCategory.findMany({
      where: { id: { in: ids }, storeId: access.storeId },
      select: { id: true },
    });

    const permitidos = new Set(daLoja.map((categoria) => categoria.id));

    await prisma.$transaction(
      ids
        .filter((id) => permitidos.has(id))
        .map((id, indice) =>
          prisma.menuCategory.update({ where: { id }, data: { sortOrder: indice } }),
        ),
    );

    revalidatePath('/loja/categorias');
    revalidatePath('/loja/produtos');

    return { result: { ok: true, message: 'Ordem salva.' } };
  });
}

export async function excluirCategoria(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const categoria = await prisma.menuCategory.findFirst({
      where: { id, storeId: access.storeId },
      select: { id: true, name: true, _count: { select: { products: true } } },
    });

    if (!categoria) {
      return { result: { ok: false, message: 'Categoria não encontrada nesta loja.' } };
    }

    if (categoria._count.products > 0) {
      return {
        result: {
          ok: false,
          message: `"${categoria.name}" ainda tem ${categoria._count.products} produto(s). Mova-os antes de excluir.`,
        },
      };
    }

    await prisma.menuCategory.delete({ where: { id: categoria.id } });
    revalidatePath('/loja/categorias');

    return {
      result: { ok: true, message: `Categoria "${categoria.name}" excluída.` },
      audit: {
        action: 'menu_category.deleted',
        entityType: 'MenuCategory',
        entityId: categoria.id,
      },
    };
  });
}

export { slugify };
