'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { pixPeloGatewayDisponivel } from '@rapidinho/services';
import { criarPedido } from '@rapidinho/services/regras';
import { checkoutSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Criação do pedido pelo site. A regra (preços, frete, cupom, estoque, snapshot)
 * vive em `criarPedido`, a mesma do app: aqui só se lê o formulário.
 */

/** "R$ 50", "50,00", "1.234,50" ou "50.5" → centavos; null quando não há número. */
function trocoEmCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.]/g, '');
  if (limpo === '') return null;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) : null;
}

export async function finalizarPedido(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let destino: string | null = null;

  const resultado = await runAuthedAction(async (user): Promise<ActionResult> => {
    // Troco escrito como a pessoa fala: "R$ 50", "50,00", "50". Texto sem
    // número ("cinquenta") vira aviso no campo, e não o erro do zod em inglês.
    const trocoDigitado = String(formData.get('changeForCents') ?? '').trim();
    const troco = trocoEmCentavos(trocoDigitado);
    if (trocoDigitado !== '' && troco == null) {
      return {
        ok: false,
        message: 'Confira o valor do troco.',
        fieldErrors: { changeForCents: 'Use só números, por exemplo 50' },
      };
    }

    const dados = checkoutSchema.parse({
      storeId: formData.get('storeId'),
      type: formData.get('type') ?? 'DELIVERY',
      addressId: formData.get('addressId') || undefined,
      paymentMethod: formData.get('paymentMethod'),
      changeForCents: troco ?? null,
      couponCode: formData.get('couponCode') || undefined,
      notes: formData.get('notes') || undefined,
      customerName: formData.get('customerName') || undefined,
      customerPhone: formData.get('customerPhone') || undefined,
    });

    const resultado = await criarPedido({
      usuario: user,
      dados,
      confirmaMaioridade: formData.get('confirmaMaioridade') === 'sim',
      prescriptionImageId: String(formData.get('prescriptionImageId') ?? '') || null,
      substitutionPolicy: String(formData.get('substitutionPolicy') ?? '') || null,
      pixPeloGateway: pixPeloGatewayDisponivel(),
    });

    if (!resultado.ok) return resultado;

    revalidatePath('/carrinho');
    revalidatePath('/pedidos');

    destino = `/pedidos/${resultado.pedido.id}`;
    return { ok: true, message: resultado.message };
  });

  // O redirect precisa acontecer FORA do try da ação: ele sinaliza por
  // exceção e seria capturado como falha genérica.
  if (destino) redirect(destino);

  return resultado;
}
