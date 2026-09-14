'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { pizzaExtraSchema, pizzaFlavorSchema, pizzaSizeSchema } from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';
import { centsFromForm, formToObject, boolFromForm } from '@/lib/admin-action';

/**
 * Tamanhos, sabores e extras de pizza.
 *
 * O preço mora no cruzamento sabor × tamanho, e não no sabor: uma calabresa
 * grande e uma broto custam diferente, e é isso que permite a regra de "maior
 * valor" ou "média" quando o cliente escolhe dois sabores.
 */

export async function salvarTamanho(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const id = formData.get('id');
    const dados = pizzaSizeSchema.parse({
      ...formToObject(formData),
      maxFlavors: Number(formData.get('maxFlavors') ?? 1),
      slices: formData.get('slices') ? Number(formData.get('slices')) : null,
      isActive: boolFromForm(formData.get('isActive')),
    });

    if (typeof id === 'string' && id) {
      const { count } = await prisma.pizzaSize.updateMany({
        where: { id, storeId: access.storeId },
        data: dados,
      });

      if (count === 0) {
        return { result: { ok: false, message: 'Tamanho não encontrado nesta loja.' } };
      }
    } else {
      const duplicado = await prisma.pizzaSize.findFirst({
        where: { storeId: access.storeId, name: dados.name },
        select: { id: true },
      });

      if (duplicado) {
        return {
          result: {
            ok: false,
            message: 'Já existe um tamanho com esse nome.',
            fieldErrors: { name: 'Nome repetido' },
          },
        };
      }

      const ultimo = await prisma.pizzaSize.findFirst({
        where: { storeId: access.storeId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });

      await prisma.pizzaSize.create({
        data: { storeId: access.storeId, ...dados, sortOrder: (ultimo?.sortOrder ?? -1) + 1 },
      });
    }

    revalidatePath('/loja/pizzas');
    return { result: { ok: true, message: `Tamanho "${dados.name}" salvo.` } };
  });
}

export async function excluirTamanho(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const emUso = await prisma.orderItem.count({ where: { pizzaSizeId: id } });

    if (emUso > 0) {
      // Apagar quebraria a exibição dos pedidos que usaram este tamanho.
      const { count } = await prisma.pizzaSize.updateMany({
        where: { id, storeId: access.storeId },
        data: { isActive: false },
      });

      if (count === 0) return { result: { ok: false, message: 'Tamanho não encontrado.' } };

      revalidatePath('/loja/pizzas');
      return { result: { ok: true, message: 'Tamanho desativado (há pedidos usando ele).' } };
    }

    const { count } = await prisma.pizzaSize.deleteMany({ where: { id, storeId: access.storeId } });
    if (count === 0) return { result: { ok: false, message: 'Tamanho não encontrado.' } };

    revalidatePath('/loja/pizzas');
    return { result: { ok: true, message: 'Tamanho removido.' } };
  });
}

const saborPayloadSchema = z.object({ payload: z.string() });

export async function salvarSabor(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const id = formData.get('id');
    const { payload } = saborPayloadSchema.parse({ payload: formData.get('payload') });
    const dados = pizzaFlavorSchema.parse(JSON.parse(payload));

    // Os tamanhos precificados têm de ser da loja: um sizeId de fora criaria
    // preço para o tamanho de outra pizzaria.
    const tamanhosDaLoja = await prisma.pizzaSize.findMany({
      where: { id: { in: dados.prices.map((preco) => preco.sizeId) }, storeId: access.storeId },
      select: { id: true },
    });

    const permitidos = new Set(tamanhosDaLoja.map((tamanho) => tamanho.id));
    const precos = dados.prices.filter((preco) => permitidos.has(preco.sizeId));

    if (precos.length === 0) {
      return { result: { ok: false, message: 'Defina o preço em pelo menos um tamanho seu.' } };
    }

    const saborId =
      typeof id === 'string' && id
        ? id
        : (
            await prisma.pizzaFlavor.create({
              data: {
                storeId: access.storeId,
                name: dados.name,
                description: dados.description ?? null,
                groupName: dados.groupName ?? null,
                imageId: dados.imageId ?? null,
                isAvailable: dados.isAvailable,
              },
              select: { id: true },
            })
          ).id;

    if (typeof id === 'string' && id) {
      const { count } = await prisma.pizzaFlavor.updateMany({
        where: { id, storeId: access.storeId },
        data: {
          name: dados.name,
          description: dados.description ?? null,
          groupName: dados.groupName ?? null,
          imageId: dados.imageId ?? null,
          isAvailable: dados.isAvailable,
        },
      });

      if (count === 0)
        return { result: { ok: false, message: 'Sabor não encontrado nesta loja.' } };
    }

    await prisma.$transaction([
      prisma.pizzaFlavorPrice.deleteMany({ where: { flavorId: saborId } }),
      prisma.pizzaFlavorPrice.createMany({
        data: precos.map((preco) => ({
          flavorId: saborId,
          sizeId: preco.sizeId,
          priceCents: preco.priceCents,
        })),
      }),
    ]);

    revalidatePath('/loja/pizzas');
    return { result: { ok: true, message: `Sabor "${dados.name}" salvo.` } };
  });
}

export async function excluirSabor(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.pizzaFlavor.updateMany({
      where: { id, storeId: access.storeId },
      data: { isAvailable: false },
    });

    if (count === 0) return { result: { ok: false, message: 'Sabor não encontrado.' } };

    revalidatePath('/loja/pizzas');
    return { result: { ok: true, message: 'Sabor removido do cardápio.' } };
  });
}

export async function salvarExtra(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = pizzaExtraSchema.parse({
      ...formToObject(formData),
      priceCents: centsFromForm(formData.get('priceCents')) ?? 0,
      isAvailable: true,
    });

    await prisma.pizzaExtra.create({ data: { storeId: access.storeId, ...dados } });

    revalidatePath('/loja/pizzas');
    return { result: { ok: true, message: `"${dados.name}" adicionado.` } };
  });
}

export async function excluirExtra(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.pizzaExtra.updateMany({
      where: { id, storeId: access.storeId },
      data: { isAvailable: false },
    });

    if (count === 0) return { result: { ok: false, message: 'Item não encontrado.' } };

    revalidatePath('/loja/pizzas');
    return { result: { ok: true, message: 'Item removido.' } };
  });
}

const regraSchema = z.object({ rule: z.enum(['HIGHEST_PRICE', 'AVERAGE_PRICE']) });

export async function salvarRegraDePreco(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { rule } = regraSchema.parse(entrada);

    await prisma.store.update({
      where: { id: access.storeId },
      data: { pizzaPricingRule: rule },
    });

    revalidatePath('/loja/pizzas');
    return { result: { ok: true, message: 'Regra de preço salva.' } };
  });
}
