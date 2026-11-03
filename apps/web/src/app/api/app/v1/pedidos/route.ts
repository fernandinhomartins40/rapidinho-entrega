import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { criarPedido, listarPedidosDoApp } from '@rapidinho/services/regras';
import { checkoutSchema, RATE_LIMITS } from '@rapidinho/shared';
import type { RespostaCriarPedido } from '@rapidinho/shared/app-api';
import { exigirOk, lerCorpo, limitar } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sem cartão online: a forma só entra se estiver nesta lista. */
const entradaSchema = z.object({
  chaveDeIdempotencia: z.string().trim().min(8).max(64),
  lojaId: z.string().min(1),
  tipo: z.enum(['DELIVERY', 'PICKUP']).optional(),
  enderecoId: z.string().min(1).optional(),
  formaDePagamento: z.enum(['PIX', 'CASH_ON_DELIVERY', 'CARD_ON_DELIVERY']),
  trocoParaCents: z.number().int().min(0).nullable().optional(),
  cupom: z.string().max(40).optional(),
  observacao: z.string().max(500).optional(),
  nome: z.string().optional(),
  telefone: z.string().optional(),
  confirmaMaioridade: z.boolean().optional(),
  receitaImagemId: z.string().min(1).optional(),
  politicaDeSubstituicao: z.enum(['SUBSTITUTE_SIMILAR', 'CONTACT_ME', 'REMOVE_ITEM']).optional(),
});

export const GET = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  return NextResponse.json({ pedidos: await listarPedidosDoApp(user.id) });
});

/** Nenhum valor vem do app: tudo é recalculado em `criarPedido`. */
export const POST = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitar(`app:checkout:${user.id}`, RATE_LIMITS.checkout);

  const entrada = await lerCorpo(request, entradaSchema);

  const resultado = exigirOk(
    await criarPedido({
      usuario: user,
      dados: checkoutSchema.parse({
        storeId: entrada.lojaId,
        type: entrada.tipo,
        addressId: entrada.enderecoId,
        paymentMethod: entrada.formaDePagamento,
        changeForCents: entrada.trocoParaCents,
        couponCode: entrada.cupom,
        notes: entrada.observacao,
        customerName: entrada.nome,
        customerPhone: entrada.telefone,
      }),
      confirmaMaioridade: entrada.confirmaMaioridade === true,
      prescriptionImageId: entrada.receitaImagemId,
      substitutionPolicy: entrada.politicaDeSubstituicao,
      // Só a chave da própria loja: nada de gateway no fluxo do cliente.
      pixPeloGateway: false,
      chaveDeIdempotencia: entrada.chaveDeIdempotencia,
    }),
  );

  const resposta: RespostaCriarPedido = {
    id: resultado.pedido.id,
    numero: resultado.pedido.number,
    status: resultado.pedido.status as RespostaCriarPedido['status'],
    repetido: resultado.repetido,
    mensagem: resultado.message ?? 'Pedido enviado!',
  };

  return NextResponse.json(resposta, { status: resultado.repetido ? 200 : 201 });
});
