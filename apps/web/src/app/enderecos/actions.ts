'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { addressSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Endereços do cliente.
 *
 * Sem CEP e sem número são casos NORMAIS no interior, não exceções — só rua,
 * bairro e ponto de referência são exigidos. O ponto de referência é
 * obrigatório aqui mesmo sendo opcional no banco: é ele que faz o entregador
 * achar a casa quando o endereço é "Rua X, perto da igreja".
 */

export async function salvarEndereco(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const id = formData.get('id');

    const dados = addressSchema.parse({
      label: formData.get('label') || undefined,
      street: formData.get('street'),
      number: formData.get('number') || undefined,
      complement: formData.get('complement') || undefined,
      neighborhood: formData.get('neighborhood'),
      referencePoint: formData.get('referencePoint'),
      zipCode: formData.get('zipCode') || undefined,
      cityId: formData.get('cityId'),
      isDefault: formData.get('isDefault') === 'on',
    });

    const cidade = await prisma.city.findFirst({
      where: { id: dados.cityId, isActive: true },
      select: { id: true },
    });

    if (!cidade) {
      return { ok: false, message: 'Cidade indisponível.' };
    }

    await prisma.$transaction(async (tx) => {
      // Um padrão só: marcar o novo sem desmarcar o antigo deixaria dois, e o
      // checkout escolheria um deles ao acaso.
      if (dados.isDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      }

      if (typeof id === 'string' && id) {
        await tx.address.updateMany({
          where: { id, userId: user.id },
          data: {
            label: dados.label ?? null,
            street: dados.street,
            number: dados.number ?? null,
            complement: dados.complement ?? null,
            neighborhood: dados.neighborhood,
            referencePoint: dados.referencePoint,
            zipCode: dados.zipCode || null,
            cityId: dados.cityId,
            isDefault: dados.isDefault,
          },
        });
      } else {
        const total = await tx.address.count({ where: { userId: user.id } });

        await tx.address.create({
          data: {
            userId: user.id,
            label: dados.label ?? null,
            street: dados.street,
            number: dados.number ?? null,
            complement: dados.complement ?? null,
            neighborhood: dados.neighborhood,
            referencePoint: dados.referencePoint,
            zipCode: dados.zipCode || null,
            cityId: dados.cityId,
            // O primeiro endereço é sempre o padrão: ninguém cadastra um
            // endereço para não usar.
            isDefault: dados.isDefault || total === 0,
          },
        });
      }
    });

    revalidatePath('/enderecos');
    revalidatePath('/checkout');

    return { ok: true, message: 'Endereço salvo.' };
  });
}

const idSchema = z.object({ id: z.string() });

export async function definirPadrao(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const { id } = idSchema.parse(entrada);

    const endereco = await prisma.address.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!endereco) return { ok: false, message: 'Endereço não encontrado.' };

    await prisma.$transaction([
      prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
      prisma.address.update({ where: { id: endereco.id }, data: { isDefault: true } }),
    ]);

    revalidatePath('/enderecos');
    revalidatePath('/checkout');

    return { ok: true, message: 'Endereço principal atualizado.' };
  });
}

export async function excluirEndereco(id: string): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    // Endereços aparecem em pedidos antigos, mas o pedido guarda um snapshot
    // próprio — então dá para apagar sem perder o histórico.
    const { count } = await prisma.address.deleteMany({ where: { id, userId: user.id } });

    if (count === 0) return { ok: false, message: 'Endereço não encontrado.' };

    revalidatePath('/enderecos');
    return { ok: true, message: 'Endereço removido.' };
  });
}
