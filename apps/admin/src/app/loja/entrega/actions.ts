'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { runStoreAction, type ActionResult } from '@/lib/store-action';
import { centsFromForm, boolFromForm } from '@/lib/admin-action';

/**
 * Regras de entrega da loja.
 *
 * Quatro modos, porque o interior comporta os quatro: taxa fixa (a maioria),
 * por distância (loja que atende sítio), por bairro (quando a cidade tem
 * bairro longe) e grátis (padaria da esquina).
 */

const entregaSchema = z
  .object({
    deliveryFeeMode: z.enum(['FIXED', 'BY_DISTANCE', 'BY_ZONE', 'FREE']),
    deliveryFeeCents: z.number().int().min(0).max(100_000),
    pricePerKmCents: z.number().int().min(0).max(100_000),
    freeDeliveryAboveCents: z.number().int().min(0).max(1_000_000).nullable(),
    deliveryRadiusMeters: z.number().int().min(100).max(100_000),
    minOrderCents: z.number().int().min(0).max(1_000_000),
    avgPrepTimeMinutes: z.number().int().min(1).max(240),
    avgDeliveryTimeMinutes: z.number().int().min(1).max(240),
    acceptsPickup: z.boolean(),
  })
  .refine((dados) => dados.deliveryFeeMode !== 'BY_DISTANCE' || dados.pricePerKmCents > 0, {
    message: 'No modo por distância, informe o preço por quilômetro',
    path: ['pricePerKmCents'],
  });

export async function salvarRegrasDeEntrega(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = entregaSchema.parse({
      deliveryFeeMode: formData.get('deliveryFeeMode'),
      deliveryFeeCents: centsFromForm(formData.get('deliveryFeeCents')) ?? 0,
      pricePerKmCents: centsFromForm(formData.get('pricePerKmCents')) ?? 0,
      freeDeliveryAboveCents: centsFromForm(formData.get('freeDeliveryAboveCents')) ?? null,
      deliveryRadiusMeters: Number(formData.get('deliveryRadiusKm') ?? 8) * 1000,
      minOrderCents: centsFromForm(formData.get('minOrderCents')) ?? 0,
      avgPrepTimeMinutes: Number(formData.get('avgPrepTimeMinutes') ?? 30),
      avgDeliveryTimeMinutes: Number(formData.get('avgDeliveryTimeMinutes') ?? 20),
      acceptsPickup: boolFromForm(formData.get('acceptsPickup')),
    });

    await prisma.store.update({ where: { id: access.storeId }, data: dados });

    revalidatePath('/loja/entrega');

    return {
      result: { ok: true, message: 'Regras de entrega salvas.' },
      audit: {
        action: 'store.delivery_updated',
        entityType: 'Store',
        entityId: access.storeId,
        after: dados,
      },
    };
  });
}

const zonaSchema = z.object({
  name: z.string().min(2, 'Informe o bairro').max(80),
  feeCents: z.number().int().min(0).max(100_000),
  minOrderCents: z.number().int().min(0).max(1_000_000).nullable(),
  estimatedMinutes: z.number().int().min(1).max(240).nullable(),
});

export async function salvarZona(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const id = formData.get('id');
    const dados = zonaSchema.parse({
      name: formData.get('name'),
      feeCents: centsFromForm(formData.get('feeCents')) ?? 0,
      minOrderCents: centsFromForm(formData.get('minOrderCents')) ?? null,
      estimatedMinutes: formData.get('estimatedMinutes')
        ? Number(formData.get('estimatedMinutes'))
        : null,
    });

    if (typeof id === 'string' && id) {
      const { count } = await prisma.deliveryZone.updateMany({
        where: { id, storeId: access.storeId },
        data: dados,
      });

      if (count === 0) {
        return { result: { ok: false, message: 'Zona não encontrada nesta loja.' } };
      }
    } else {
      await prisma.deliveryZone.create({ data: { storeId: access.storeId, ...dados } });
    }

    revalidatePath('/loja/entrega');
    return { result: { ok: true, message: `Bairro "${dados.name}" salvo.` } };
  });
}

export async function excluirZona(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.deliveryZone.deleteMany({
      where: { id, storeId: access.storeId },
    });

    if (count === 0) {
      return { result: { ok: false, message: 'Zona não encontrada.' } };
    }

    revalidatePath('/loja/entrega');
    return { result: { ok: true, message: 'Bairro removido.' } };
  });
}
