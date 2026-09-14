'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { complementGroupSchema } from '@rapidinho/shared';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

/**
 * Grupos de complemento (adicionais, opcionais, "escolha o acompanhamento").
 *
 * Grupo e opções são salvos juntos, numa transação: um grupo obrigatório sem
 * opção nenhuma trava o checkout do cliente, então os dois estados nunca podem
 * existir separados.
 */

const salvarSchema = z.object({
  id: z.string().optional(),
  payload: z.string(),
});

export async function salvarGrupoDeComplementos(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const bruto = salvarSchema.parse({
      id: formData.get('id') ?? undefined,
      payload: formData.get('payload'),
    });

    // O formulário tem lista dinâmica de opções; JSON é mais honesto aqui que
    // inventar uma convenção de nomes tipo `opcao[3][preco]` no FormData.
    const dados = complementGroupSchema.parse(JSON.parse(bruto.payload));

    if (bruto.id) {
      const existente = await prisma.complementGroup.findFirst({
        where: { id: bruto.id, storeId: access.storeId },
        select: { id: true, name: true },
      });

      if (!existente) {
        return { result: { ok: false, message: 'Grupo não encontrado nesta loja.' } };
      }

      await prisma.$transaction(async (tx) => {
        await tx.complementGroup.update({
          where: { id: existente.id },
          data: {
            name: dados.name,
            description: dados.description ?? null,
            isRequired: dados.isRequired,
            minChoices: dados.minChoices,
            maxChoices: dados.maxChoices,
            allowRepeat: dados.allowRepeat,
            isActive: dados.isActive,
          },
        });

        // Opções removidas na tela são marcadas como indisponíveis, não
        // apagadas: `OrderItemComplement` aponta para elas, e apagar quebraria
        // a exibição de pedidos já feitos.
        const idsMantidos = dados.options
          .map((opcao) => opcao.id)
          .filter((id): id is string => !!id);

        await tx.complementOption.updateMany({
          where: {
            groupId: existente.id,
            id: { notIn: idsMantidos.length > 0 ? idsMantidos : ['-'] },
          },
          data: { isAvailable: false },
        });

        for (const [indice, opcao] of dados.options.entries()) {
          if (opcao.id) {
            await tx.complementOption.update({
              where: { id: opcao.id },
              data: {
                name: opcao.name,
                description: opcao.description ?? null,
                priceCents: opcao.priceCents,
                isAvailable: opcao.isAvailable,
                sortOrder: indice,
              },
            });
          } else {
            await tx.complementOption.create({
              data: {
                groupId: existente.id,
                name: opcao.name,
                description: opcao.description ?? null,
                priceCents: opcao.priceCents,
                isAvailable: opcao.isAvailable,
                sortOrder: indice,
              },
            });
          }
        }
      });

      revalidatePath('/loja/complementos');
      return {
        result: { ok: true, message: `Grupo "${dados.name}" atualizado.` },
        audit: {
          action: 'complement_group.updated',
          entityType: 'ComplementGroup',
          entityId: existente.id,
        },
      };
    }

    const grupo = await prisma.complementGroup.create({
      data: {
        storeId: access.storeId,
        name: dados.name,
        description: dados.description ?? null,
        isRequired: dados.isRequired,
        minChoices: dados.minChoices,
        maxChoices: dados.maxChoices,
        allowRepeat: dados.allowRepeat,
        isActive: dados.isActive,
        options: {
          create: dados.options.map((opcao, indice) => ({
            name: opcao.name,
            description: opcao.description ?? null,
            priceCents: opcao.priceCents,
            isAvailable: opcao.isAvailable,
            sortOrder: indice,
          })),
        },
      },
      select: { id: true, name: true },
    });

    revalidatePath('/loja/complementos');

    return {
      result: { ok: true, message: `Grupo "${grupo.name}" criado.` },
      audit: {
        action: 'complement_group.created',
        entityType: 'ComplementGroup',
        entityId: grupo.id,
      },
    };
  });
}

export async function excluirGrupoDeComplementos(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const grupo = await prisma.complementGroup.findFirst({
      where: { id, storeId: access.storeId },
      select: { id: true, name: true, _count: { select: { products: true } } },
    });

    if (!grupo) {
      return { result: { ok: false, message: 'Grupo não encontrado nesta loja.' } };
    }

    if (grupo._count.products > 0) {
      return {
        result: {
          ok: false,
          message: `"${grupo.name}" está em uso por ${grupo._count.products} produto(s). Desvincule antes de excluir.`,
        },
      };
    }

    // Desativa em vez de apagar: as opções aparecem em pedidos já feitos.
    // O grupo some do cardápio, mas o histórico continua legível.
    await prisma.complementGroup.update({
      where: { id: grupo.id },
      data: { isActive: false },
    });

    revalidatePath('/loja/complementos');

    return {
      result: { ok: true, message: `Grupo "${grupo.name}" desativado.` },
      audit: {
        action: 'complement_group.deleted',
        entityType: 'ComplementGroup',
        entityId: grupo.id,
      },
    };
  });
}
