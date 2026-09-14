'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { addToCartSchema, cuidSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Manutenção do carrinho.
 *
 * Nenhum preço entra por aqui: o cliente informa O QUE quer, e o valor é
 * calculado na leitura, a partir do catálogo. Um preço adulterado no navegador
 * simplesmente não tem onde aterrissar.
 */

/** Confere que tudo que o cliente escolheu pertence à loja do carrinho. */
async function validarEscolhas(
  storeId: string,
  item: z.infer<typeof addToCartSchema>['item'],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (item.productId) {
    const produto = await prisma.product.findFirst({
      where: { id: item.productId, storeId, deletedAt: null },
      select: { isAvailable: true, pausedUntil: true, sellingUnit: true, minWeightGrams: true },
    });

    if (!produto) return { ok: false, message: 'Produto não encontrado nesta loja.' };

    const pausado = produto.pausedUntil != null && produto.pausedUntil > new Date();
    if (!produto.isAvailable || pausado) {
      return { ok: false, message: 'Este produto está indisponível no momento.' };
    }

    if (produto.sellingUnit === 'WEIGHT_KG') {
      if (!item.weightGrams) {
        return { ok: false, message: 'Escolha o peso que você quer.' };
      }
      if (produto.minWeightGrams && item.weightGrams < produto.minWeightGrams) {
        return { ok: false, message: `O mínimo é ${produto.minWeightGrams} g.` };
      }
    }
  }

  if (item.pizzaSizeId) {
    const tamanho = await prisma.pizzaSize.findFirst({
      where: { id: item.pizzaSizeId, storeId, isActive: true },
      select: { maxFlavors: true },
    });

    if (!tamanho) return { ok: false, message: 'Tamanho de pizza não encontrado.' };

    if (item.flavorIds.length > tamanho.maxFlavors) {
      return {
        ok: false,
        message: `Este tamanho aceita no máximo ${tamanho.maxFlavors} ${tamanho.maxFlavors === 1 ? 'sabor' : 'sabores'}.`,
      };
    }

    const sabores = await prisma.pizzaFlavor.count({
      where: { id: { in: item.flavorIds }, storeId, isAvailable: true },
    });

    if (sabores !== item.flavorIds.length) {
      return { ok: false, message: 'Um dos sabores escolhidos não está disponível.' };
    }
  }

  if (item.complements.length > 0) {
    const opcoes = await prisma.complementOption.findMany({
      where: {
        id: { in: item.complements.map((complemento) => complemento.optionId) },
        isAvailable: true,
        group: { storeId, isActive: true },
      },
      select: {
        id: true,
        groupId: true,
        group: { select: { minChoices: true, maxChoices: true, name: true } },
      },
    });

    if (opcoes.length !== item.complements.length) {
      return { ok: false, message: 'Uma das opções escolhidas não está disponível.' };
    }

    // Os limites do grupo são conferidos no servidor, não só na tela: a
    // validação do formulário é conveniência, não autorização.
    const porGrupo = new Map<
      string,
      { escolhas: number; min: number; max: number; nome: string }
    >();

    for (const opcao of opcoes) {
      const escolha = item.complements.find((c) => c.optionId === opcao.id);
      const atual = porGrupo.get(opcao.groupId) ?? {
        escolhas: 0,
        min: opcao.group.minChoices,
        max: opcao.group.maxChoices,
        nome: opcao.group.name,
      };
      atual.escolhas += escolha?.quantity ?? 1;
      porGrupo.set(opcao.groupId, atual);
    }

    for (const grupo of porGrupo.values()) {
      if (grupo.escolhas > grupo.max) {
        return {
          ok: false,
          message: `Em "${grupo.nome}" você pode escolher no máximo ${grupo.max}.`,
        };
      }
    }
  }

  return { ok: true };
}

export async function adicionarAoCarrinho(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const { storeId, item } = addToCartSchema.parse(entrada);

    const loja = await prisma.store.findFirst({
      where: { id: storeId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!loja) return { ok: false, message: 'Loja indisponível.' };

    const validacao = await validarEscolhas(storeId, item);
    if (!validacao.ok) return { ok: false, message: validacao.message };

    // Um carrinho por loja: misturar itens de lojas diferentes num pedido só
    // não existe — cada loja prepara e despacha o seu.
    const carrinho = await prisma.cart.upsert({
      where: { userId_storeId: { userId: user.id, storeId } },
      update: {},
      create: { userId: user.id, storeId },
      select: { id: true },
    });

    await prisma.cartItem.create({
      data: {
        cartId: carrinho.id,
        productId: item.productId ?? null,
        quantity: item.quantity,
        weightGrams: item.weightGrams ?? null,
        notes: item.notes ?? null,
        pizzaSizeId: item.pizzaSizeId ?? null,
        pizzaExtraId: item.pizzaExtraId ?? null,
        complements: {
          create: item.complements.map((complemento) => ({
            optionId: complemento.optionId,
            quantity: complemento.quantity,
          })),
        },
        flavors: {
          create: item.flavorIds.map((flavorId) => ({ flavorId })),
        },
      },
    });

    revalidatePath('/carrinho');
    revalidatePath(`/loja/${loja.slug}`);

    return { ok: true, message: 'Adicionado ao carrinho.' };
  });
}

const alterarSchema = z.object({
  cartItemId: cuidSchema,
  quantity: z.number().int().min(0).max(99),
});

export async function alterarQuantidade(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = alterarSchema.parse(entrada);

    // O filtro pelo dono do carrinho é o que impede alterar item alheio: um
    // cartItemId adivinhado não encontra nada.
    const item = await prisma.cartItem.findFirst({
      where: { id: dados.cartItemId, cart: { userId: user.id } },
      select: { id: true },
    });

    if (!item) return { ok: false, message: 'Item não encontrado no seu carrinho.' };

    if (dados.quantity === 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity: dados.quantity },
      });
    }

    revalidatePath('/carrinho');
    return { ok: true };
  });
}

export async function removerItem(cartItemId: string): Promise<ActionResult> {
  return alterarQuantidade({ cartItemId, quantity: 0 });
}

export async function esvaziarCarrinho(storeId: string): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    await prisma.cart.deleteMany({ where: { userId: user.id, storeId } });

    revalidatePath('/carrinho');
    return { ok: true, message: 'Carrinho esvaziado.' };
  });
}

const observacaoSchema = z.object({
  storeId: cuidSchema,
  notes: z.string().max(500),
});

export async function salvarObservacao(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const dados = observacaoSchema.parse(entrada);

    await prisma.cart.updateMany({
      where: { userId: user.id, storeId: dados.storeId },
      data: { notes: dados.notes || null },
    });

    revalidatePath('/carrinho');
    return { ok: true };
  });
}
