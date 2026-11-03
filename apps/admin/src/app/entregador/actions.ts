'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { capturarErro } from '@rapidinho/services';
import {
  aceitarCorridaAvulsaDoEntregador,
  aceitarCorridaDoPedido,
  alterarDisponibilidadeDoEntregador,
  avancarCorridaAvulsaDoEntregador,
  avancarCorridaDoPedido,
  registrarPosicaoDoEntregador,
} from '@rapidinho/services/regras';
import { AuthorizationError, requireCourier } from '@rapidinho/auth';
import type { ActionResult } from '@/lib/action-state';

/**
 * Ações do entregador.
 *
 * Toda query filtra pelo entregador logado (`requireCourier`), nunca por um id
 * vindo do formulário: sem isso um entregador aceitaria a corrida de outro
 * trocando o id no navegador.
 */

async function comEntregador(
  handler: (courierId: string, userId: string) => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    const { courierId, user } = await requireCourier();
    return await handler(courierId, user.id);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }

    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;

    void capturarErro(error, { origem: 'entregador' });
    return { ok: false, message: 'Não foi possível concluir. Tente de novo.' };
  }
}

const idSchema = z.object({ deliveryId: z.string().min(1) });

export async function aceitarCorrida(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const { deliveryId } = idSchema.parse(entrada);
    const resultado = await aceitarCorridaDoPedido(courierId, deliveryId);
    if (resultado.ok) revalidatePath('/entregador');
    return resultado;
  });
}

const avancoSchema = z.object({
  deliveryId: z.string().min(1),
  status: z.enum(['PICKED_UP', 'DELIVERED']),
});

/** Avança a corrida e sincroniza o status do pedido. */
export async function avancarCorrida(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const resultado = await avancarCorridaDoPedido(courierId, avancoSchema.parse(entrada));
    if (resultado.ok) revalidatePath('/entregador');
    return resultado;
  });
}

const disponibilidadeSchema = z.object({ online: z.boolean() });

export async function alterarDisponibilidade(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const { online } = disponibilidadeSchema.parse(entrada);

    const resultado = await alterarDisponibilidadeDoEntregador(courierId, online);
    if (resultado.ok) revalidatePath('/entregador');
    return resultado;
  });
}

const localizacaoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Posição do entregador, só durante corrida. Sem revalidatePath: isto roda a cada
 * poucos segundos, e recarregar a página toda vez seria pior que não ter posição.
 */
export async function atualizarLocalizacao(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) =>
    registrarPosicaoDoEntregador(courierId, localizacaoSchema.parse(entrada)),
  );
}

/* ------------------------------------------------------------------------ */
/* Corridas avulsas                                                          */
/* ------------------------------------------------------------------------ */

const corridaSchema = z.object({ corridaId: z.string().min(10).max(40) });

export async function aceitarCorridaAvulsa(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const { corridaId } = corridaSchema.parse(entrada);
    const resultado = await aceitarCorridaAvulsaDoEntregador(courierId, corridaId);
    if (resultado.ok) revalidatePath('/entregador');
    return resultado;
  });
}

const avancoAvulsaSchema = z.object({
  corridaId: z.string().min(10).max(40),
  status: z.enum(['PICKED_UP', 'DELIVERED']),
});

export async function avancarCorridaAvulsa(entrada: unknown): Promise<ActionResult> {
  return comEntregador(async (courierId) => {
    const dados = avancoAvulsaSchema.parse(entrada);
    const resultado = await avancarCorridaAvulsaDoEntregador(courierId, dados);
    if (resultado.ok) revalidatePath('/entregador');
    return resultado;
  });
}
