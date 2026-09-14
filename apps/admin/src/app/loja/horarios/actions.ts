'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { MINUTES_IN_DAY } from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

/**
 * Horário de funcionamento, feriados e pausa de emergência.
 *
 * O horário é guardado em minutos desde a meia-noite. Fechamento MAIOR que
 * 1440 significa que a loja vira o dia (abre 18:00, fecha 02:00 → 1560): é
 * assim que a pizzaria de sábado à noite é representada sem gambiarra de
 * "dois turnos".
 */

const horarioSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opensAt: z
      .number()
      .int()
      .min(0)
      .max(MINUTES_IN_DAY - 1),
    closesAt: z
      .number()
      .int()
      .min(1)
      .max(MINUTES_IN_DAY * 2 - 1),
    isActive: z.boolean(),
  })
  .refine((dia) => !dia.isActive || dia.closesAt > dia.opensAt, {
    message: 'O fechamento precisa ser depois da abertura',
    path: ['closesAt'],
  });

const semanaSchema = z.object({
  dias: z.array(horarioSchema).length(7, 'Informe os sete dias'),
});

export async function salvarHorarios(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { dias } = semanaSchema.parse(JSON.parse(String(formData.get('payload'))));

    await prisma.$transaction([
      prisma.storeHour.deleteMany({ where: { storeId: access.storeId } }),
      prisma.storeHour.createMany({
        data: dias.map((dia) => ({
          storeId: access.storeId,
          weekday: dia.weekday,
          opensAt: dia.opensAt,
          closesAt: dia.closesAt,
          isActive: dia.isActive,
        })),
      }),
    ]);

    revalidatePath('/loja/horarios');
    revalidatePath('/loja');

    return {
      result: { ok: true, message: 'Horários salvos.' },
      audit: {
        action: 'store.hours_updated',
        entityType: 'Store',
        entityId: access.storeId,
        after: dias,
      },
    };
  });
}

const pausaSchema = z.object({
  minutos: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  motivo: z.string().max(200).optional(),
});

/**
 * "Fechar agora".
 *
 * Sempre com prazo, nunca indefinida: uma loja pausada sem data de volta
 * simplesmente some da plataforma até alguém lembrar dela.
 */
export async function pausarLoja(entrada: unknown): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = pausaSchema.parse(entrada);

    await prisma.store.update({
      where: { id: access.storeId },
      data: {
        isPausedUntil: new Date(Date.now() + dados.minutos * 60_000),
        pauseReason: dados.motivo ?? null,
      },
    });

    revalidatePath('/loja');
    revalidatePath('/loja/horarios');

    return {
      result: { ok: true, message: `Loja pausada por ${dados.minutos} minutos.` },
      audit: {
        action: 'store.paused',
        entityType: 'Store',
        entityId: access.storeId,
        after: dados,
      },
    };
  });
}

export async function retomarLoja(): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    await prisma.store.update({
      where: { id: access.storeId },
      data: { isPausedUntil: null, pauseReason: null },
    });

    revalidatePath('/loja');
    revalidatePath('/loja/horarios');

    return {
      result: { ok: true, message: 'Loja reaberta.' },
      audit: { action: 'store.resumed', entityType: 'Store', entityId: access.storeId },
    };
  });
}

const feriadoSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().max(200).optional(),
  })
  .refine((periodo) => periodo.endsAt > periodo.startsAt, {
    message: 'O fim precisa ser depois do início',
    path: ['endsAt'],
  });

export async function salvarFeriado(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const dados = feriadoSchema.parse({
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt'),
      reason: formData.get('reason') || undefined,
    });

    const fechamento = await prisma.storeClosure.create({
      data: {
        storeId: access.storeId,
        startsAt: dados.startsAt,
        endsAt: dados.endsAt,
        reason: dados.reason ?? null,
      },
      select: { id: true },
    });

    revalidatePath('/loja/horarios');

    return {
      result: { ok: true, message: 'Fechamento programado.' },
      audit: {
        action: 'store.closure_created',
        entityType: 'StoreClosure',
        entityId: fechamento.id,
      },
    };
  });
}

export async function excluirFeriado(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    // deleteMany com o storeId no filtro: garante que só apaga o que é da loja
    // sem precisar de uma busca antes.
    const { count } = await prisma.storeClosure.deleteMany({
      where: { id, storeId: access.storeId },
    });

    if (count === 0) {
      return { result: { ok: false, message: 'Fechamento não encontrado.' } };
    }

    revalidatePath('/loja/horarios');
    return { result: { ok: true, message: 'Fechamento removido.' } };
  });
}
