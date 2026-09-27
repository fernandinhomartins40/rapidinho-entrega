'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { formatCents, normalizePhoneBR } from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

/**
 * Corrida avulsa: a loja chama um entregador para uma entrega que não veio
 * pelo app — o pedido do balcão, do WhatsApp, do telefone.
 *
 * É o que torna viável o motoboy autônomo em cidade pequena: nenhuma loja
 * sozinha tem volume para um entregador fixo, mas o mercado, a farmácia e a
 * lanchonete juntos têm. A loja paga o entregador direto, pelo valor que
 * combinou aqui; a plataforma só junta as duas pontas.
 */

const chamarSchema = z.object({
  customerName: z.string().trim().min(2, 'Nome de quem recebe').max(60),
  customerPhone: z.string().trim().max(20).optional(),
  street: z.string().trim().min(2, 'Rua').max(120),
  number: z.string().trim().max(20).optional(),
  neighborhood: z.string().trim().min(2, 'Bairro').max(80),
  referencePoint: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
  feeCents: z
    .number({ message: 'Valor da corrida' })
    .int()
    .min(300, 'Mínimo de R$ 3,00')
    .max(20_000, 'Máximo de R$ 200,00'),
  collectCents: z.number().int().min(0).max(500_000).optional(),
});

function centavos(valor: FormDataEntryValue | null): number | undefined {
  const texto = String(valor ?? '').trim();
  if (!texto) return undefined;
  const numero = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? Math.round(numero * 100) : Number.NaN;
}

export async function chamarEntregador(
  _estado: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (acesso) => {
    const texto = (campo: string) => String(formData.get(campo) ?? '').trim() || undefined;

    const dados = chamarSchema.parse({
      customerName: texto('customerName'),
      customerPhone: texto('customerPhone'),
      street: texto('street'),
      number: texto('number'),
      neighborhood: texto('neighborhood'),
      referencePoint: texto('referencePoint'),
      notes: texto('notes'),
      feeCents: centavos(formData.get('fee')),
      collectCents: centavos(formData.get('collect')) || undefined,
    });

    const telefone = dados.customerPhone ? normalizePhoneBR(dados.customerPhone) : null;
    if (dados.customerPhone && !telefone) {
      return {
        result: {
          ok: false,
          message: 'Telefone do cliente inválido.',
          fieldErrors: { customerPhone: 'Telefone inválido' },
        },
      };
    }

    const loja = await prisma.store.findUniqueOrThrow({
      where: { id: acesso.storeId },
      select: { id: true, name: true, cityId: true, neighborhood: true },
    });

    const corrida = await prisma.errand.create({
      data: {
        storeId: loja.id,
        cityId: loja.cityId,
        customerName: dados.customerName,
        customerPhone: telefone,
        street: dados.street,
        number: dados.number ?? null,
        neighborhood: dados.neighborhood,
        referencePoint: dados.referencePoint ?? null,
        notes: dados.notes ?? null,
        feeCents: dados.feeCents,
        collectCents: dados.collectCents ?? null,
        createdById: acesso.user.id,
      },
      select: { id: true },
    });

    await avisarEntregadores({
      storeId: loja.id,
      cityId: loja.cityId,
      titulo: `Corrida de ${formatCents(dados.feeCents)} — ${loja.name}`,
      corpo: `Retirar em ${loja.name}${loja.neighborhood ? ` (${loja.neighborhood})` : ''} e levar para ${dados.neighborhood}. Primeiro que aceitar leva.`,
      corridaId: corrida.id,
    });

    revalidatePath('/loja/corridas');
    return {
      result: {
        ok: true,
        message: 'Corrida chamada. Os entregadores da cidade foram avisados.',
      },
    };
  });
}

/**
 * Avisa quem pode pegar a corrida: os entregadores online da frota da cidade
 * e os da própria loja. Se ninguém estiver online, avisa todos os aprovados —
 * melhor um aviso a mais do que uma entrega sem ninguém.
 */
async function avisarEntregadores(entrada: {
  storeId: string;
  cityId: string;
  titulo: string;
  corpo: string;
  corridaId: string;
}): Promise<void> {
  const elegiveis = {
    status: 'ACTIVE' as const,
    OR: [{ type: 'PLATFORM' as const, cityId: entrada.cityId }, { storeId: entrada.storeId }],
  };

  let entregadores = await prisma.courier.findMany({
    where: { ...elegiveis, isOnline: true },
    select: { userId: true },
    take: 50,
  });
  if (entregadores.length === 0) {
    entregadores = await prisma.courier.findMany({
      where: elegiveis,
      select: { userId: true },
      take: 50,
    });
  }

  const painel = process.env.NEXT_PUBLIC_ADMIN_URL;
  await Promise.allSettled(
    entregadores.map(({ userId }) =>
      notificarUsuario({
        userId,
        title: entrada.titulo,
        body: entrada.corpo,
        url: painel ? `${painel}/entregador` : '/entregador',
        canais: ['PUSH', 'WHATSAPP'],
        entity: { type: 'Errand', id: entrada.corridaId },
        tag: `corrida-${entrada.corridaId}`,
      }),
    ),
  );
}

export async function cancelarCorridaAvulsa(corridaId: string): Promise<ActionResult> {
  return runStoreAction(async (acesso) => {
    const id = z.string().min(10).max(40).parse(corridaId);

    // Só a loja dona, e só enquanto ninguém saiu com a entrega.
    const { count } = await prisma.errand.updateMany({
      where: { id, storeId: acesso.storeId, status: { in: ['OPEN', 'ACCEPTED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Cancelada pela loja' },
    });

    if (count === 0) {
      return {
        result: { ok: false, message: 'Esta corrida não pode mais ser cancelada.' },
      };
    }

    revalidatePath('/loja/corridas');
    return { result: { ok: true, message: 'Corrida cancelada.' } };
  });
}
