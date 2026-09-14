'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { runStoreOwnerAction, type ActionResult } from '@/lib/store-action';

/**
 * Contratação de plano e de impulsionamento.
 *
 * Restrito ao dono: é dinheiro saindo da loja.
 */

const planoSchema = z.object({ planId: z.string().min(1) });

export async function contratarPlano(entrada: unknown): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const { planId } = planoSchema.parse(entrada);

    const plano = await prisma.plan.findFirst({
      where: { id: planId, isActive: true },
      select: { id: true, name: true, trialDays: true, monthlyPriceCents: true },
    });

    if (!plano) return { result: { ok: false, message: 'Plano indisponível.' } };

    const agora = new Date();
    const fimDoPeriodo = new Date(agora);
    // O teste conta como primeiro período: a cobrança só entra quando ele
    // acaba, e não no dia seguinte à contratação.
    fimDoPeriodo.setDate(fimDoPeriodo.getDate() + (plano.trialDays || 30));

    await prisma.storeSubscription.upsert({
      where: { storeId: access.storeId },
      update: {
        planId: plano.id,
        status: plano.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
        currentPeriodStart: agora,
        currentPeriodEnd: fimDoPeriodo,
      },
      create: {
        storeId: access.storeId,
        planId: plano.id,
        status: plano.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
        currentPeriodStart: agora,
        currentPeriodEnd: fimDoPeriodo,
      },
    });

    revalidatePath('/loja/impulsionar');
    revalidatePath('/loja/configuracoes');

    return {
      result: {
        ok: true,
        message:
          plano.trialDays > 0
            ? `Plano ${plano.name} ativado com ${plano.trialDays} dias grátis.`
            : `Plano ${plano.name} ativado.`,
      },
      audit: { action: 'subscription.changed', entityType: 'Store', entityId: access.storeId },
    };
  });
}

const boostSchema = z.object({ packageId: z.string().min(1) });

export async function contratarImpulsionamento(entrada: unknown): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const { packageId } = boostSchema.parse(entrada);

    const pacote = await prisma.boostPackage.findFirst({
      where: { id: packageId, isActive: true },
      select: { id: true, name: true, durationDays: true, priceCents: true },
    });

    if (!pacote) return { result: { ok: false, message: 'Pacote indisponível.' } };

    const ativo = await prisma.storeBoost.findFirst({
      where: {
        storeId: access.storeId,
        packageId: pacote.id,
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        endsAt: { gt: new Date() },
      },
      select: { endsAt: true },
    });

    // Contratar de novo enquanto o anterior corre EMENDA o período, em vez de
    // rodar os dois em paralelo — o lojista pagaria duas vezes pelo mesmo
    // destaque no mesmo dia.
    const inicio = ativo?.endsAt ?? new Date();
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + pacote.durationDays);

    const boost = await prisma.storeBoost.create({
      data: {
        storeId: access.storeId,
        packageId: pacote.id,
        status: ativo ? 'SCHEDULED' : 'ACTIVE',
        startsAt: inicio,
        endsAt: fim,
        paidCents: pacote.priceCents,
      },
      select: { id: true },
    });

    revalidatePath('/loja/impulsionar');

    return {
      result: {
        ok: true,
        message: ativo
          ? `${pacote.name} agendado para começar em ${inicio.toLocaleDateString('pt-BR')}.`
          : `${pacote.name} ativado por ${pacote.durationDays} dias.`,
      },
      audit: { action: 'boost.purchased', entityType: 'StoreBoost', entityId: boost.id },
    };
  });
}
