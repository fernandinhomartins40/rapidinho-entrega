'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { addToCartSchema, cuidSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';
import { extrasDaPizza, validarItem } from '@/lib/regras-do-item';

/**
 * Manutenção do carrinho.
 *
 * Nenhum preço entra por aqui: o cliente informa O QUE quer, e o valor é
 * calculado na leitura, a partir do catálogo. Um preço adulterado no navegador
 * simplesmente não tem onde aterrissar.
 */

export async function adicionarAoCarrinho(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const { storeId, item } = addToCartSchema.parse(entrada);

    const loja = await prisma.store.findFirst({
      where: { id: storeId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!loja) return { ok: false, message: 'Loja indisponível.' };

    // Quanto do mesmo produto já está no carrinho, para o estoque contar tudo.
    const jaNoCarrinho = item.productId
      ? ((
          await prisma.cartItem.aggregate({
            where: { productId: item.productId, cart: { userId: user.id, storeId } },
            _sum: { quantity: true },
          })
        )._sum.quantity ?? 0)
      : 0;

    const validacao = await validarItem(storeId, item, { quantidadeJaNoCarrinho: jaNoCarrinho });
    if (!validacao.ok) return { ok: false, message: validacao.message };

    // Um carrinho por loja: misturar itens de lojas diferentes num pedido só
    // não existe — cada loja prepara e despacha o seu.
    const carrinho = await prisma.cart.upsert({
      where: { userId_storeId: { userId: user.id, storeId } },
      update: {},
      create: { userId: user.id, storeId },
      select: { id: true },
    });

    // Item simples igual ao que já está no carrinho soma na mesma linha: pedir
    // a mesma lista duas vezes não pode virar "Arroz" repetido três vezes.
    // Com complemento, sabor ou observação, é outro item — cada um é montado.
    const simples =
      item.productId != null &&
      item.complements.length === 0 &&
      item.flavorIds.length === 0 &&
      item.pizzaSizeId == null &&
      !item.notes;

    if (simples) {
      const igual = await prisma.cartItem.findFirst({
        where: {
          cartId: carrinho.id,
          productId: item.productId,
          weightGrams: item.weightGrams ?? null,
          notes: null,
          pizzaSizeId: null,
          complements: { none: {} },
          flavors: { none: {} },
        },
        select: { id: true, quantity: true },
      });

      if (igual) {
        await prisma.cartItem.update({
          where: { id: igual.id },
          data: { quantity: Math.min(99, igual.quantity + item.quantity) },
        });

        revalidatePath('/carrinho');
        revalidatePath(`/loja/${loja.slug}`);
        return { ok: true, message: 'Adicionado ao carrinho.' };
      }
    }

    await prisma.cartItem.create({
      data: {
        cartId: carrinho.id,
        productId: item.productId ?? null,
        quantity: item.quantity,
        weightGrams: item.weightGrams ?? null,
        notes: item.notes ?? null,
        pizzaSizeId: item.pizzaSizeId ?? null,
        pizzaExtras: {
          create: extrasDaPizza(item).map((extraId) => ({ extraId })),
        },
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
      select: {
        id: true,
        quantity: true,
        cartId: true,
        product: { select: { id: true, stockQuantity: true, sellingUnit: true } },
      },
    });

    if (!item) return { ok: false, message: 'Item não encontrado no seu carrinho.' };

    // Aumentar a quantidade respeita o estoque, somando as outras linhas do
    // mesmo produto no carrinho.
    const estoque = item.product?.stockQuantity;
    if (
      dados.quantity > item.quantity &&
      estoque != null &&
      item.product?.sellingUnit !== 'WEIGHT_KG'
    ) {
      const outras =
        (
          await prisma.cartItem.aggregate({
            where: { cartId: item.cartId, productId: item.product!.id, id: { not: item.id } },
            _sum: { quantity: true },
          })
        )._sum.quantity ?? 0;
      if (outras + dados.quantity > estoque) {
        return { ok: false, message: `Só temos ${estoque} em estoque.` };
      }
    }

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
