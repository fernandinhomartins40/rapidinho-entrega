'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { cuidSchema, inicioDoDia } from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';
import { centsFromForm } from '@/lib/admin-action';

/**
 * Marmita: tamanhos com preço fixo e o cardápio da semana.
 *
 * O restaurante cadastra uma vez em que dias cada prato sai (feijoada na
 * quarta) e, no dia, só marca o que acabou. O cliente monta a marmita com o
 * cardápio de hoje e pede sem, pouco ou mais de cada item do prato.
 */

const tamanhoSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(40),
  description: z.string().trim().max(120).optional(),
  priceCents: z.number().int().min(1, 'Informe o preço'),
  maxMisturas: z.number().int().min(1).max(4),
});

export async function salvarTamanho(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = tamanhoSchema.parse({
      name: formData.get('name'),
      description: (formData.get('description') as string) || undefined,
      priceCents: centsFromForm(formData.get('priceCents')) ?? 0,
      maxMisturas: Number(formData.get('maxMisturas') ?? 1),
    });

    const duplicado = await prisma.marmitaSize.findFirst({
      where: { storeId: access.storeId, name: dados.name },
      select: { id: true, isActive: true },
    });

    if (duplicado?.isActive) {
      return {
        result: {
          ok: false,
          message: 'Já existe um tamanho com esse nome.',
          fieldErrors: { name: 'Nome repetido' },
        },
      };
    }

    if (duplicado) {
      // Tamanho removido antes volta com os dados novos: o nome é único na loja.
      await prisma.marmitaSize.update({
        where: { id: duplicado.id },
        data: { ...dados, isActive: true },
      });
    } else {
      const ultimo = await prisma.marmitaSize.findFirst({
        where: { storeId: access.storeId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      await prisma.marmitaSize.create({
        data: { storeId: access.storeId, ...dados, sortOrder: (ultimo?.sortOrder ?? -1) + 1 },
      });
    }

    revalidatePath('/loja/marmitas');
    return { result: { ok: true, message: `Tamanho "${dados.name}" salvo.` } };
  });
}

export async function removerTamanho(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.marmitaSize.updateMany({
      where: { id, storeId: access.storeId },
      data: { isActive: false },
    });
    if (count === 0) return { result: { ok: false, message: 'Tamanho não encontrado.' } };

    revalidatePath('/loja/marmitas');
    return { result: { ok: true, message: 'Tamanho removido.' } };
  });
}

const itemSchema = z.object({
  id: cuidSchema.optional(),
  name: z.string().trim().min(1, 'Informe o nome').max(60),
  kind: z.enum(['NO_PRATO', 'MISTURA', 'EXTRA']),
  groupName: z.string().trim().max(30).optional(),
  priceCents: z.number().int().min(0),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
});

export async function salvarItem(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = itemSchema.parse({
      id: (formData.get('id') as string) || undefined,
      name: formData.get('name'),
      kind: formData.get('kind'),
      groupName: (formData.get('groupName') as string) || undefined,
      priceCents: centsFromForm(formData.get('priceCents')) ?? 0,
      weekdays: formData.getAll('weekdays').map(Number),
    });

    if (dados.kind === 'EXTRA' && dados.priceCents === 0) {
      return {
        result: {
          ok: false,
          message: 'Extra precisa de preço. Para item grátis, use "vem no prato".',
          fieldErrors: { priceCents: 'Informe o preço' },
        },
      };
    }

    const data = {
      name: dados.name,
      kind: dados.kind,
      // O que vem no prato não tem preço: tirar ou pedir mais não muda o valor.
      priceCents: dados.kind === 'NO_PRATO' ? 0 : dados.priceCents,
      groupName: dados.kind === 'NO_PRATO' ? (dados.groupName ?? null) : null,
      // Todos os dias marcados é o mesmo que nenhum: sai todo dia.
      weekdays: dados.weekdays.length === 7 ? [] : [...new Set(dados.weekdays)].sort(),
    };

    if (dados.id) {
      const { count } = await prisma.marmitaItem.updateMany({
        where: { id: dados.id, storeId: access.storeId, isAvailable: true },
        data,
      });
      if (count === 0) return { result: { ok: false, message: 'Item não encontrado.' } };
    } else {
      const ultimo = await prisma.marmitaItem.findFirst({
        where: { storeId: access.storeId, kind: dados.kind },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      await prisma.marmitaItem.create({
        data: { storeId: access.storeId, ...data, sortOrder: (ultimo?.sortOrder ?? -1) + 1 },
      });
    }

    revalidatePath('/loja/marmitas');
    return { result: { ok: true, message: `"${dados.name}" salvo.` } };
  });
}

/** Remove do cardápio. Marmita já no carrinho com o item fica indisponível. */
export async function removerItem(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.marmitaItem.updateMany({
      where: { id, storeId: access.storeId },
      data: { isAvailable: false },
    });
    if (count === 0) return { result: { ok: false, message: 'Item não encontrado.' } };

    revalidatePath('/loja/marmitas');
    return { result: { ok: true, message: 'Item removido do cardápio.' } };
  });
}

const pausaSchema = z.object({ id: cuidSchema, pausar: z.boolean() });

/** "Acabou o frango": fora do cardápio até a meia-noite, e volta sozinho. */
export async function pausarItem(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { id, pausar } = pausaSchema.parse(entrada);

    const { count } = await prisma.marmitaItem.updateMany({
      where: { id, storeId: access.storeId, isAvailable: true },
      data: { pausedUntil: pausar ? inicioDoDia(new Date(), -1) : null },
    });
    if (count === 0) return { result: { ok: false, message: 'Item não encontrado.' } };

    revalidatePath('/loja/marmitas');
    return {
      result: {
        ok: true,
        message: pausar ? 'Fora do cardápio até amanhã.' : 'De volta ao cardápio de hoje.',
      },
    };
  });
}
