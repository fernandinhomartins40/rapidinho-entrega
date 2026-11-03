import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { adicionarItemAoCarrinho } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita } from '@/lib/api-do-app';
import { responderCarrinho } from '@/lib/carrinho-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({
  lojaId: z.string().min(1),
  item: z.object({
    produtoId: z.string().min(1).optional(),
    quantidade: z.number().int().optional(),
    gramas: z.number().int().optional(),
    observacao: z.string().optional(),
    complementos: z
      .array(z.object({ opcaoId: z.string().min(1), quantidade: z.number().int().optional() }))
      .optional(),
    pizzaTamanhoId: z.string().min(1).optional(),
    pizzaExtraIds: z.array(z.string().min(1)).optional(),
    saborIds: z.array(z.string().min(1)).optional(),
  }),
});

/**
 * Um carrinho por loja: item de outra loja abre outro carrinho, e o anterior
 * fica guardado. Limites e regras do item são conferidos em `addToCartSchema`.
 */
export const POST = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { lojaId, item } = await lerCorpo(request, entradaSchema);

  exigirOk(
    await adicionarItemAoCarrinho(user.id, {
      storeId: lojaId,
      item: {
        productId: item.produtoId,
        quantity: item.quantidade,
        weightGrams: item.gramas,
        notes: item.observacao,
        complements: item.complementos?.map((complemento) => ({
          optionId: complemento.opcaoId,
          quantity: complemento.quantidade,
        })),
        pizzaSizeId: item.pizzaTamanhoId,
        pizzaExtraIds: item.pizzaExtraIds,
        flavorIds: item.saborIds,
      },
    }),
  );

  return responderCarrinho(user.id, 201);
});
