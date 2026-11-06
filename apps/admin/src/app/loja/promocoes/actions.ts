'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { runStoreAction, type ActionResult } from '@/lib/store-action';

/**
 * Promoções da página da loja: banner e produtos escolhidos pelo lojista.
 *
 * O preço continua sendo o do produto: a promoção organiza a vitrine, não muda
 * o que o cliente paga.
 */

const MAXIMO_DE_PRODUTOS = 40;

const promocaoSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, 'Dê um título à promoção').max(50, 'Use até 50 caracteres'),
  subtitle: z.string().trim().max(90, 'Use até 90 caracteres').optional(),
  imageId: z.string().nullable(),
  endsAt: z.string().nullable(),
  productIds: z
    .array(z.string())
    .min(1, 'Escolha pelo menos um produto')
    .max(MAXIMO_DE_PRODUTOS, `Escolha até ${MAXIMO_DE_PRODUTOS} produtos`),
});

export async function salvarPromocao(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const lido = promocaoSchema.safeParse({
      id: formData.get('id') || undefined,
      title: formData.get('title'),
      subtitle: formData.get('subtitle') || undefined,
      imageId: formData.get('imageId') || null,
      endsAt: formData.get('endsAt') || null,
      productIds: formData.getAll('productIds').map(String),
    });

    if (!lido.success) {
      const fieldErrors: Record<string, string> = {};
      for (const erro of lido.error.issues) fieldErrors[String(erro.path[0])] ??= erro.message;
      return {
        result: {
          ok: false,
          message: lido.error.issues[0]?.message ?? 'Confira os campos.',
          fieldErrors,
        },
      };
    }
    const dados = lido.data;

    // Produto e imagem vêm do formulário: nunca confiar que são desta loja.
    const produtos = await prisma.product.count({
      where: { id: { in: dados.productIds }, storeId: access.storeId, deletedAt: null },
    });
    if (produtos !== dados.productIds.length) {
      return { result: { ok: false, message: 'Algum produto escolhido não está mais na loja.' } };
    }
    if (dados.imageId) {
      const imagem = await prisma.mediaAsset.count({
        where: { id: dados.imageId, context: 'PROMO_BANNER' },
      });
      if (imagem === 0) return { result: { ok: false, message: 'Envie a imagem de novo.' } };
    }

    const campos = {
      title: dados.title,
      subtitle: dados.subtitle || null,
      imageId: dados.imageId,
      // "Válida até" inclui o dia inteiro, no horário de Brasília.
      endsAt: dados.endsAt ? new Date(`${dados.endsAt}T23:59:59-03:00`) : null,
    };
    const itens = dados.productIds.map((productId, sortOrder) => ({ productId, sortOrder }));

    let id = dados.id;
    if (id) {
      const { count } = await prisma.storePromotion.updateMany({
        where: { id, storeId: access.storeId },
        data: campos,
      });
      if (count === 0) return { result: { ok: false, message: 'Promoção não encontrada.' } };
      await prisma.storePromotion.update({
        where: { id },
        data: { products: { deleteMany: {}, create: itens } },
      });
    } else {
      const criada = await prisma.storePromotion.create({
        data: { ...campos, storeId: access.storeId, products: { create: itens } },
        select: { id: true },
      });
      id = criada.id;
    }

    revalidatePath('/loja/promocoes');

    return {
      result: { ok: true, message: 'Promoção publicada na sua loja.' },
      audit: { action: AUDIT_ACTIONS.promotionSaved, entityType: 'StorePromotion', entityId: id },
    };
  });
}

export async function alternarPromocao(id: string, ativa: boolean): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.storePromotion.updateMany({
      where: { id, storeId: access.storeId },
      data: { isActive: ativa },
    });

    if (count === 0) return { result: { ok: false, message: 'Promoção não encontrada.' } };

    revalidatePath('/loja/promocoes');
    return { result: { ok: true, message: ativa ? 'Promoção no ar.' : 'Promoção pausada.' } };
  });
}

export async function excluirPromocao(id: string): Promise<ActionResult> {
  return runStoreAction(async (access) => {
    const { count } = await prisma.storePromotion.deleteMany({
      where: { id, storeId: access.storeId },
    });

    if (count === 0) return { result: { ok: false, message: 'Promoção não encontrada.' } };

    revalidatePath('/loja/promocoes');
    return { result: { ok: true, message: 'Promoção excluída.' } };
  });
}
